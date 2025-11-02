import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { config } from '../config/environment.js';
import { storage } from '../storage/index.js';
import { SmartAccountData } from '../types/index.js';

// Smart Account Factory ABI (minimal required functions)
const SMART_ACCOUNT_FACTORY_ABI = [
  "function createSmartAccount(address owner, bytes32 salt) external returns (address smartAccount)",
  "function getSmartAccountAddress(address owner, bytes32 salt) external view returns (address)",
  "function getUserSmartAccounts(address owner) external view returns (address[] memory)",
  "function isValidSmartAccount(address account) external view returns (bool)",
  "function defaultGasPayer() external view returns (address)"
];

// Smart Account ABI (minimal required functions)
const SMART_ACCOUNT_ABI = [
  "function executeTransaction(address to, uint256 value, bytes calldata data, bytes calldata signature) external returns (bool success)",
  "function executeBatchTransaction(address[] calldata to, uint256[] calldata values, bytes[] calldata data, bytes calldata signature) external returns (bool success)",
  "function getTransactionHash(address to, uint256 value, bytes calldata data, uint256 nonce) external view returns (bytes32)",
  "function getBatchTransactionHash(address[] calldata to, uint256[] calldata values, bytes[] calldata data, uint256 nonce) external view returns (bytes32)",
  "function owner() external view returns (address)",
  "function gasPayer() external view returns (address)",
  "function nonce() external view returns (uint256)"
];

export interface GaslessTransactionRequest {
  to: string;
  data: string;
  value?: string;
  signature?: string; // User-provided signature
  signingMethod?: string; // Method used to generate the signature (eth_sign, personal_sign, signMessage, etc.)
}

export class GaslessService {
  private provider: ethers.JsonRpcProvider;
  private gasPayerWallet: ethers.Wallet;
  private factoryContract: ethers.Contract;
  private smartAccountCache: Map<string, SmartAccountData> = new Map();

  constructor() {
    // Initialize provider with fallback
    const rpcUrl = this.getRpcUrl();
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Initialize gas payer wallet
    const privateKey = config.gasless.gasPayerPrivateKey;
    if (!privateKey) {
      throw new Error('GASLESS_GAS_PAYER_PRIVATE_KEY is required for gas payer wallet');
    }
    
    this.gasPayerWallet = new ethers.Wallet(privateKey, this.provider);
    
    // Initialize factory contract
    const factoryAddress = config.gasless.factoryAddress || this.getFactoryAddress();
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      SMART_ACCOUNT_FACTORY_ABI,
      this.gasPayerWallet
    );

