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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../utils/SafeToken.sol";
import "../interfaces/IPriceModel.sol";

contract DescendingStepModel is IPriceModel {
  using SafeMath for uint256;

  /// @dev states
  uint256 public startBlock;
  uint256 public override endBlock;
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
    require(_endBlock > _startBlock, "DescendingStepModel::constructor:: end block < start block");
    require(_startPrice > _priceFloor, "DescendingStepModel::constructor:: floor price > start price");

    startBlock = _startBlock;
    endBlock = _endBlock;
    blockPerStep = _blockPerStep;
    priceStep = _priceStep;
    startPrice = _startPrice;
    priceFloor = _priceFloor;
  }

  /// @dev Get current price per token
  function price() external view override returns (uint256) {
    if (block.number <= startBlock) return startPrice;
    // This should prevent overflow
    if (block.number >= endBlock) return priceFloor;

    uint256 _priceDelta = ((block.number.sub(startBlock)).div(blockPerStep)).mul(priceStep);

    uint256 _updatedPrice = startPrice.sub(_priceDelta);

    if (_updatedPrice < priceFloor) return priceFloor;

    return _updatedPrice;
  }
}
