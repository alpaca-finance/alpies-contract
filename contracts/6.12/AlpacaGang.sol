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

import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";

import "./SafeToken.sol";

import "hardhat/console.sol";

contract AlpacaGang is VRFConsumerBase, ERC721, Ownable, ReentrancyGuard {
  /// @dev constants
  uint256 public constant ALPACA_GANG_PRICE = 1680000000000000000;
  uint256 public constant MAX_ALPACA_PURCHASE = 20;
  uint256 public immutable maxAlpacas;

  /// @dev Chainlink VRF
  bytes32 internal keyHash;
  uint256 internal vrfFee;

  /// @dev states
  uint256 public startBlock;
  uint256 public reserveCount;

  uint256 public preMintCount;
  uint256[] public freeAlpacas;

  mapping(bytes32 => address) public requestOwner;
  mapping(bytes32 => Rand) public rands;

  struct Rand {
    uint256 result;
    uint256 isFulfilled;
  }

  /// @dev event
  event PreMint(address caller, uint256 preMintCount, uint256 preMintAmount);
  event Mint(address indexed caller, bytes32 indexed requestId);
  event Claim(address indexed caller, bytes32 indexed requestId, uint256 tokenId);

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _maxAlpacas,
    uint256 _startBlock,
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _vrfFee
  ) public VRFConsumerBase(_vrfCoordinator, _link) ERC721(_name, _symbol) {
    startBlock = _startBlock;
    maxAlpacas = _maxAlpacas;

    keyHash = _keyHash;
    vrfFee = _vrfFee;

    reserveCount = 0;
    preMintCount = 0;
  }

  /// @dev Function to pre-mint Alpacas.
  /// Note: Should be done before startBlock.
  /// @param preMintAmount The amount to be pre-minted
  function preMint(uint256 preMintAmount) external onlyOwner {
    require(SafeMath.add(preMintAmount, preMintCount) <= maxAlpacas, "exceed max cap");

    // Build "freeAlpacas" and pre-mint
    uint256 prevFreeAlpacasLength = freeAlpacas.length;
    for (uint256 i = prevFreeAlpacasLength; i < SafeMath.add(prevFreeAlpacasLength, preMintAmount); i++) {
      _mint(address(this), i);
      freeAlpacas.push(i);
    }

    preMintCount = SafeMath.add(preMintCount, preMintAmount);

    emit PreMint(msg.sender, preMintCount, preMintAmount);
  }

  /// @dev Withdraw funds from minting Alpacas
  /// @param to The address to received funds
  function withdraw(address to) external onlyOwner {
    SafeToken.safeTransferETH(to, address(this).balance);
  }

  /// @dev Withdraw LINK from AlpacaGang
  /// @param to The address to received LINK
  /// @param amount The amount to withdraw
  function withdrawLINK(address to, uint256 amount) external onlyOwner {
    LINK.transfer(to, amount);
  }

  /// @dev Mint Alpaca Gang. Request Chainlink's VRF for random number.
  /// Users will need to call "claim" to get the actual art from the collection.
  /// @param amount The amount of tokens that users wish to buy
  function mint(uint256 amount) external payable nonReentrant returns (bytes32[] memory) {
    require(block.number > startBlock && preMintCount == maxAlpacas, "!sale start");
    require(amount <= MAX_ALPACA_PURCHASE, "amount > MAX_ALPACA_PURCHASE");
    require(SafeMath.add(reserveCount, amount) <= maxAlpacas, "sold out");
    require(SafeMath.mul(ALPACA_GANG_PRICE, amount) <= msg.value, "insufficent funds");
    require(LINK.balanceOf(address(this)) >= vrfFee, "not enough LINK");

    bytes32[] memory requestIds = new bytes32[](amount);
    bytes32 requestId;
    for (uint256 i = 0; i < amount; i++) {
      requestId = requestRandomness(keyHash, vrfFee);

      // Sanity check. Revert if requestId collision
      require(requestOwner[requestId] == address(0), "requestId collision");

      // Assign requestId to its owner
      requestOwner[requestId] = msg.sender;
      requestIds[i] = requestId;

      emit Mint(msg.sender, requestId);
    }

    reserveCount = reserveCount + amount;

    return requestIds;
  }

  /// @dev Claim Alpaca Gang. Decided which Token ID that user get.
  /// @param requestIds The requestIds that users wish to claim
  function claim(bytes32[] memory requestIds) external nonReentrant {
    require(requestIds.length <= 10, "requestIds.length > 10");
    for (uint256 i = 0; i < requestIds.length; i++) {
      require(requestOwner[requestIds[i]] == msg.sender, "!request owner");
      require(rands[requestIds[i]].isFulfilled == 1, "!request fulfilled");

      // Find out which index of freeAlpacas user will get
      uint256 index = (rands[requestIds[i]].result % freeAlpacas.length);
      // Optimistically transfer ownership to user first
      uint256 tokenId = freeAlpacas[index];
      _transfer(address(this), msg.sender, freeAlpacas[index]);
      // Remove from double-link list
      _removeFromFree(index);

      // release requestId and its rands
      requestOwner[requestIds[i]] = address(0);
      rands[requestIds[i]].result = 0;
      rands[requestIds[i]].isFulfilled = 0;

      emit Claim(msg.sender, requestIds[i], tokenId);
    }
  }

  /// @dev Return freeAlpacasLength
  function freeLength() external view returns (uint256) {
    return freeAlpacas.length;
  }

  /// @dev Remove Alpacas from freeAlpacas. Execute when someone claims it.
  /// @param index The index that will be removed
  function _removeFromFree(uint256 index) internal {
    freeAlpacas[index] = freeAlpacas[SafeMath.sub(freeAlpacas.length, 1)];
    freeAlpacas.pop();
  }

  /// @dev Overriding method for VRF Coordinator to fulfillRandomness.
  /// @param requestId The requestId to be fulfilled
  /// @param randomness The result from random
  function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
    rands[requestId] = Rand({ result: randomness, isFulfilled: 1 });
  }
}
