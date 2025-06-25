// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Uniswap {
    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;

    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "Transfer failed");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "Transfer failed");

        reserveA += amountA;
        reserveB += amountB;
    }

    function removeLiquidity(uint256 amountA, uint256 amountB) external {
        require(reserveA >= amountA && reserveB >= amountB, "Insufficient reserves");

        reserveA -= amountA;
        reserveB -= amountB;

        require(IERC20(tokenA).transfer(msg.sender, amountA), "Transfer failed");
        require(IERC20(tokenB).transfer(msg.sender, amountB), "Transfer failed");
    }

    function swapAToB(uint256 amountA) external {
        uint256 amountB = (amountA * reserveB) / reserveA;
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "Transfer failed");
        require(IERC20(tokenB).transfer(msg.sender, amountB), "Transfer failed");

        reserveA += amountA;
        reserveB -= amountB;
    }

    function swapBToA(uint256 amountB) external {
        uint256 amountA = (amountB * reserveA) / reserveB;
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "Transfer failed");
        require(IERC20(tokenA).transfer(msg.sender, amountA), "Transfer failed");

        reserveB += amountB;
        reserveA -= amountA;
    }
}