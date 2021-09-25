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

import "../utils/SafeToken.sol";
import "../interfaces/IPriceModel.sol";

contract DescendingStepModel is IPriceModel {

  /// @dev states
  uint256 public startBlock;
  uint256 public endBlock;
  uint256 public blockPerStep;
  uint256 public priceStep;
  
  uint256 public startPrice;
  uint256 public priceFloor;

  constructor(
    uint256 _startBlock,
    uint256 _endBlock,
    uint256 _blockPerStep,
    uint256 _priceStep,
    uint256 _startPrice,
    uint256 _priceFloor
  ) public {
    require(_endBlock > _startBlock, "end block < start block");
    require(_startPrice > _priceFloor, "floor price > start price");
  
    startBlock = _startBlock;
    endBlock = _endBlock;
    blockPerStep = _blockPerStep;
    priceStep = _priceStep;
    startPrice = _startPrice;
    priceFloor = _priceFloor;
  }

  /// @dev Get current price per token
  function price() override external view returns (uint256) {
    if (block.number <= startBlock) return startPrice;
    // This should prevent overflow
    if (block.number >= endBlock) return priceFloor;

    // TODO: need safe math here?
    uint256 priceDelta = ((block.number - startBlock) / blockPerStep) * priceStep;
    
    uint256 updatedPrice = startPrice - priceDelta;

    if (updatedPrice < priceFloor) return priceFloor;

    return updatedPrice;
  }
}