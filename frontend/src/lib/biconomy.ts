import { ethers } from "ethers";
import { IProvider } from "@web3auth/base";
import { chainConfig } from "./web3auth";

// Note: We'll implement a simplified version without Biconomy SDK for now
// This can be enhanced later with the actual Biconomy SDK when available

export interface SmartAccount {
  address: string;
  provider: ethers.AbstractProvider;
  signer: ethers.Signer;
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
          // For MetaMask adapter, we need to handle the connection differently
          const browserProvider = new ethers.BrowserProvider(web3AuthProvider as any);
          
          // Get accounts directly from the provider instead of using getSigner()
          const accounts = await web3AuthProvider.request({
            method: "eth_accounts",
          }) as string[];
          
          if (!accounts || accounts.length === 0) {
            throw new Error("No accounts available");
          }

          // Create a signer using the first account
          signer = await browserProvider.getSigner(accounts[0]);
          provider = browserProvider;
        } catch (metaMaskError) {
          console.error("MetaMask connection failed:", metaMaskError);
          // Final fallback - try direct BrowserProvider approach
          const browserProvider = new ethers.BrowserProvider(web3AuthProvider as any);
          provider = browserProvider;
          
          // Create a basic signer without requesting accounts
          signer = new ethers.VoidSigner(
            await web3AuthProvider.request({ method: "eth_accounts" }).then((accounts: string[]) => accounts[0]),
            provider
          );
        }
      }

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
      
      // Prepare value outside of nested blocks so it is available for error flows
      const valueInWei = value === "0" ? 0n : ethers.parseEther(value);
      
      console.log("Executing transaction:", {
        to,
        data: data.substring(0, 10) + "...",
        value: valueInWei.toString(),
        from: this.smartAccount.address
      });

      // Create a clean transaction request for MetaMask
      const txRequest: any = {
        to: to,
        data: data,
        value: valueInWei,
      };

      // Estimate gas and set it on the transaction with a buffer
      try {
        const gasEstimate = await this.smartAccount.signer.estimateGas(txRequest);
        console.log("Gas estimate:", gasEstimate.toString());
        
        // Add 20% buffer to gas estimate to account for network conditions
        const gasWithBuffer = (gasEstimate * 120n) / 100n;
        txRequest.gasLimit = gasWithBuffer;
        console.log("Gas limit set:", gasWithBuffer.toString());
      } catch (gasError) {
        console.warn("Gas estimation failed:", gasError);
        // If gas estimation fails, let MetaMask handle it
      }

      // Explicitly set nonce and gas price (helps some RPCs like BSC)
      try {
        const nonce = await this.smartAccount.provider.getTransactionCount(this.smartAccount.address, "pending");
        (txRequest as any).nonce = nonce;

        const feeData = await this.smartAccount.provider.getFeeData();
        // Use legacy gasPrice on BSC and enforce a reasonable floor (e.g., 10 gwei)
        const MIN_GAS_PRICE = 10_000_000_000n; // 10 gwei
        if (feeData.gasPrice != null) {
          let gasPrice = feeData.gasPrice as bigint;
          if (gasPrice < MIN_GAS_PRICE) {
            gasPrice = MIN_GAS_PRICE;
          }
          (txRequest as any).gasPrice = gasPrice;
          console.log("Gas price set:", gasPrice.toString());
        } else if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          (txRequest as any).maxFeePerGas = feeData.maxFeePerGas;
          (txRequest as any).maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
          console.log("EIP-1559 fees set:", {
            maxFeePerGas: feeData.maxFeePerGas.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString()
          });
        }
      } catch (feeError) {
        console.warn("Failed to set nonce/gas price:", feeError);
      }

      // Log the exact transaction request being sent
      console.log("Transaction request:", JSON.stringify({
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value.toString(),
      }, null, 2));

      const tx = await this.smartAccount.signer.sendTransaction(txRequest);
      console.log("Transaction sent:", tx.hash);

      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt?.blockNumber);
      
      return tx.hash;
    } catch (error) {
      console.error("Transaction execution failed:", error);
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
      if (!this.smartAccount) {
        throw new Error("Smart account not initialized");
      }

      const amountWei = ethers.parseUnits(amount, 6);
      const transactions: Array<{ to: string; data: string; value?: string }> = [];

      // Always check current allowance fresh from the blockchain
      const usdcInterface = new ethers.Interface([
        "function allowance(address owner, address spender) view returns (uint256)",
      ]);
      
      const allowanceData = usdcInterface.encodeFunctionData("allowance", [
        this.smartAccount.address,
        predictionMarketAddress,
      ]);

      try {
        console.log("Checking current allowance from blockchain...");
        const allowanceResult = await this.smartAccount.provider.call({
          to: tokenAddress,
          data: allowanceData,
        });
        
        const currentAllowance = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256"],
          allowanceResult
        )[0];

        console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
        console.log(`Required amount: ${amount} USDC`);

        // Only create approval transaction if allowance is insufficient
        if (currentAllowance < amountWei) {
          console.log("Insufficient allowance, creating approval transaction");
          
          const approveInterface = new ethers.Interface([
            "function approve(address spender, uint256 amount)",
          ]);
          
          const approveData = approveInterface.encodeFunctionData("approve", [
            predictionMarketAddress,
            amountWei,
          ]);

          transactions.push({
            to: tokenAddress,
            data: approveData,
          });
        } else {
          console.log("Sufficient allowance exists, skipping approval transaction");
        }
      } catch (error) {
        console.warn("Failed to check allowance, including approval transaction as fallback:", error);
        
        // Fallback: include approval transaction if we can't check allowance
        const approveInterface = new ethers.Interface([
          "function approve(address spender, uint256 amount)",
        ]);
        
        const approveData = approveInterface.encodeFunctionData("approve", [
          predictionMarketAddress,
          amountWei,
        ]);

        transactions.push({
          to: tokenAddress,
          data: approveData,
        });
      }

      // Create bet transaction data
      const betInterface = new ethers.Interface([
        "function placeBet(uint256 eventId, uint8 prediction, uint256 amount)",
      ]);
      
      const betData = betInterface.encodeFunctionData("placeBet", [
        eventId,
        prediction,
        amountWei,
      ]);

      transactions.push({
        to: predictionMarketAddress,
        data: betData,
      });

      console.log(`Created ${transactions.length} transaction(s) for betting`);
      return transactions;
    } catch (error) {
      console.error("Failed to create approve and bet transaction:", error);
      throw error;
    }
  }
}

export const biconomyService = new BiconomyService();