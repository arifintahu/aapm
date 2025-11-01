import { ethers } from "ethers";
import { IProvider } from "@web3auth/base";
import { chainConfig } from "./web3auth";
import { backendAuthService } from "./backend-auth";

export interface SmartAccount {
  address: string;
  provider: ethers.AbstractProvider;
  signer: ethers.Signer;
}

export interface GaslessTransactionRequest {
  to: string;
  data: string;
  value?: string;
  signature?: string;
}

export interface GaslessExecutionResult {
  txHash: string;
  smartAccount: string;
}

export class GaslessService {
  private smartAccount: SmartAccount | null = null;
  private readonly backendUrl: string;

  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
  }

  // OLD METHOD - REMOVED TO PREVENT 401 ERRORS
  // This method was making API calls to /api/auth/smart-account which requires authentication
  // Use createSmartAccountFromProvider instead

  async createSmartAccountFromProvider(web3AuthProvider: IProvider, smartAccountAddress?: string): Promise<SmartAccount> {
    try {
      console.log(`[${new Date().toISOString()}] Creating smart account from provider (NEW METHOD)...`, { smartAccountAddress });
      
      let provider: ethers.AbstractProvider;
      let signer: ethers.Signer;

      // Try to use embedded Web3Auth private key (OpenLogin)
      try {
        const privateKey = await web3AuthProvider.request({
          method: "eth_private_key",
        }) as string;

        provider = new ethers.JsonRpcProvider(chainConfig.rpcTarget);
        signer = new ethers.Wallet(privateKey, provider);
      } catch {
        // Fallback to EIP-1193 provider (MetaMask via Web3Auth adapter)
        try {
          const browserProvider = new ethers.BrowserProvider(web3AuthProvider as any);
          
          // Retry logic for getting accounts during page reload
          let accounts: string[] = [];
          let retryCount = 0;
          const maxRetries = 5;
          
          while ((!accounts || accounts.length === 0) && retryCount < maxRetries) {
            try {
              accounts = await web3AuthProvider.request({
                method: "eth_accounts",
              }) as string[];
              
              if (!accounts || accounts.length === 0) {
                console.log(`Attempt ${retryCount + 1}: No accounts found, retrying in 500ms...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                retryCount++;
              }
            } catch (accountError) {
              console.log(`Attempt ${retryCount + 1}: Error getting accounts:`, accountError);
              await new Promise(resolve => setTimeout(resolve, 500));
              retryCount++;
            }
          }

          if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found after retries - Web3Auth may not be fully initialized");
          }

          console.log(`Successfully retrieved accounts after ${retryCount} retries:`, accounts);
          provider = browserProvider;
          signer = await browserProvider.getSigner(accounts[0]);
        } catch (error) {
          console.error("Failed to create browser provider:", error);
          throw new Error("Failed to initialize Web3 provider");
        }
      }

      // Use the smart account address from parameter if available, otherwise use signer address
      const address = smartAccountAddress || await signer.getAddress();
      
      console.log("Smart account created from provider:", { address, smartAccountAddress });
      
      this.smartAccount = {
        address,
        provider,
        signer
      };

      return this.smartAccount;
    } catch (error) {
      console.error("Error creating smart account from provider:", error);
      throw error;
    }
  }

  async executeTransaction(
    to: string,
    data: string,
    value: string = "0"
  ): Promise<string> {
    if (!this.smartAccount) {
      throw new Error("Smart account not initialized");
    }

    try {
      // Try backend gasless execution first
      const ownerAddress = await this.smartAccount.signer.getAddress();
      
      // Step 1: Get transaction hash to sign from backend
      const hashResponse = await fetch(`${this.backendUrl}/api/betting/get-tx-hash`, {
        method: 'POST',
        headers: backendAuthService.getAuthHeaders(),
        body: JSON.stringify({
          ownerAddress,
          to,
          data,
          value
        })
      });

      if (hashResponse.ok) {
        const hashResult = await hashResponse.json();
        const txHashToSign = hashResult.data.txHash;
        
        // Step 2: Sign the transaction hash with user's wallet (raw signature without message prefix)
        const signature = await this.smartAccount.signer.provider!.send("eth_sign", [
          await this.smartAccount.signer.getAddress(),
          txHashToSign
        ]);
        
        // Step 3: Send the signed transaction to backend
        const response = await fetch(`${this.backendUrl}/api/betting/send-bundle`, {
          method: 'POST',
          headers: backendAuthService.getAuthHeaders(),
          body: JSON.stringify({
            ownerAddress,
            transactions: [{ to, data, value }],
            signature
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Backend gasless execution successful:', result.data.txHash);
          return result.data.txHash;
        }
      }

      // Fallback to direct EOA transaction
      console.log('⚠️ Backend gasless failed, falling back to EOA transaction');
      const tx = await this.smartAccount.signer.sendTransaction({
        to,
        data,
        value: ethers.parseEther(value || "0")
      });

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return receipt.hash;
    } catch (error) {
      console.error("Error executing transaction:", error);
      throw error;
    }
  }

  async executeBatchTransaction(transactions: Array<{
    to: string;
    data: string;
    value?: string;
  }>): Promise<string> {
    if (!this.smartAccount) {
      throw new Error("Smart account not initialized");
    }

    try {
      // Try backend gasless execution first
      const ownerAddress = await this.smartAccount.signer.getAddress();
      
      const response = await fetch(`${this.backendUrl}/api/betting/send-bundle`, {
        method: 'POST',
        headers: backendAuthService.getAuthHeaders(),
        body: JSON.stringify({
          ownerAddress,
          transactions: transactions.map(tx => ({
            to: tx.to,
            data: tx.data,
            value: tx.value || '0'
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Backend gasless batch execution successful:', result.data.txHash);
        return result.data.txHash;
      }

      // Fallback to sequential EOA transactions
      console.log('⚠️ Backend gasless failed, falling back to sequential EOA transactions');
      let lastTxHash = '';
      
      for (const tx of transactions) {
        const transaction = await this.smartAccount.signer.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: ethers.parseEther(tx.value || "0")
        });

        const receipt = await transaction.wait();
        if (!receipt) {
          throw new Error(`Transaction failed: ${tx.to}`);
        }
        lastTxHash = receipt.hash;
      }

      return lastTxHash;
    } catch (error) {
      console.error("Error executing batch transaction:", error);
      throw error;
    }
  }

  async getBalance(tokenAddress?: string): Promise<string> {
    if (!this.smartAccount) {
      throw new Error("Smart account not initialized");
    }

    try {
      if (tokenAddress) {
        // ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function balanceOf(address) view returns (uint256)"],
          this.smartAccount.provider
        );
        const balance = await tokenContract.balanceOf(this.smartAccount.address);
        return ethers.formatUnits(balance, 18);
      } else {
        // Native token balance
        const balance = await this.smartAccount.provider.getBalance(this.smartAccount.address);
        return ethers.formatEther(balance);
      }
    } catch (error) {
      console.error("Error getting balance:", error);
      return "0";
    }
  }

  getSmartAccount(): SmartAccount | null {
    return this.smartAccount;
  }

  getAddress(): string | null {
    return this.smartAccount?.address || null;
  }

  async estimateGas(
    to: string,
    data: string,
    value: string = "0"
  ): Promise<string> {
    if (!this.smartAccount) {
      throw new Error("Smart account not initialized");
    }

    try {
      const gasEstimate = await this.smartAccount.provider.estimateGas({
        to,
        data,
        value: ethers.parseEther(value),
        from: this.smartAccount.address
      });
      
      return gasEstimate.toString();
    } catch (error) {
      console.error("Error estimating gas:", error);
      return "21000"; // Default gas limit
    }
  }

  async createApproveAndBetTransaction(
    tokenAddress: string,
    predictionMarketAddress: string,
    amount: string,
    eventId: number,
    prediction: number
  ): Promise<Array<{ to: string; data: string; value?: string }>> {
    const amountWei = ethers.parseUnits(amount, 18);
    
    // Create approve transaction
    const approveInterface = new ethers.Interface([
      "function approve(address spender, uint256 amount)"
    ]);
    const approveData = approveInterface.encodeFunctionData("approve", [
      predictionMarketAddress,
      amountWei
    ]);

    // Create bet transaction
    const betInterface = new ethers.Interface([
      "function placeBet(uint256 eventId, bool betYes)"
    ]);
    const betData = betInterface.encodeFunctionData("placeBet", [
      eventId,
      prediction === 1
    ]);

    return [
      {
        to: tokenAddress,
        data: approveData,
        value: "0"
      },
      {
        to: predictionMarketAddress,
        data: betData,
        value: "0"
      }
    ];
  }

  async approveAndBet(
    tokenAddress: string,
    predictionMarketAddress: string,
    amount: string,
    eventId: number,
    prediction: number
  ): Promise<string> {
    const transactions = await this.createApproveAndBetTransaction(
      tokenAddress,
      predictionMarketAddress,
      amount,
      eventId,
      prediction
    );

    return this.executeBatchTransaction(transactions);
  }

  private getNumericChainId(): number {
    return parseInt(chainConfig.chainId, 16);
  }
}

export const gaslessService = new GaslessService();