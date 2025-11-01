// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev A mock USDC token for testing purposes
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals
    
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, 1000000 * 10**_decimals); // 1M mUSDC
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to any address (for testing purposes)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Faucet function - allows anyone to mint 1000 mUSDC for testing
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 10000 * 10**_decimals, "Already has enough tokens");
        _mint(msg.sender, 1000 * 10**_decimals); // Mint 1000 mUSDC
    }
    
    /**
     * @dev Faucet function that mints to a specific address - useful for smart accounts
     * @param to Address to mint tokens to
     */
    function faucetTo(address to) external {
        require(to != address(0), "Cannot mint to zero address");
        require(balanceOf(to) < 10000 * 10**_decimals, "Target address already has enough tokens");
        _mint(to, 1000 * 10**_decimals); // Mint 1000 mUSDC
    }
}