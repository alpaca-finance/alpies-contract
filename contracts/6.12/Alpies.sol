// SPDX-License-Identifier: MIT
/**
  ∩~~~~∩ 
  ξ ･×･ ξ 
  ξ　~　ξ 
  ξ　　 ξ 
  ξ　　 “~～~～〇 
  ξ　　　　　　 ξ 
  ξ ξ ξ~～~ξ ξ ξ 
　 ξ_ξξ_ξ　ξ_ξξ_ξ
Alpaca Fin Corporation
*/

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "./utils/SafeToken.sol";

import "./interfaces/IPriceModel.sol";

contract Alpies is ERC721, Ownable, ReentrancyGuard {
  /// @notice Libraries
  using SafeMath for uint256;

  /// @dev constants
  uint256 public immutable maxAlpies;
  uint256 public immutable saleStartBlock;
  uint256 public immutable saleEndBlock;
  uint256 public immutable revealBlock;
  uint256 public immutable maxPremintAmount;

  uint256 public constant MAX_PURCHASE_PER_WINDOW = 30;
  uint256 public constant PURCHASE_WINDOW_SIZE = 100;

  uint256 public constant MAX_ALPIES_PER_ADDRESS = 90;

  /// @dev states
  uint256 public startingIndex;
  string public provenanceHash;
  uint256 public preMintCount;

  IPriceModel public priceModel;

  mapping(address => uint256) public alpieUserPurchased;

  struct PurchaseHistory {
    uint256 counter;
    uint256 windowStartBlock;
  }

  mapping(address => PurchaseHistory) public userPurchaseHistory;

  /// @dev event
  event PreMint(address indexed caller, uint256 preMintCount, uint256 preMintAmount);
  event Mint(address indexed caller, uint256 indexed tokenId);
  event SetBaseURI(address indexed caller, string baseURI);
  event Reveal(address indexed caller, uint256 indexed startingIndex);
  event Refund(address indexed caller, uint256 indexed amount);

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _maxAlpies,
    uint256 _revealBlock,
    IPriceModel _priceModel,
    uint256 _maxPremintAmount
  ) public ERC721(_name, _symbol) {
    require(_revealBlock > _priceModel.endBlock(), "Alpies::constructor:: revealBlock < saleEndBlock");
    require(_maxAlpies > _maxPremintAmount, "Alpies::constructor:: _maxAlpies < _maxPremintAmount");

    // set immutatble variable
    saleStartBlock = _priceModel.startBlock();
    saleEndBlock = _priceModel.endBlock();
    revealBlock = _revealBlock;

    maxAlpies = _maxAlpies;
    maxPremintAmount = _maxPremintAmount;

    priceModel = _priceModel;
  }

  /// @dev Require that the caller must be an EOA account to avoid flash loans.
  modifier onlyEOA() {
    require(msg.sender == tx.origin, "Alpies::onlyEOA:: not eoa");
    _;
  }

  /// @dev set the base uri for the collection
  /// @param _baseURI URI that will be used for every token meta data
  function setBaseURI(string memory _baseURI) external onlyOwner {
    _setBaseURI(_baseURI);
    emit SetBaseURI(msg.sender, _baseURI);
  }

  /// @dev set the provenanceHash
  /// @param _provenancaHash SHA256 Digest of concatenated SHA256 of the sequence of images
  function setProvenanceHash(string memory _provenancaHash) external onlyOwner {
    require(bytes(provenanceHash).length == 0, "Alpies::setProvenanceHash:: provenanceHash already set");
    provenanceHash = _provenancaHash;
  }

  /// @dev Withdraw funds from minting gang member
  /// @param _to The address to received funds
  function withdraw(address _to) external onlyOwner {
    SafeToken.safeTransferETH(_to, address(this).balance);
  }

  /// @dev Function to pre-mint Alpies
  /// @param _preMintAmount The amount to be pre-minted
  function preMint(uint256 _preMintAmount) external onlyOwner {
    require(block.number < saleStartBlock, "Alpies::preMint:: cannot premint after sale start");
    require(preMintCount.add(_preMintAmount) <= maxPremintAmount, "Alpies::preMint:: exceed maxPremintAmount");
    require(bytes(provenanceHash).length == 0, "Alpies::preMint:: provenanceHash already set");

    for (uint256 i = preMintCount; i < preMintCount.add(_preMintAmount); i++) {
      _mint(msg.sender, i);
      emit Mint(msg.sender, i);
    }

    preMintCount = preMintCount.add(_preMintAmount);

    emit PreMint(msg.sender, preMintCount, _preMintAmount);
  }

  /// @dev Mint Alpies
  /// @param _amount The amount of tokens that users wish to buy
  function mint(uint256 _amount) external payable nonReentrant onlyEOA {
    require(block.number > saleStartBlock && block.number <= saleEndBlock, "Alpies::mint:: not in sale period");
    require(bytes(provenanceHash).length != 0, "Alpies::mint:: provenanceHash not set");

    // 1. Find max purchaseable. Minumum of the following
    // 1.1 Per window
    // 1.2 Per address
    // 1.3 maxAlpies - totalSupply
    // 1.4 _amount
    uint256 _purchaseableAmount = Math.min(maximumPurchasable(msg.sender), _amount);

    // 2. Calcuate total price for check out
    uint256 _pricePerToken = priceModel.price();
    uint256 _checkoutCost = _pricePerToken.mul(_purchaseableAmount);

    require(_purchaseableAmount > 0, "Alpies::mint:: unpurchasable");
    require(_checkoutCost <= msg.value, "Alpies::mint:: insufficent funds");

    // 3. Mint NFT equal to _purchaseableAmount
    for (uint256 i = 0; i < _purchaseableAmount; i++) {
      uint256 _mintIndex = totalSupply();
      _mint(msg.sender, _mintIndex);
      emit Mint(msg.sender, _mintIndex);
    }

    // 4. Update user's stat
    // 4.1 update purchase per window per user
    // 4.2 update purchase per address
    _updatePurchasePerUser(msg.sender, _purchaseableAmount);
    _updateUserPurchaseWindow(msg.sender, _purchaseableAmount);

    // 5. Refund unused fund
    uint256 _changes = msg.value.sub(_checkoutCost);
    if (_changes != 0) {
      SafeToken.safeTransferETH(msg.sender, _changes);
      emit Refund(msg.sender, _changes);
    }
  }

  /// @dev update the total amount of alpies that user has purchased
  /// @param _buyer user address
  /// @param _amount The amount of alpies that user can purchase
  function _updatePurchasePerUser(address _buyer, uint256 _amount) internal {
    alpieUserPurchased[_buyer] = alpieUserPurchased[_buyer].add(_amount);
  }

  /// @dev update user purchase history for current window
  /// @param _buyer user address
  /// @param _amount The amount of alpies that user purchased
  function _updateUserPurchaseWindow(address _buyer, uint256 _amount) internal {
    PurchaseHistory storage _userPurchaseHistory = userPurchaseHistory[_buyer];
    // if first purchase or start new window
    // 1. update purchase amount
    // 2. set new windowStartBlock
    // else only update purchase amount
    if (_isNewPurchaseWindow(_userPurchaseHistory) || _userPurchaseHistory.windowStartBlock == 0) {
      _userPurchaseHistory.counter = _amount;
      _userPurchaseHistory.windowStartBlock = block.number;
    } else {
      _userPurchaseHistory.counter = _userPurchaseHistory.counter.add(_amount);
    }
  }

  /// @dev check how many alpies user can purchase in the current transaction
  /// @param _buyer user address
  function maximumPurchasable(address _buyer) public view returns (uint256) {
    // 1. Find max purchaseable. Minumum of the following
    // 1.1 Per window
    // 1.2 Per address
    // 1.3 maxAlpies - totalSupply
    uint256 _supplyLeft = maxAlpies.sub(totalSupply());
    if (_supplyLeft == 0) return _supplyLeft;
    uint256 _maxPurchaseable = Math.min(_maxUserPurchaseInWindow(_buyer), _maxPurchaseblePerAddress(_buyer));

    return Math.min(_maxPurchaseable, _supplyLeft);
  }

  /// @dev check how many alpies user can purchase in the current window
  /// @param _buyer user address
  function _maxUserPurchaseInWindow(address _buyer) internal view returns (uint256) {
    PurchaseHistory memory _userPurchaseHistory = userPurchaseHistory[_buyer];
    if (_isNewPurchaseWindow(_userPurchaseHistory)) {
      return MAX_PURCHASE_PER_WINDOW;
    }
    uint256 _purchasedInThisWindow = userPurchaseHistory[_buyer].counter;
    return MAX_PURCHASE_PER_WINDOW.sub(_purchasedInThisWindow);
  }

  /// @dev check how many alpies user can purchase until reach MAX_ALPIES_PER_ADDRESS
  /// @param _buyer user address
  function _maxPurchaseblePerAddress(address _buyer) internal view returns (uint256) {
    uint256 _purchased = alpieUserPurchased[_buyer];
    return MAX_ALPIES_PER_ADDRESS.sub(_purchased);
  }

  /// @dev check if user latest purchase is in the same window
  /// @param _userPurchaseHistory user purchasing history
  function _isNewPurchaseWindow(PurchaseHistory memory _userPurchaseHistory) internal view returns (bool) {
    return block.number.sub(_userPurchaseHistory.windowStartBlock) > PURCHASE_WINDOW_SIZE;
  }

  /// @dev Once called, starting index will be finalized.
  function reveal() external {
    require(startingIndex == 0, "Alpies::reveal:: can't reveal again");
    // If sold out before reveal block, can be revealed right away
    if (totalSupply() < maxAlpies) {
      require(block.number > revealBlock, "Alpies::reveal:: it's not time yet");
    }

    // Get the blockhash of the last block
    startingIndex = uint256(blockhash(block.number - 1)) % maxAlpies;

    // Prevent default sequence
    if (startingIndex == 0) {
      startingIndex = startingIndex.add(1);
    }
    emit Reveal(msg.sender, startingIndex);
  }

  /// @dev get alpiesId from mintIndex
  /// @param _mintIndex The index that alpie is minted
  function alpiesId(uint256 _mintIndex) external view returns (uint256) {
    require(startingIndex != 0, "Alpies::alpiesId:: alpies not reveal yet");
    // if alpies in premint set
    if (_mintIndex < preMintCount) return _mintIndex;
    // ( (_mintIndex + startingIndex - preMintCount) % (maxAlpies - preMintCount) ) + preMintCount
    uint256 _alpiesId = ((_mintIndex.add(startingIndex).sub(preMintCount)).mod(maxAlpies.sub(preMintCount))).add(
      preMintCount
    );
    return _alpiesId;
  }
}
