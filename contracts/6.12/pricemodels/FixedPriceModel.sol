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

contract FixedPriceModel is IPriceModel {
  /// @dev states
  uint256 public fixPrice;
  uint256 public override endBlock;

  constructor(
    uint256 _price
  ) public {
    fixPrice = _price;
  }

  /// @dev Get current price per token
  function price() external view override returns (uint256) {
    return fixPrice;
  }
}
