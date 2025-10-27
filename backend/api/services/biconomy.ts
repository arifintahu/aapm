import { 
  createSmartAccountClient, 
  BiconomySmartAccountV2,
  PaymasterMode,
} from '@biconomy/account';
import { ethers } from 'ethers';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { 
  SmartAccountData, 
  GaslessTransactionRequest, 
  GaslessTransactionResponse 
} from '../types/index.js';

export class BiconomyService {
  private provider: ethers.JsonRpcProvider;
  private smartAccounts: Map<string, BiconomySmartAccountV2> = new Map();

  constructor() {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    logger.info('BiconomyService initialized', {
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
    });
  }

  /**
   * Create or get smart account for a user
   */
  async createSmartAccount(ownerAddress: string): Promise<SmartAccountData> {
    try {
      // Check if smart account already exists
      if (this.smartAccounts.has(ownerAddress)) {
        const existingAccount = this.smartAccounts.get(ownerAddress)!;
        const address = await existingAccount.getAccountAddress();
        const isDeployed = await existingAccount.isAccountDeployed();
        
        return {
          address,
          isDeployed,
          owner: ownerAddress,
        };
      }

      // Create new smart account using the simplified approach for Biconomy v4.x
      const smartAccount = await createSmartAccountClient({
        signer: new ethers.Wallet(config.privateKey, this.provider),
        bundlerUrl: config.biconomy.bundlerUrl,
        biconomyPaymasterApiKey: config.biconomy.apiKey, // Use main API key for paymaster in v4.x
        chainId: config.chainId,
      });

      const address = await smartAccount.getAccountAddress();
      const isDeployed = await smartAccount.isAccountDeployed();

      // Cache the smart account
      this.smartAccounts.set(ownerAddress, smartAccount);

      logger.info('Smart account created', {
        owner: ownerAddress,
        address,
        isDeployed,
      });

      return {
        address,
        isDeployed,
        owner: ownerAddress,
      };
    } catch (error) {
      logger.error('Error creating smart account:', error);
      throw new Error('Failed to create smart account');
    }
  }

  /**
   * Execute gasless transaction
   */
  async executeGaslessTransaction(
    ownerAddress: string,
    transactions: GaslessTransactionRequest[]
  ): Promise<GaslessTransactionResponse> {
    try {
      // Get or create smart account
      const smartAccountData = 
        await this.createSmartAccount(ownerAddress);

      const smartAccount = this.smartAccounts.get(ownerAddress);
      if (!smartAccount) {
        throw new Error('Smart account not found');
      }

      // Prepare transaction data
      const txs = transactions.map(tx => ({
        to: tx.to,
        data: tx.data || '0x',
        value: tx.value || '0',
      }));

      // Execute transaction with paymaster
      const userOpResponse = await smartAccount.sendTransaction(txs, {
        paymasterServiceData: {
          mode: PaymasterMode.SPONSORED,
        },
      });

      const { transactionHash } = await userOpResponse.waitForTxHash();
      const receipt = await userOpResponse.wait();

      logger.info('Gasless transaction executed', {
        owner: ownerAddress,
        smartAccount: smartAccountData.address,
        transactionHash,
        gasUsed: receipt.actualGasUsed?.toString(),
      });

      return {
        success: true,
        status: 'SUCCESS',
        transactionHash,
        userOpHash: userOpResponse.userOpHash,
        receipt,
      };
    } catch (error) {
      logger.error('Error executing gasless transaction:', error);
 return {
        success: false,
        status: 'FAILED',
        userOpHash: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get smart account balance
   */
  async getSmartAccountBalance(smartAccountAddress: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(smartAccountAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting smart account balance:', error);
      return '0';
    }
  }

  /**
   * Check if smart account is deployed
   */
  async isSmartAccountDeployed(smartAccountAddress: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(smartAccountAddress);
      return code !== '0x';
    } catch (error) {
      logger.error('Error checking smart account deployment:', error);
      return false;
    }
  }

  /**
   * Get smart account nonce
   */
  async getSmartAccountNonce(smartAccountAddress: string): Promise<number> {
    try {
      const smartAccount = this.smartAccounts.get(smartAccountAddress);
      if (smartAccount) {
        const nonce = await smartAccount.getNonce();
        return Number(nonce);
      }
      return 0;
    } catch (error) {
      logger.error('Error getting smart account nonce:', error);
      return 0;
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(
    ownerAddress: string,
    transactions: GaslessTransactionRequest[]
  ): Promise<{ gasLimit: string; gasPrice: string }> {
    try {
      const smartAccount = this.smartAccounts.get(ownerAddress);
      if (!smartAccount) {
        throw new Error('Smart account not found');
      }

      const txs = transactions.map(tx => ({
        to: tx.to,
        data: tx.data || '0x',
        value: tx.value || '0',
      }));

      // Build user operation to estimate gas
      const userOp = await smartAccount.buildUserOp(txs);
      
      // Get gas estimates
      const gasLimit = userOp.callGasLimit || '0';
      const gasPrice = await this.provider.getFeeData();

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0',
      };
    } catch (error) {
      logger.error('Error estimating gas:', error);
      throw new Error('Failed to estimate gas');
    }
  }

  /**
   * Get transaction status by user operation hash
   */
  async getTransactionStatus(userOpHash: string): Promise<{
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    transactionHash?: string;
    receipt?: any;
  }> {
    try {
      // This would typically query the bundler for user operation status
      // For now, we'll return a basic implementation
      logger.info(`Checking status for user operation: ${userOpHash}`);
      
      return {
        status: 'PENDING',
      };
    } catch (error) {
      logger.error('Error getting transaction status:', error);
      return {
        status: 'FAILED',
      };
    }
  }

  /**
   * Clear cached smart account (useful for testing)
   */
  clearSmartAccountCache(smartAccountAddress?: string): void {
    if (smartAccountAddress) {
      this.smartAccounts.delete(smartAccountAddress);
    } else {
      this.smartAccounts.clear();
    }
  }
}

// Export singleton instance
export const biconomyService = new BiconomyService();
export default biconomyService;