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

import "./SafeToken.sol";

import "../interfaces/IPriceModel.sol";

contract AlpacaGang02 is ERC721, Ownable, ReentrancyGuard {
  /// @dev constants
  uint256 public constant MAX_ALPACA_PURCHASE = 20;
  uint256 public immutable maxAlpacas;

  /// @dev states
  uint256 public startBlock;
  uint256 public reserveCount;

  IPriceModel public priceModel;

  /// @dev event
  event Mint(address indexed caller, bytes32 indexed requestId);

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _maxAlpacas,
    uint256 _startBlock,
  ) public ERC721(_name, _symbol) {
    startBlock = _startBlock;
    maxAlpacas = _maxAlpacas;

    reserveCount = 0;
  }

  /// @dev Withdraw funds from minting gang member
  /// @param to The address to received funds
  function withdraw(address to) external onlyOwner {
    SafeToken.safeTransferETH(to, address(this).balance);
  }

  /// @dev Mint Alpaca gang member
  /// @param amount The amount of tokens that users wish to buy
  function mint(uint256 amount) external payable nonReentrant {
    require(block.number > startBlock, "!sale start");
    require(amount <= MAX_ALPACA_PURCHASE, "amount > MAX_ALPACA_PURCHASE");
    require(SafeMath.add(reserveCount, amount) <= maxAlpacas, "sold out");
    
    // TODO: Need to get price from model
    require(SafeMath.mul(ALPACA_GANG_PRICE, amount) <= msg.value, "insufficent funds");

    for (uint256 i = 0; i < amount; i++) {
      bytes32 requestId = requestRandomness(keyHash, vrfFee);

      // TODO: mint logic here

      emit Mint(msg.sender, requestId);
    }

    reserveCount = SafeMath.add(reserveCount, amount);
  }
}
