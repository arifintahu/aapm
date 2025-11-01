// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SmartAccount
 * @dev A smart contract wallet that can execute transactions on behalf of an owner
 * Gas fees are paid by a designated gas payer (relayer)
 */
contract SmartAccount is ReentrancyGuard {
    using ECDSA for bytes32;

    address public owner;
    address public gasPayer;
    uint256 public nonce;
    
    mapping(bytes32 => bool) public executedTransactions;
    
    event TransactionExecuted(
        address indexed to,
        uint256 value,
        bytes data,
        uint256 nonce,
        bytes32 txHash
    );
    
    event BatchTransactionExecuted(
        address[] to,
        uint256[] values,
        bytes[] data,
        uint256 nonce,
        bytes32 txHash
    );
    
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event GasPayerChanged(address indexed previousGasPayer, address indexed newGasPayer);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "SmartAccount: caller is not the owner");
        _;
    }
    
    modifier onlyGasPayer() {
        require(msg.sender == gasPayer, "SmartAccount: caller is not the gas payer");
        _;
    }
    
    constructor(address _owner, address _gasPayer) {
        require(_owner != address(0), "SmartAccount: owner cannot be zero address");
        require(_gasPayer != address(0), "SmartAccount: gas payer cannot be zero address");
        
        owner = _owner;
        gasPayer = _gasPayer;
        nonce = 0;
    }
    
    /**
     * @dev Execute a single transaction on behalf of the owner
     * Can only be called by the gas payer with a valid signature from the owner
     */
    function executeTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external onlyGasPayer nonReentrant returns (bool success) {
        bytes32 txHash = getTransactionHash(to, value, data, nonce);
        
        // Verify signature
        require(!executedTransactions[txHash], "SmartAccount: transaction already executed");
        require(_verifySignature(txHash, signature), "SmartAccount: invalid signature");
        
        // Mark as executed
        executedTransactions[txHash] = true;
        nonce++;
        
        // Execute transaction
        (success, ) = to.call{value: value}(data);
        require(success, "SmartAccount: transaction execution failed");
        
        emit TransactionExecuted(to, value, data, nonce - 1, txHash);
    }
    
    /**
     * @dev Execute multiple transactions in a batch
     * All transactions must succeed or the entire batch reverts
     */
    function executeBatchTransaction(
        address[] calldata to,
        uint256[] calldata values,
        bytes[] calldata data,
        bytes calldata signature
    ) external onlyGasPayer nonReentrant returns (bool success) {
        require(to.length == values.length && values.length == data.length, 
                "SmartAccount: arrays length mismatch");
        require(to.length > 0, "SmartAccount: empty transaction batch");
        
        bytes32 txHash = getBatchTransactionHash(to, values, data, nonce);
        
        // Verify signature
        require(!executedTransactions[txHash], "SmartAccount: batch already executed");
        require(_verifySignature(txHash, signature), "SmartAccount: invalid signature");
        
        // Mark as executed
        executedTransactions[txHash] = true;
        nonce++;
        
        // Execute all transactions
        for (uint256 i = 0; i < to.length; i++) {
            (bool txSuccess, ) = to[i].call{value: values[i]}(data[i]);
            require(txSuccess, "SmartAccount: batch transaction failed");
        }
        
        emit BatchTransactionExecuted(to, values, data, nonce - 1, txHash);
        return true;
    }
    
    /**
     * @dev Get the hash for a single transaction
     */
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 _nonce
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "\x19\x01",
            _domainSeparator(),
            keccak256(abi.encode(
                keccak256("Transaction(address to,uint256 value,bytes data,uint256 nonce)"),
                to,
                value,
                keccak256(data),
                _nonce
            ))
        ));
    }
    
    /**
     * @dev Get the hash for a batch transaction
     */
    function getBatchTransactionHash(
        address[] calldata to,
        uint256[] calldata values,
        bytes[] calldata data,
        uint256 _nonce
    ) public view returns (bytes32) {
        bytes32[] memory dataHashes = new bytes32[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            dataHashes[i] = keccak256(data[i]);
        }
        
        return keccak256(abi.encodePacked(
            "\x19\x01",
            _domainSeparator(),
            keccak256(abi.encode(
                keccak256("BatchTransaction(address[] to,uint256[] values,bytes32[] data,uint256 nonce)"),
                keccak256(abi.encodePacked(to)),
                keccak256(abi.encodePacked(values)),
                keccak256(abi.encodePacked(dataHashes)),
                _nonce
            ))
        ));
    }
    
    /**
     * @dev Change the owner of the smart account
     */
    function changeOwner(address newOwner, bytes calldata signature) external onlyGasPayer {
        require(newOwner != address(0), "SmartAccount: new owner cannot be zero address");
        
        bytes32 hash = keccak256(abi.encodePacked(
            "\x19\x01",
            _domainSeparator(),
            keccak256(abi.encode(
                keccak256("ChangeOwner(address newOwner,uint256 nonce)"),
                newOwner,
                nonce
            ))
        ));
        
        require(_verifySignature(hash, signature), "SmartAccount: invalid signature");
        
        address previousOwner = owner;
        owner = newOwner;
        nonce++;
        
        emit OwnerChanged(previousOwner, newOwner);
    }
    
    /**
     * @dev Change the gas payer (only current gas payer can do this)
     */
    function changeGasPayer(address newGasPayer) external onlyGasPayer {
        require(newGasPayer != address(0), "SmartAccount: new gas payer cannot be zero address");
        
        address previousGasPayer = gasPayer;
        gasPayer = newGasPayer;
        
        emit GasPayerChanged(previousGasPayer, newGasPayer);
    }
    
    /**
     * @dev Verify signature from owner
     */
    function _verifySignature(bytes32 hash, bytes calldata signature) internal view returns (bool) {
        address signer = hash.recover(signature);
        return signer == owner;
    }
    
    /**
     * @dev Get domain separator for EIP-712
     */
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("SmartAccount")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }
    
    /**
     * @dev Allow the contract to receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}