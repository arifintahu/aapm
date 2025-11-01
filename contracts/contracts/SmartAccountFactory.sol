// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SmartAccount.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SmartAccountFactory
 * @dev Factory contract to create smart accounts with deterministic addresses
 */
contract SmartAccountFactory is Ownable {
    
    event SmartAccountCreated(
        address indexed owner,
        address indexed smartAccount,
        address indexed gasPayer,
        bytes32 salt
    );
    
    mapping(address => address[]) public userSmartAccounts;
    mapping(address => bool) public isSmartAccount;
    address public defaultGasPayer;
    
    constructor(address _defaultGasPayer) Ownable(msg.sender) {
        require(_defaultGasPayer != address(0), "Factory: gas payer cannot be zero address");
        defaultGasPayer = _defaultGasPayer;
    }
    
    /**
     * @dev Create a smart account for a user with deterministic address
     * @param owner The owner of the smart account (user's EOA)
     * @param salt Salt for CREATE2 deployment
     * @return smartAccount The address of the created smart account
     */
    function createSmartAccount(
        address owner,
        bytes32 salt
    ) external returns (address smartAccount) {
        require(owner != address(0), "Factory: owner cannot be zero address");
        
        // Use CREATE2 for deterministic address
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(owner, defaultGasPayer)
        );
        
        bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));
        
        assembly {
            smartAccount := create2(0, add(bytecode, 0x20), mload(bytecode), finalSalt)
        }
        
        require(smartAccount != address(0), "Factory: smart account creation failed");
        
        // Track the smart account
        userSmartAccounts[owner].push(smartAccount);
        isSmartAccount[smartAccount] = true;
        
        emit SmartAccountCreated(owner, smartAccount, defaultGasPayer, finalSalt);
    }
    
    /**
     * @dev Get the deterministic address of a smart account before deployment
     * @param owner The owner of the smart account
     * @param salt Salt for CREATE2 deployment
     * @return The predicted address of the smart account
     */
    function getSmartAccountAddress(
        address owner,
        bytes32 salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(owner, defaultGasPayer)
        );
        
        bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));
        bytes32 hash = keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            finalSalt,
            keccak256(bytecode)
        ));
        
        return address(uint160(uint256(hash)));
    }
    
    /**
     * @dev Get all smart accounts created by a user
     * @param owner The owner address
     * @return Array of smart account addresses
     */
    function getUserSmartAccounts(address owner) external view returns (address[] memory) {
        return userSmartAccounts[owner];
    }
    
    /**
     * @dev Check if an address is a smart account created by this factory
     * @param account The address to check
     * @return True if it's a smart account from this factory
     */
    function isValidSmartAccount(address account) external view returns (bool) {
        return isSmartAccount[account];
    }
    
    /**
     * @dev Update the default gas payer (only owner)
     * @param newGasPayer The new default gas payer address
     */
    function updateDefaultGasPayer(address newGasPayer) external onlyOwner {
        require(newGasPayer != address(0), "Factory: gas payer cannot be zero address");
        defaultGasPayer = newGasPayer;
    }
    
    /**
     * @dev Get the number of smart accounts created by a user
     * @param owner The owner address
     * @return The count of smart accounts
     */
    function getUserSmartAccountCount(address owner) external view returns (uint256) {
        return userSmartAccounts[owner].length;
    }
}