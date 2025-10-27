import { ethers } from "ethers";
import { IProvider } from "@web3auth/base";
import { chainConfig } from "./web3auth";

// Note: We'll implement a simplified version without Biconomy SDK for now
// This can be enhanced later with the actual Biconomy SDK when available

export interface SmartAccount {
  address: string;
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
}

export class BiconomyService {
  private smartAccount: SmartAccount | null = null;
  private readonly apiKey: string;
  private readonly bundlerUrl: string;
  private readonly paymasterUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_BICONOMY_API_KEY;
    this.bundlerUrl = `https://bundler.biconomy.io/api/v2/${chainConfig.chainId}/${this.apiKey}`;
    this.paymasterUrl = `https://paymaster.biconomy.io/api/v1/${chainConfig.chainId}/${this.apiKey}`;
  }

  async createSmartAccount(web3AuthProvider: IProvider): Promise<SmartAccount> {
    try {
      // Get private key from Web3Auth
      const privateKey = await web3AuthProvider.request({
        method: "eth_private_key",
      }) as string;

      // Create ethers provider and signer
      const provider = new ethers.JsonRpcProvider(chainConfig.rpcTarget);
      const signer = new ethers.Wallet(privateKey, provider);

      // For now, we'll use the EOA address directly
      // In a full implementation, this would be the smart account address
      const address = await signer.getAddress();

      this.smartAccount = {
        address,
        provider,
        signer,
      };

      return this.smartAccount;
    } catch (error) {
      console.error("Failed to create smart account:", error);
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
      // For now, execute as regular transaction
      // In full implementation, this would use Biconomy's gasless execution
      const tx = await this.smartAccount.signer.sendTransaction({
        to,
        data,
        value: ethers.parseEther(value),
      });

      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Transaction execution failed:", error);
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
      // For now, execute transactions sequentially
      // In full implementation, this would be a single batch transaction
      let lastTxHash = "";
      
      for (const tx of transactions) {
        const result = await this.executeTransaction(
          tx.to,
          tx.data,
          tx.value || "0"
        );
        lastTxHash = result;
      }

      return lastTxHash;
    } catch (error) {
      console.error("Batch transaction execution failed:", error);
      throw error;
    }
  }

  async getBalance(tokenAddress?: string): Promise<string> {
    if (!this.smartAccount) {
      throw new Error("Smart account not initialized");
    }

    try {
      if (!tokenAddress) {
        // Get ETH balance
        const balance = await this.smartAccount.provider.getBalance(
          this.smartAccount.address
        );
        return ethers.formatEther(balance);
      } else {
        // Get ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
          ],
          this.smartAccount.provider
        );

        const balance = await tokenContract.balanceOf(this.smartAccount.address);
        const decimals = await tokenContract.decimals();
        return ethers.formatUnits(balance, decimals);
      }
    } catch (error) {
      console.error("Failed to get balance:", error);
      throw error;
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
        from: this.smartAccount.address,
      });

      return ethers.formatUnits(gasEstimate, "gwei");
    } catch (error) {
      console.error("Gas estimation failed:", error);
      throw error;
    }
  }

  // Helper method to create approve + bet transaction data
  async createApproveAndBetTransaction(
    tokenAddress: string,
    predictionMarketAddress: string,
    amount: string,
    eventId: number,
    prediction: number
  ): Promise<Array<{ to: string; data: string; value?: string }>> {
    try {
      // Create approve transaction data
      const approveInterface = new ethers.Interface([
        "function approve(address spender, uint256 amount)",
      ]);
      
      const approveData = approveInterface.encodeFunctionData("approve", [
        predictionMarketAddress,
        ethers.parseUnits(amount, 6), // Assuming 6 decimals for USDC
      ]);

      // Create bet transaction data
      const betInterface = new ethers.Interface([
        "function placeBet(uint256 eventId, uint8 prediction, uint256 amount)",
      ]);
      
      const betData = betInterface.encodeFunctionData("placeBet", [
        eventId,
        prediction,
        ethers.parseUnits(amount, 6),
      ]);

      return [
        {
          to: tokenAddress,
          data: approveData,
        },
        {
          to: predictionMarketAddress,
          data: betData,
        },
      ];
    } catch (error) {
      console.error("Failed to create approve and bet transaction:", error);
      throw error;
    }
  }
}

export const biconomyService = new BiconomyService();