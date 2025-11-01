import { ethers } from "ethers";
import { chainConfig } from "./web3auth";
import { PREDICTION_MARKET_ABI, MOCK_USDC_ABI } from "./contract-abis";

// Contract addresses - deployed on BSC Testnet
export const CONTRACT_ADDRESSES = {
  PREDICTION_MARKET: import.meta.env.VITE_PREDICTION_MARKET_ADDRESS || "0x38E5165811670837042c8ccaDE0Be7380D15eFfe",
  MOCK_USDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc",
};

// Network configuration
export const NETWORK_CONFIG = {
  chainId: chainConfig.chainId,
  name: chainConfig.displayName,
  rpcUrl: chainConfig.rpcTarget,
  blockExplorer: chainConfig.blockExplorerUrl,
};

// Enums
export enum EventStatus {
  Active = 0,
  Resolved = 1,
}

export enum Outcome {
  None = 0,
  Yes = 1,
  No = 2,
}

// Types
export interface PredictionEvent {
  id: number;
  question: string;
  endTime: bigint;
  status: EventStatus;
  result: Outcome;
  totalYesBets: bigint;
  totalNoBets: bigint;
  totalPool: bigint;
}

export interface Bet {
  eventId: bigint;
  bettor: string;
  prediction: Outcome;
  amount: bigint;
  claimed: boolean;
}

export interface UserBet extends Bet {
  potentialWinnings?: bigint;
  isWinner?: boolean;
}

// Contract service class
export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer | null = null;
  private predictionMarketContract: ethers.Contract | null = null;
  private mockUSDCContract: ethers.Contract | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
  }

  setSigner(signer: ethers.Signer) {
    this.signer = signer;
    
    if (CONTRACT_ADDRESSES.PREDICTION_MARKET) {
      this.predictionMarketContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PREDICTION_MARKET,
        PREDICTION_MARKET_ABI,
        signer
      );
    }

    if (CONTRACT_ADDRESSES.MOCK_USDC) {
      this.mockUSDCContract = new ethers.Contract(
        CONTRACT_ADDRESSES.MOCK_USDC,
        MOCK_USDC_ABI,
        signer
      );
    }
  }

  setContractAddresses(predictionMarket: string, mockUSDC: string) {
    CONTRACT_ADDRESSES.PREDICTION_MARKET = predictionMarket;
    CONTRACT_ADDRESSES.MOCK_USDC = mockUSDC;

    if (this.signer) {
      this.predictionMarketContract = new ethers.Contract(
        predictionMarket,
        PREDICTION_MARKET_ABI,
        this.signer
      );

      this.mockUSDCContract = new ethers.Contract(
        mockUSDC,
        MOCK_USDC_ABI,
        this.signer
      );
    }
  }

  // Prediction Market methods
  async getEventCount(): Promise<number> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const count = await this.predictionMarketContract.eventCounter();
    return Number(count);
  }

  async getEvent(eventId: number): Promise<PredictionEvent> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }
    // Use the events mapping directly like in the contract scripts
    const event = await this.predictionMarketContract.events(eventId);
    return {
      id: eventId,
      question: event.question,
      endTime: event.endTime,
      status: event.status,
      result: event.result,
      totalYesBets: event.totalYesBets,
      totalNoBets: event.totalNoBets,
      totalPool: event.totalPool,
    };
  }

  async getUserBets(eventId: number, userAddress: string): Promise<UserBet[]> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const bets = await this.predictionMarketContract.getUserEventBets(eventId, userAddress);
    return bets.map((bet: any) => ({
      eventId: bet.eventId,
      bettor: bet.bettor,
      prediction: bet.prediction,
      amount: bet.amount,
      claimed: bet.claimed,
    }));
  }

  async calculatePotentialWinnings(
    eventId: number,
    prediction: Outcome,
    amount: string
  ): Promise<string> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const amountWei = ethers.parseUnits(amount, 6);
    const winnings = await this.predictionMarketContract.calculatePotentialWinnings(
      eventId,
      prediction,
      amountWei
    );
    
    return ethers.formatUnits(winnings, 6);
  }

  async placeBet(eventId: number, prediction: Outcome, amount: string): Promise<string> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await this.predictionMarketContract.placeBet(eventId, prediction, amountWei);
    await tx.wait();
    return tx.hash;
  }

  async claimWinnings(eventId: number): Promise<string> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const tx = await this.predictionMarketContract.claimWinnings(eventId);
    await tx.wait();
    return tx.hash;
  }

  async createEvent(question: string, duration: number): Promise<string> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const tx = await this.predictionMarketContract.createEvent(question, duration);
    await tx.wait();
    return tx.hash;
  }

  async resolveEvent(eventId: number, result: Outcome): Promise<string> {
    if (!this.predictionMarketContract) {
      throw new Error("Prediction market contract not initialized");
    }

    const tx = await this.predictionMarketContract.resolveEvent(eventId, result);
    await tx.wait();
    return tx.hash;
  }

  // Mock USDC methods
  async getUSDCBalance(address: string): Promise<string> {
    if (!this.mockUSDCContract) {
      throw new Error("Mock USDC contract not initialized");
    }

    const balance = await this.mockUSDCContract.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }

  async approveUSDC(spender: string, amount: string): Promise<string> {
    if (!this.mockUSDCContract) {
      throw new Error("Mock USDC contract not initialized");
    }

    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await this.mockUSDCContract.approve(spender, amountWei);
    await tx.wait();
    return tx.hash;
  }

  async getUSDCAllowance(owner: string, spender: string): Promise<string> {
    if (!this.mockUSDCContract) {
      throw new Error("Mock USDC contract not initialized");
    }

    const allowance = await this.mockUSDCContract.allowance(owner, spender);
    return ethers.formatUnits(allowance, 6);
  }

  async claimFromFaucet(targetAddress?: string): Promise<string> {
    if (!this.mockUSDCContract) {
      throw new Error("Mock USDC contract not initialized");
    }

    console.log("claimFromFaucet called with targetAddress:", targetAddress);

    try {
      let tx;
      if (targetAddress) {
        console.log("Using faucetTo function with target:", targetAddress);
        
        // Estimate gas first
        const gasEstimate = await this.mockUSDCContract.faucetTo.estimateGas(targetAddress);
        console.log("Gas estimate:", gasEstimate.toString());
        
        // Use faucetTo to mint to specific address (smart account) with explicit gas
        tx = await this.mockUSDCContract.faucetTo(targetAddress, {
          gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
        });
      } else {
        console.log("Using regular faucet function");
        
        // Estimate gas first
        const gasEstimate = await this.mockUSDCContract.faucet.estimateGas();
        console.log("Gas estimate:", gasEstimate.toString());
        
        // Use regular faucet to mint to msg.sender (wallet address) with explicit gas
        tx = await this.mockUSDCContract.faucet({
          gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
        });
      }
      
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed:", tx.hash);
      return tx.hash;
    } catch (error: any) {
      console.error("Error in claimFromFaucet:", error);
      
      // Log more details about the error
      if (error.data) {
        console.error("Error data:", error.data);
      }
      if (error.reason) {
        console.error("Error reason:", error.reason);
      }
      if (error.code) {
        console.error("Error code:", error.code);
      }
      
      throw error;
    }
  }

  // Utility methods
  getContractAddresses() {
    return CONTRACT_ADDRESSES;
  }

  getNetworkConfig() {
    return NETWORK_CONFIG;
  }

  isContractsInitialized(): boolean {
    return !!(this.predictionMarketContract && this.mockUSDCContract);
  }
}

export const contractService = new ContractService();