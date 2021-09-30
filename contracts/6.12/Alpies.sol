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

import "./utils/SafeToken.sol";

import "./interfaces/IPriceModel.sol";

contract Alpies is ERC721, Ownable, ReentrancyGuard {
  /// @notice Libraries
  using SafeMath for uint256;

  /// @dev constants
  uint256 public constant MAX_ALPIES_PURCHASE = 20;
  uint256 public immutable maxAlpies;
  uint256 public immutable premintAmount;
  uint256 public immutable saleStartBlock;
  uint256 public immutable saleEndBlock;
  uint256 public immutable revealBlock;

  /// @dev states
  uint256 public startingIndex;
  string public provenanceHash;

  IPriceModel public priceModel;

  /// @dev event
  event Mint(address indexed caller, uint256 indexed tokenId);
  event SetBaseURI(address indexed caller, string baseURI);
  event Reveal(address indexed caller, uint256 indexed startingIndex);

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _maxAlpies,
    uint256 _revealBlock,
    IPriceModel _priceModel,
    uint256 _premintAmount
  ) public ERC721(_name, _symbol) {
    require(_revealBlock > _priceModel.endBlock(), "Alpies::constructor:: revealBlock < saleEndBlock");

    saleStartBlock = _priceModel.startBlock();
    saleEndBlock = _priceModel.endBlock();
    revealBlock = _revealBlock;

    maxAlpies = _maxAlpies;
    premintAmount = _premintAmount;

    priceModel = _priceModel;

    for (uint256 i = 0; i < _premintAmount; i++) {
      _safeMint(msg.sender, i);
      emit Mint(msg.sender, i);
    }
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

  /// @dev Mint Alpies
  /// @param _amount The amount of tokens that users wish to buy
  function mint(uint256 _amount) external payable nonReentrant onlyEOA {
    require(block.number > saleStartBlock && block.number <= saleEndBlock, "Alpies::mint:: not in sale period");
    require(_amount <= MAX_ALPIES_PURCHASE, "Alpies::mint:: amount > MAX_ALPIES_PURCHASE");
    require(totalSupply().add(_amount) <= maxAlpies, "Alpies::mint:: sold out");
    require(bytes(provenanceHash).length != 0, "Alpies::setProvenanceHash:: provenanceHash not set");

    uint256 _pricePerToken = priceModel.price();

    require(_pricePerToken.mul(_amount) <= msg.value, "Alpies::mint:: insufficent funds");

    for (uint256 i = 0; i < _amount; i++) {
      uint256 mintIndex = totalSupply();
      _safeMint(msg.sender, mintIndex);
      emit Mint(msg.sender, mintIndex);
    }
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
    if(_mintIndex < premintAmount) return _mintIndex;
    // ( (_mintIndex + startingIndex - premintAmount) % (maxAlpies - premintAmount) ) + premintAmount
    uint256 _alpiesId = ((_mintIndex.add(startingIndex).sub(premintAmount)).mod(maxAlpies.sub(premintAmount))).add(premintAmount);
    return _alpiesId;
  }
}