    logger.info('GaslessService initialized', {
      chainId: config.gasless.chainId,
      rpcUrl,
      gasPayerAddress: this.gasPayerWallet.address,
      factoryAddress
    });
  }

  /**
   * Get or create smart account - checks database first, then blockchain, then creates new if needed
   */
  async getOrCreateSmartAccount(walletAddress: string): Promise<SmartAccountData> {
    try {
      // First, check database for existing smart accounts
      const existingAccounts = await storage.getSmartAccountsByOwner(walletAddress);
      
      if (existingAccounts.length > 0) {
        logger.info(`Found existing smart account in database: ${existingAccounts[0].address}`, {
          walletAddress,
          accountCount: existingAccounts.length,
        });
        return existingAccounts[0];
      }

      // If not in database, use createSmartAccount (which checks blockchain and creates if needed)
      const smartAccountData = await this.createSmartAccount(walletAddress);
      
      logger.info(`Smart account retrieved/created via gasless service: ${smartAccountData.address}`, {
        walletAddress,
      });
      
      return smartAccountData;
    } catch (error) {
      logger.error('Failed to get or create smart account:', { walletAddress, error });
      throw error;
    }
  }

  /**
   * Create or get existing smart account for a user
   */
  async createSmartAccount(ownerAddress: string): Promise<SmartAccountData> {
    try {
      logger.info('Creating smart account', { ownerAddress });

      const salt = ethers.keccak256(ethers.toUtf8Bytes(`${ownerAddress}`));
      
      // Get predicted address
      const predictedAddress = await this.factoryContract.getSmartAccountAddress(ownerAddress, salt);
      
      // Check if smart account already exists by checking if there's code at the address
      const code = await this.provider.getCode(predictedAddress);
      
      if (code !== '0x') {
        // Smart account already exists
        logger.info('Smart account already exists', {
          owner: ownerAddress,
          smartAccount: predictedAddress,
          salt
        });
        return await this.getSmartAccountData(predictedAddress);
      }
      
      // Create the smart account
      const tx = await this.factoryContract.createSmartAccount(ownerAddress, salt);
      await tx.wait();
      
      logger.info('Smart account created', {
        owner: ownerAddress,
        smartAccount: predictedAddress,
        txHash: tx.hash,
        salt
      });

      return await this.getSmartAccountData(predictedAddress);
    } catch (error) {
      logger.error('Failed to create smart account', { ownerAddress, error });
      throw error;
    }
  }

  /**
   * Get smart account data
   */
  async getSmartAccountData(smartAccountAddress: string): Promise<SmartAccountData> {
    try {
      // Check cache first
      if (this.smartAccountCache.has(smartAccountAddress)) {
        return this.smartAccountCache.get(smartAccountAddress)!;
      }

      const smartAccountContract = new ethers.Contract(
        smartAccountAddress,
        SMART_ACCOUNT_ABI,
        this.provider
      );

      const [owner, nonce] = await Promise.all([
        smartAccountContract.owner(),
        smartAccountContract.nonce()
      ]);

      const data: SmartAccountData = {
        address: smartAccountAddress,
        owner,
        isDeployed: true, // If we can query it, it's deployed
        nonce: Number(nonce)
      };

      // Cache the data
      this.smartAccountCache.set(smartAccountAddress, data);
      
      // Store in database
      try {
        await storage.createSmartAccount(data);
      } catch (dbError) {
        logger.warn('Failed to store smart account in database:', { smartAccountAddress, dbError });
        // Continue even if database storage fails
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to get smart account data', { smartAccountAddress, error });
      throw error;
    }
  }

  /**
   * Execute a gasless transaction
   */
  async executeGaslessTransaction(
    ownerAddress: string,
    transactions: GaslessTransactionRequest[],
    providedNonce?: number
  ): Promise<{ txHash: string; smartAccount: string }> {
    try {
      logger.info('Executing gasless transaction', { 
        ownerAddress, 
        transactionCount: transactions.length,
        signingMethods: transactions.map(tx => tx.signingMethod || 'unknown')
      });

      // Validate that all transactions have signatures
      for (const tx of transactions) {
        if (!tx.signature) {
          throw new Error('All transactions must include user signatures');
        }
      }

      // Get or create smart account
      const smartAccountData = await this.getOrCreateSmartAccount(ownerAddress);
      const smartAccountContract = new ethers.Contract(
        smartAccountData.address,
        SMART_ACCOUNT_ABI,
        this.gasPayerWallet
      );

      // Prepare transaction data
      const to = transactions.map(tx => tx.to);
      const values = transactions.map(tx => tx.value || '0');
      const data = transactions.map(tx => tx.data);

      // Check current nonce and expected hash for signature validation
      let currentNonce: bigint;
      if (providedNonce !== undefined) {
        currentNonce = BigInt(providedNonce);
        logger.info('Using provided nonce for transaction execution', { providedNonce, currentNonce: currentNonce.toString() });
      } else {
        currentNonce = await smartAccountContract.nonce();
        logger.info('Using current nonce from smart contract', { currentNonce: currentNonce.toString() });
      }

      let txHash: string;

      if (transactions.length === 1) {
        // Single transaction - use the user-provided signature
        let signature = transactions[0].signature!;
        const signingMethod = transactions[0].signingMethod || 'unknown';
        
        // Get the expected hash for this transaction with current nonce
        const expectedHash = await smartAccountContract.getTransactionHash(
          to[0],
          values[0],
          data[0],
          currentNonce
        );

        // Verify signature
        let recoveredAddress: string;
        
        if (signingMethod === 'signMessage') {
          // signMessage adds the Ethereum message prefix: "\x19Ethereum Signed Message:\n" + message.length + message
          const prefixedHash = ethers.hashMessage(ethers.getBytes(expectedHash));
          recoveredAddress = ethers.recoverAddress(prefixedHash, signature);
        } else {
          // For eth_sign and personal_sign, use the raw hash
          recoveredAddress = ethers.recoverAddress(expectedHash, signature);
        }
        
        if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
          throw new Error(`Signature verification failed: expected ${ownerAddress}, got ${recoveredAddress}`);
        }
        
        const tx = await smartAccountContract.executeTransaction(
          to[0],
          values[0],
          data[0],
          signature
        );
        
        const receipt = await tx.wait();
        txHash = receipt.hash;
      } else {
        // Batch transaction - use the first signature (in production, you'd need a batch signature)
        let signature = transactions[0].signature!;
        const signingMethod = transactions[0].signingMethod || 'unknown';
        
        // Get the expected hash for batch transaction with current nonce
        const expectedHash = await smartAccountContract.getBatchTransactionHash(
          to,
          values,
          data,
          currentNonce
        );

        // Verify signature
        let recoveredAddress: string;
        
        if (signingMethod === 'signMessage') {
          // signMessage adds the Ethereum message prefix: "\x19Ethereum Signed Message:\n" + message.length + message
          const prefixedHash = ethers.hashMessage(ethers.getBytes(expectedHash));
          recoveredAddress = ethers.recoverAddress(prefixedHash, signature);
        } else {
          // For eth_sign and personal_sign, use the raw hash
          recoveredAddress = ethers.recoverAddress(expectedHash, signature);
        }
        
        if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
          throw new Error(`Batch signature verification failed: expected ${ownerAddress}, got ${recoveredAddress}`);
        }
        
        const tx = await smartAccountContract.executeBatchTransaction(
          to,
          values,
          data,
          signature
        );
        
        const receipt = await tx.wait();
        txHash = receipt.hash;
      }

      // Update cache
      this.smartAccountCache.delete(smartAccountData.address);

      logger.info('Gasless transaction executed', {
        ownerAddress,
        smartAccount: smartAccountData.address,
        txHash,
        transactionCount: transactions.length
      });

      return {
        txHash,
        smartAccount: smartAccountData.address
      };
    } catch (error) {
      logger.error('Failed to execute gasless transaction', { ownerAddress, error });
      throw error;
    }
  }

  /**
   * Get transaction hash for user to sign
   */
  async getTransactionHashToSign(
    ownerAddress: string,
    to: string,
    value: string = '0',
    data: string
  ): Promise<{ txHash: string; smartAccount: string; nonce: number }> {
    try {
      // Get or create smart account
      const smartAccountData = await this.getOrCreateSmartAccount(ownerAddress);
      const smartAccountContract = new ethers.Contract(
        smartAccountData.address,
        SMART_ACCOUNT_ABI,
        this.provider // Use provider instead of gasPayerWallet for read-only operations
      );

      // Get current nonce
      const currentNonce = await smartAccountContract.nonce();

      // Get transaction hash
      const txHash = await smartAccountContract.getTransactionHash(
        to,
        value,
        data,
        currentNonce
      );

      return {
        txHash,
        smartAccount: smartAccountData.address,
        nonce: Number(currentNonce)
      };
    } catch (error) {
      logger.error('Failed to get transaction hash', { ownerAddress, error });
      throw error;
    }
  }

  /**
   * Get batch transaction hash for user to sign
   */
  async getBatchTransactionHashToSign(
    ownerAddress: string,
    transactions: Array<{ to: string; data: string; value?: string }>
  ): Promise<{ txHash: string; smartAccount: string; nonce: number }> {
    try {
      // Get or create smart account
      const smartAccountData = await this.getOrCreateSmartAccount(ownerAddress);
      const smartAccountContract = new ethers.Contract(
        smartAccountData.address,
        SMART_ACCOUNT_ABI,
        this.provider // Use provider instead of gasPayerWallet for read-only operations
      );

      // Get current nonce
      const currentNonce = await smartAccountContract.nonce();

      // Prepare transaction data
      const to = transactions.map(tx => tx.to);
      const values = transactions.map(tx => tx.value || '0');
      const data = transactions.map(tx => tx.data);

      // Get batch transaction hash
      const txHash = await smartAccountContract.getBatchTransactionHash(
        to,
        values,
        data,
        currentNonce
      );

      return {
        txHash,
        smartAccount: smartAccountData.address,
        nonce: Number(currentNonce)
      };
    } catch (error) {
      logger.error('Failed to get batch transaction hash', { ownerAddress, error });
      throw error;
    }
  }

  /**
   * Estimate gas for transactions
   */
  async estimateGas(
    ownerAddress: string,
    transactions: GaslessTransactionRequest[]
  ): Promise<{ gasEstimate: string; gasPrice: string }> {
    try {
      // Get or create smart account
      const smartAccountData = await this.getOrCreateSmartAccount(ownerAddress);
      const smartAccountContract = new ethers.Contract(
        smartAccountData.address,
        SMART_ACCOUNT_ABI,
        this.gasPayerWallet
      );

      // Prepare transaction data
      const to = transactions.map(tx => tx.to);
      const values = transactions.map(tx => tx.value || '0');
      const data = transactions.map(tx => tx.data);

      // Get current nonce
      const currentNonce = await smartAccountContract.nonce();

      // Create dummy signature for estimation
      const dummySignature = '0x' + '00'.repeat(65);

      let gasEstimate: bigint;

      if (transactions.length === 1) {
        gasEstimate = await smartAccountContract.executeTransaction.estimateGas(
          to[0],
          values[0],
          data[0],
          dummySignature
        );
      } else {
        gasEstimate = await smartAccountContract.executeBatchTransaction.estimateGas(
          to,
          values,
          data,
          dummySignature
        );
      }

      const gasPrice = await this.provider.getFeeData();

      return {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0'
      };
    } catch (error) {
      logger.error('Failed to estimate gas', { ownerAddress, error });
      throw error;
    }
  }

  /**
   * Get RPC URL with fallbacks
   */
  private getRpcUrl(): string {
    if (config.contracts.rpcUrl) {
      return config.contracts.rpcUrl;
    }
    
    // Fallback to chain-specific RPC URLs
    switch (config.gasless.chainId) {
      case 11155111: // Sepolia
        return process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';
      case 1: // Mainnet
        return process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';
      case 137: // Polygon
        return process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
      case 80001: // Mumbai
        return process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com';
      default:
        throw new Error(`No RPC URL configured for chain ID ${config.gasless.chainId}`);
    }
  }

  /**
   * Get factory contract address based on chain ID
   */
  private getFactoryAddress(): string {
    // For now, use the Sepolia deployment
    // In production, you'd have different addresses for different networks
    switch (config.gasless.chainId) {
      case 11155111: // Sepolia
        return '0x752F888650A57cd7c7C2B6B658012d3c9239Cc03';
      case 97: // BSC Testnet - would need to deploy there
        throw new Error('Smart Account Factory not deployed on BSC Testnet yet');
      default:
        throw new Error(`Smart Account Factory not available for chain ID ${config.gasless.chainId}`);
    }
  }
}

// Export singleton instance
export const gaslessService = new GaslessService();
export default gaslessService;