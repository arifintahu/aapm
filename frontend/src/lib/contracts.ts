import { ethers } from "ethers";
import { chainConfig } from "./web3auth";
import { PREDICTION_MARKET_ABI, MOCK_USDC_ABI } from "./contract-abis";

// Contract addresses - deployed on Sepolia testnet
export const CONTRACT_ADDRESSES = {
  PREDICTION_MARKET: import.meta.env.VITE_PREDICTION_MARKET_ADDRESS || "0x24fFEAc69FE7CAcb45c7a39D0995618428205a6F",
  MOCK_USDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || "0xed3725F43893A72D8B940b6414eE10F4A570A769",
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
    const event = await this.predictionMarketContract.getEvent(eventId.toString());
    return {
      id: eventId,
      question: event[0],
      endTime: event[1],
      status: event[2],
      result: event[3],
      totalYesBets: event[4],
      totalNoBets: event[5],
      totalPool: event[6],
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

  async claimFromFaucet(): Promise<string> {
    if (!this.mockUSDCContract) {
      throw new Error("Mock USDC contract not initialized");
    }

    const tx = await this.mockUSDCContract.faucet();
    await tx.wait();
    return tx.hash;
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