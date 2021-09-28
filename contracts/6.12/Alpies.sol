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

import "./utils/SafeToken.sol";

import "./interfaces/IPriceModel.sol";

contract Alpies is ERC721, Ownable, ReentrancyGuard {
  /// @dev constants
  uint256 public constant MAX_ALPIES_PURCHASE = 20;
  uint256 public immutable maxAlpies;

  /// @dev states
  uint256 public saleStartBlock;
  uint256 public saleEndBlock;
  uint256 public revealBlock;

  uint256 public startingIndex;

  IPriceModel public priceModel;

  /// @dev event
  event Mint(address indexed caller, uint256 indexed tokenId);

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _maxAlpies,
    uint256 _saleStartBlock,
    uint256 _saleEndBlock,
    uint256 _revealBlock,
    IPriceModel _priceModel,
    uint256 _premintAmount
  ) public ERC721(_name, _symbol) {
    saleStartBlock = _saleStartBlock;
    saleEndBlock = _saleEndBlock;
    revealBlock = _revealBlock;

    maxAlpies = _maxAlpies;

    priceModel = _priceModel;

    startingIndex = 0;

    for (uint256 i = 0; i < _premintAmount; i++) {
      _mint(address(this), i);
      emit Mint(msg.sender, i);
    }
  }

  /// @dev set the base uri for the collection
  /// @param _baseURI URI that will be used for every token meta data
  function setBaseURI(string memory _baseURI) external onlyOwner {
    _setBaseURI(_baseURI);
  }

  /// @dev Withdraw funds from minting gang member
  /// @param _to The address to received funds
  function withdraw(address _to) external onlyOwner {
    SafeToken.safeTransferETH(_to, address(this).balance);
  }

  /// @dev Mint Alpies
  /// @param _amount The amount of tokens that users wish to buy
  function mint(uint256 _amount) external payable nonReentrant {
    require(block.number > saleStartBlock && block.number <= saleEndBlock, "Alpies::Not in sale period");
    require(_amount <= MAX_ALPIES_PURCHASE, "Alpies::amount > MAX_ALPIES_PURCHASE");
    require(SafeMath.add(totalSupply(), _amount) <= maxAlpies, "Alpies::sold out");

    uint256 _pricePerToken = priceModel.price();

    require(SafeMath.mul(_pricePerToken, _amount) <= msg.value, "Alpies::insufficent funds");

    for (uint256 i = 0; i < _amount; i++) {
      uint256 mintIndex = totalSupply();
      // Sanity check
      if (totalSupply() < maxAlpies) {
        _safeMint(msg.sender, mintIndex);
        emit Mint(msg.sender, i);
      }
    }
  }

  /// @dev Once called, starting index will be finalized.
  function reveal() external {
    require(startingIndex == 0, "Alpies::can't reveal again");
    // If sold out before reveal block, can be revealed right away
    if (totalSupply() < maxAlpies) {
      require(block.number > revealBlock, "Alpies::it's not time yet");
    }

    // Get the blockhash of the last block
    startingIndex = uint256(blockhash(block.number - 1)) % maxAlpies;

    // Prevent default sequence
    if (startingIndex == 0) {
      startingIndex = startingIndex.add(1);
    }
  }
}
