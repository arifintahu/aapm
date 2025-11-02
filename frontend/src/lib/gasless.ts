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
                await new Promise(resolve => setTimeout(resolve, 500));
                retryCount++;
              }
            } catch (accountError) {
              await new Promise(resolve => setTimeout(resolve, 500));
              retryCount++;
            }
          }

          if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found after retries - Web3Auth may not be fully initialized");
          }
          provider = browserProvider;
          signer = await browserProvider.getSigner(accounts[0]);
        } catch (error) {
          console.error("Failed to create browser provider:", error);
          throw new Error("Failed to initialize Web3 provider");
        }
      }

      // Use the smart account address from parameter if available, otherwise use signer address
      const address = smartAccountAddress || await signer.getAddress();
      
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
        const nonce = hashResult.data.nonce; // Store the nonce for later use
        
        // Step 2: Sign the transaction hash with user's wallet
        let signature: string;
        let signingMethod = 'unknown';
        
        try {
          // First try eth_sign (raw signing without prefix) - this is what we want
          console.log('Attempting eth_sign with hash:', txHashToSign);
          signature = await (this.smartAccount.signer.provider as ethers.JsonRpcProvider).send("eth_sign", [
            await this.smartAccount.signer.getAddress(),
            txHashToSign
          ]);
          signingMethod = 'eth_sign';
          console.log('Successfully signed with eth_sign');
        } catch (ethSignError) {
          console.log('eth_sign failed:', ethSignError.message);
          try {
            // Fallback to personal_sign
            console.log('Attempting personal_sign with hash:', txHashToSign);
            signature = await (this.smartAccount.signer.provider as ethers.JsonRpcProvider).send("personal_sign", [
              txHashToSign,
              await this.smartAccount.signer.getAddress()
            ]);
            signingMethod = 'personal_sign';
            console.log('Successfully signed with personal_sign');
          } catch (personalSignError) {
            console.log('personal_sign failed:', personalSignError.message);
            try {
              // Try signTypedData for EIP-712 structured data (Web3Auth should support this)
              console.log('Attempting signTypedData for EIP-712 structured data');
              
              // We need to reconstruct the EIP-712 domain and message from the hash
              // Since we have the final hash, we need to work backwards to create the typed data
              // This is complex, so let's try a simpler approach first
              
              // Try eth_signTypedData_v4
              const typedData = {
                types: {
                  EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' }
                  ],
                  BatchTransaction: [
                    { name: 'to', type: 'address[]' },
                    { name: 'values', type: 'uint256[]' },
                    { name: 'data', type: 'bytes32[]' },
                    { name: 'nonce', type: 'uint256' }
                  ]
                },
                primaryType: 'BatchTransaction',
                domain: {
                  name: 'SmartAccount',
                  version: '1',
                  chainId: this.getNumericChainId(),
                  verifyingContract: this.smartAccount.address
                },
                message: {
                  to: [to],
                  values: [value],
                  data: [ethers.keccak256(ethers.getBytes(data))],
                  nonce: parseInt(nonce)
                }
              };
              
              signature = await (this.smartAccount.signer.provider as ethers.JsonRpcProvider).send("eth_signTypedData_v4", [
                await this.smartAccount.signer.getAddress(),
                JSON.stringify(typedData)
              ]);
              signingMethod = 'signTypedData';
              console.log('Successfully signed with signTypedData');
            } catch (signTypedDataError) {
              console.log('signTypedData failed:', signTypedDataError.message);
              try {
                // Last resort: signMessage (adds prefix, but we'll send the signing method to backend)
                console.log('Attempting signMessage with hash bytes');
                const hashBytes = ethers.getBytes(txHashToSign);
                signature = await this.smartAccount.signer.signMessage(hashBytes);
                signingMethod = 'signMessage';
                console.log('Successfully signed with signMessage');
              } catch (signMessageError) {
                console.log('signMessage failed:', signMessageError.message);
                throw new Error(`All signing methods failed. Last error: ${signMessageError.message}`);
              }
            }
          }
        }
        
        // Ensure signature has 0x prefix
        if (!signature.startsWith('0x')) {
          signature = '0x' + signature;
        }
        
        // Check signature length and format
        console.log('Raw signature:', signature);
        console.log('Signature length:', signature.length);
        
        // Ensure signature is 65 bytes (130 hex chars + 0x prefix = 132 total)
        if (signature.length === 130) {
          // Missing 0x prefix, add it
          signature = '0x' + signature;
        }
        
        if (signature.length === 130) {
          // 64 bytes - missing recovery ID, need to add it
          console.log('Signature missing recovery ID, attempting to recover it...');
          
          // Try to recover the correct v value
          // For signMessage, we need to use the prefixed hash for recovery
          let messageHashForRecovery;
          if (signingMethod === 'signMessage') {
            // signMessage adds Ethereum message prefix, so we need to use the prefixed hash for recovery
            messageHashForRecovery = ethers.hashMessage(ethers.getBytes(txHashToSign));
          } else {
            // For other methods, use the raw hash
            messageHashForRecovery = ethers.getBytes(txHashToSign);
          }
          
          for (let recovery = 0; recovery <= 1; recovery++) {
            const testSig = signature + (recovery + 27).toString(16).padStart(2, '0');
            try {
              const recoveredAddress = ethers.recoverAddress(messageHashForRecovery, testSig);
              const signerAddress = await this.smartAccount.signer.getAddress();
              if (recoveredAddress.toLowerCase() === signerAddress.toLowerCase()) {
                signature = testSig;
                console.log('Successfully recovered signature with v =', recovery + 27);
                break;
              }
            } catch (e) {
              // Continue trying
            }
          }
        }
        
        console.log('Final signature:', signature);
        console.log('Signing method used:', signingMethod);
        console.log('Final signature length:', signature.length);
        
        // Step 3: Send the signed transaction to backend
        const response = await fetch(`${this.backendUrl}/api/betting/send-bundle`, {
          method: 'POST',
          headers: backendAuthService.getAuthHeaders(),
          body: JSON.stringify({
            ownerAddress,
            transactions: [{ to, data, value }],
            signature,
            signingMethod, // Include the signing method so backend can handle different formats
            nonce // Include the nonce to ensure consistent hash calculation
          })
        });

        if (response.ok) {
          const result = await response.json();
          return result.data.txHash;
        } else {
          // If gasless transaction fails, throw an error instead of falling back to EOA
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Gasless transaction failed: ${errorData.error || response.statusText}`);
        }
      } else {
        throw new Error('Failed to get transaction hash from backend');
      }
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
      
      // Step 1: Get transaction hash to sign from backend for batch transactions
      const hashResponse = await fetch(`${this.backendUrl}/api/betting/get-tx-hash`, {
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

      if (hashResponse.ok) {
        const hashResult = await hashResponse.json();
        const txHashToSign = hashResult.data.txHash;
        const nonce = hashResult.data.nonce; // Store the nonce for later use
        
        // Step 2: Sign the transaction hash with user's wallet
        let signature: string;
        let signingMethod = 'unknown';
        
        try {
          // First try eth_signTypedData_v4 for EIP-712 structured data
          console.log('Attempting eth_signTypedData_v4 with structured data');
          const typedData = {
            types: {
              EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" }
              ],
              BatchTransaction: [
                { name: "to", type: "address[]" },
                { name: "data", type: "bytes[]" },
                { name: "value", type: "uint256[]" },
                { name: "nonce", type: "uint256" }
              ]
            },
            primaryType: "BatchTransaction",
            domain: {
              name: "SmartAccount",
              version: "1",
              chainId: this.getNumericChainId(),
              verifyingContract: this.smartAccount.address
            },
            message: {
              to: transactions.map(tx => tx.to),
              data: transactions.map(tx => tx.data),
              value: transactions.map(tx => tx.value || '0'),
              nonce: hashResult.data.nonce || 0
            }
          };
          
          signature = await (this.smartAccount.signer.provider as ethers.JsonRpcProvider).send("eth_signTypedData_v4", [
            await this.smartAccount.signer.getAddress(),
            JSON.stringify(typedData)
          ]);
          signingMethod = 'eth_signTypedData_v4';
          console.log('Successfully signed with eth_signTypedData_v4');
        } catch (typedDataError) {
          console.log('eth_signTypedData_v4 failed:', typedDataError.message);
          try {
            // Fallback to eth_sign (raw signing without prefix)
            console.log('Attempting eth_sign with hash:', txHashToSign);
            signature = await (this.smartAccount.signer.provider as ethers.JsonRpcProvider).send("eth_sign", [
              await this.smartAccount.signer.getAddress(),
              txHashToSign
            ]);
            signingMethod = 'eth_sign';
            console.log('Successfully signed with eth_sign');
          } catch (ethSignError) {
            console.log('eth_sign failed:', ethSignError.message);
            try {
              // Fallback to personal_sign
              console.log('Attempting personal_sign with hash:', txHashToSign);
              signature = await (this.smartAccount.signer.provider as ethers.JsonRpcProvider).send("personal_sign", [
                txHashToSign,
                await this.smartAccount.signer.getAddress()
              ]);
              signingMethod = 'personal_sign';
              console.log('Successfully signed with personal_sign');
            } catch (personalSignError) {
              console.log('personal_sign failed:', personalSignError.message);
              try {
                // Last resort: signMessage (adds prefix)
                console.log('Attempting signMessage with hash bytes');
                const hashBytes = ethers.getBytes(txHashToSign);
                console.log('Hash bytes to sign:', ethers.hexlify(hashBytes));
                console.log('Original hash:', txHashToSign);
                signature = await this.smartAccount.signer.signMessage(hashBytes);
                signingMethod = 'signMessage';
                console.log('Successfully signed with signMessage');
              } catch (signMessageError) {
                console.log('signMessage failed:', signMessageError.message);
                throw new Error(`All signing methods failed. Last error: ${signMessageError.message}`);
              }
            }
          }
        }
        
        // Ensure signature has 0x prefix
        if (!signature.startsWith('0x')) {
          signature = '0x' + signature;
        }
        
        // Check signature length and format
        console.log('Raw signature:', signature);
        console.log('Signature length:', signature.length);
        
        // Ensure signature is 65 bytes (130 hex chars + 0x prefix = 132 total)
        if (signature.length === 130) {
          // Missing 0x prefix, add it
          signature = '0x' + signature;
        }
        
        if (signature.length === 130) {
          // 64 bytes - missing recovery ID, need to add it
          console.log('Signature missing recovery ID, attempting to recover it...');
          
          // Try to recover the correct v value
          // For signMessage, we need to use the prefixed hash for recovery
          let messageHashForRecovery;
          if (signingMethod === 'signMessage') {
            // signMessage adds Ethereum message prefix, so we need to use the prefixed hash for recovery
            messageHashForRecovery = ethers.hashMessage(ethers.getBytes(txHashToSign));
          } else {
            // For other methods, use the raw hash
            messageHashForRecovery = ethers.getBytes(txHashToSign);
          }
          
          for (let recovery = 0; recovery <= 1; recovery++) {
            const testSig = signature + (recovery + 27).toString(16).padStart(2, '0');
            try {
              const recoveredAddress = ethers.recoverAddress(messageHashForRecovery, testSig);
              const signerAddress = await this.smartAccount.signer.getAddress();
              if (recoveredAddress.toLowerCase() === signerAddress.toLowerCase()) {
                signature = testSig;
                console.log('Successfully recovered signature with v =', recovery + 27);
                break;
              }
            } catch (e) {
              // Continue trying
            }
          }
        }
        
        console.log('Final signature:', signature);
        console.log('Signing method used:', signingMethod);
        console.log('Final signature length:', signature.length);
        
        // Step 3: Send the signed transaction to backend
        const response = await fetch(`${this.backendUrl}/api/betting/send-bundle`, {
          method: 'POST',
          headers: backendAuthService.getAuthHeaders(),
          body: JSON.stringify({
            ownerAddress,
            transactions: transactions.map(tx => ({
              to: tx.to,
              data: tx.data,
              value: tx.value || '0'
            })),
            signature,
            signingMethod, // Include the signing method so backend can handle different formats
            nonce // Include the nonce to ensure consistent hash calculation
          })
        });

        if (response.ok) {
          const result = await response.json();
          return result.data.txHash;
        } else {
          // If gasless transaction fails, throw an error instead of falling back to EOA
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Gasless transaction failed: ${errorData.error || response.statusText}`);
        }
      } else {
        throw new Error('Failed to get transaction hash from backend');
      }
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
    const amountWei = ethers.parseUnits(amount, 6); // USDC uses 6 decimals
    
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
      "function placeBet(uint256 eventId, uint8 prediction, uint256 amount)"
    ]);
    const betData = betInterface.encodeFunctionData("placeBet", [
      eventId,
      prediction, // prediction is already 1 for Yes, 2 for No
      amountWei
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