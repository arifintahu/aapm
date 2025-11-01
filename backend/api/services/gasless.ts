import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { config } from '../config/environment.js';

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
}

export interface SmartAccountData {
  address: string;
  owner: string;
  gasPayer: string;
  nonce: number;
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
      chainId: config.chainId,
      rpcUrl,
      gasPayerAddress: this.gasPayerWallet.address,
      factoryAddress
    });
  }

  /**
   * Create or get existing smart account for a user
   */
  async createSmartAccount(ownerAddress: string): Promise<SmartAccountData> {
    try {
      logger.info('Creating smart account', { ownerAddress });

      // Check if user already has smart accounts
      const existingAccounts = await this.factoryContract.getUserSmartAccounts(ownerAddress);
      
      if (existingAccounts.length > 0) {
        // Return the first existing smart account
        const smartAccountAddress = existingAccounts[0];
        return await this.getSmartAccountData(smartAccountAddress);
      }

      // Create new smart account
      const salt = ethers.randomBytes(32);
      
      // Get predicted address
      const predictedAddress = await this.factoryContract.getSmartAccountAddress(ownerAddress, salt);
      
      // Create the smart account
      const tx = await this.factoryContract.createSmartAccount(ownerAddress, salt);
      await tx.wait();
      
      logger.info('Smart account created', {
        owner: ownerAddress,
        smartAccount: predictedAddress,
        txHash: tx.hash
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

      const [owner, gasPayer, nonce] = await Promise.all([
        smartAccountContract.owner(),
        smartAccountContract.gasPayer(),
        smartAccountContract.nonce()
      ]);

      const data: SmartAccountData = {
        address: smartAccountAddress,
        owner,
        gasPayer,
        nonce: Number(nonce)
      };

      // Cache the data
      this.smartAccountCache.set(smartAccountAddress, data);
      
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
    transactions: GaslessTransactionRequest[]
  ): Promise<{ txHash: string; smartAccount: string }> {
    try {
      logger.info('Executing gasless transaction', { ownerAddress, transactionCount: transactions.length });

      // Validate that all transactions have signatures
      for (const tx of transactions) {
        if (!tx.signature) {
          throw new Error('All transactions must include user signatures');
        }
      }

      // Get or create smart account
      const smartAccountData = await this.createSmartAccount(ownerAddress);
      const smartAccountContract = new ethers.Contract(
        smartAccountData.address,
        SMART_ACCOUNT_ABI,
        this.gasPayerWallet
      );

      // Prepare transaction data
      const to = transactions.map(tx => tx.to);
      const values = transactions.map(tx => tx.value || '0');
      const data = transactions.map(tx => tx.data);

      let txHash: string;

      if (transactions.length === 1) {
        // Single transaction - use the user-provided signature
        const signature = transactions[0].signature!;
        
        const tx = await smartAccountContract.executeTransaction(
          to[0],
          values[0],
          data[0],
          signature
        );
        
        const receipt = await tx.wait();
        txHash = receipt.hash;
      } else {
        // Batch transaction - for now, use the first signature (in production, you'd need a batch signature)
        const signature = transactions[0].signature!;
        
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
      const smartAccountData = await this.createSmartAccount(ownerAddress);
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
      const smartAccountData = await this.createSmartAccount(ownerAddress);
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
      const smartAccountData = await this.createSmartAccount(ownerAddress);
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
    if (config.rpcUrl) {
      return config.rpcUrl;
    }

    // Fallback RPC URLs based on chain ID
    switch (config.chainId) {
      case 11155111: // Sepolia
        return 'https://rpc.sepolia.org';
      case 97: // BSC Testnet
        return 'https://bsc-testnet.publicnode.com';
      case 1: // Mainnet
        return 'https://eth.llamarpc.com';
      case 137: // Polygon
        return 'https://polygon-rpc.com';
      case 31337: // Localhost
        return 'http://localhost:8545';
      default:
        throw new Error(`No RPC URL configured for chain ID ${config.chainId}`);
    }
  }

  /**
   * Get factory contract address based on chain ID
   */
  private getFactoryAddress(): string {
    // For now, use the Sepolia deployment
    // In production, you'd have different addresses for different networks
    switch (config.chainId) {
      case 11155111: // Sepolia
        return '0x752F888650A57cd7c7C2B6B658012d3c9239Cc03';
      case 97: // BSC Testnet - would need to deploy there
        throw new Error('Smart Account Factory not deployed on BSC Testnet yet');
      default:
        throw new Error(`Smart Account Factory not available for chain ID ${config.chainId}`);
    }
  }
}

// Export singleton instance
export const gaslessService = new GaslessService();
export default gaslessService;