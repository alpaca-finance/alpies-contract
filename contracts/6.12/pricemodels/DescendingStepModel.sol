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

import "./SafeToken.sol";
import "../interfaces/IPriceModel.sol";


contract DescendingStepModel is IPriceModel {

  /// @dev states
  uint256 public startBlock;
  uint256 public endBlock;
  uint256 public blockPerStep;
  uint256 public priceStep;
  
  uint256 public startPrice;
  uint256 public priceFloor;

  /// @dev Get current price per token
  function price() view {
    if (block.number <= startBlock) return startPrice;
    // This should prevent overflow
    if (block.number >= endBlock) return priceFloor;

    // TODO: need safe math here?
    uint256 memory priceDelta = ((block.number - startBlock) / blockPerStep) * priceStep;
    
    uint256 memory updatedPrice = startPrice - priceDelta;

    if (updatedPrice < priceFloor) return priceFloor;

    return updatedPrice;
  }
}