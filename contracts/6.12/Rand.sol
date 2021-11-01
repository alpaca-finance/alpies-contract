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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";

contract Rand is VRFConsumerBase, Ownable, ReentrancyGuard {
  /// @dev constants
  uint256 public immutable maxWhitelistSpot;

  /// @dev Chainlink VRF
  bytes32 internal keyHash;
  uint256 internal vrfFee;

  /// @dev states
  struct Ticket {
    address owner;
    uint256 mark;
  }
  bool public isDraw;
  Ticket[] public ticketInfo;
  uint256 public pendingRandom;
  uint256 public whitelistTaken;

  /// @dev event
  event LogRand(address indexed caller, bytes32 indexed requestId);
  event LogMark(address owner, uint256 randIndex);
  event LogAlreadyMark();

  constructor(
    uint256 _maxWhitelistSpot,
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _vrfFee
  ) public VRFConsumerBase(_vrfCoordinator, _link) {
    maxWhitelistSpot = _maxWhitelistSpot;
    keyHash = _keyHash;
    vrfFee = _vrfFee;

    whitelistTaken = 0;
  }

  /// @dev Withdraw LINK from Rand
  /// @param to The address to received LINK
  /// @param amount The amount to withdraw
  function withdrawLINK(address to, uint256 amount) external onlyOwner {
    LINK.transfer(to, amount);
  }

  /// @dev Issue ticket
  function issueTicket(address[] calldata _eligibleAddress) external onlyOwner {
    require(isDraw == false, "no issue after draw");
    uint256 len = _eligibleAddress.length;
    for (uint256 idx = 0; idx < len; idx++) {
      ticketInfo.push(Ticket({ owner: _eligibleAddress[idx], mark: 0 }));
    }
  }

  /// @dev Draw whitelist spot for users.
  /// @param _randTimes The amount of tokens that users wish to buy
  function draw(uint256 _randTimes) external onlyOwner {
    require(pendingRandom == 0, "some pending random");
    require(whitelistTaken.add(_randTimes) <= maxWhitelistSpot, "no more rand");
    require(ticketInfo.length > maxWhitelistSpot, "ticketInfo.length too small");
    require(LINK.balanceOf(address(this)) >= vrfFee.mul(_randTimes), "not enough LINK");

    if (isDraw == false) isDraw = true;

    for (uint256 i = 0; i < _randTimes; i++) {
      bytes32 requestId = requestRandomness(keyHash, vrfFee);
      pendingRandom = pendingRandom + 1;
      emit LogRand(msg.sender, requestId);
    }
  }

  /// @dev Overriding method for VRF Coordinator to fulfillRandomness.
  /// @param _randomness The result from random
  function fulfillRandomness(
    bytes32, /* _requestId */
    uint256 _randomness
  ) internal override {
    uint256 _rand = _randomness.mod(ticketInfo.length);
    if (ticketInfo[_rand].mark == 0) {
      ticketInfo[_rand].mark = 1;
      whitelistTaken++;
      LogMark(ticketInfo[_rand].owner, _rand);
    } else {
      LogAlreadyMark();
    }
    if (pendingRandom != 0) pendingRandom = pendingRandom.sub(1);
  }
}
