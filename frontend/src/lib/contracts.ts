import { ethers } from "ethers";
import { chainConfig } from "./web3auth";

// Contract ABIs (simplified versions)
export const PREDICTION_MARKET_ABI = [
  "function createEvent(string memory question, uint256 duration) external",
  "function placeBet(uint256 eventId, uint8 prediction, uint256 amount) external",
  "function resolveEvent(uint256 eventId, uint8 result) external",
  "function claimWinnings(uint256 eventId) external",
  "function getEvent(uint256 eventId) external view returns (tuple(string question, uint256 endTime, uint8 status, uint8 result, uint256 totalYesBets, uint256 totalNoBets, uint256 totalPool))",
  "function getUserEventBets(uint256 eventId, address user) external view returns (tuple(uint256 eventId, address bettor, uint8 prediction, uint256 amount, bool claimed)[])",
  "function getEventBetCount(uint256 eventId) external view returns (uint256)",
  "function calculatePotentialWinnings(uint256 eventId, uint8 prediction, uint256 amount) external view returns (uint256)",
  "function eventCounter() external view returns (uint256)",
  "event EventCreated(uint256 indexed eventId, string question, uint256 endTime)",
  "event BetPlaced(uint256 indexed eventId, address indexed bettor, uint8 prediction, uint256 amount)",
  "event EventResolved(uint256 indexed eventId, uint8 result)",
  "event WinningsClaimed(uint256 indexed eventId, address indexed winner, uint256 amount)"
];

export const MOCK_USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function mint(address to, uint256 amount) external",
  "function faucet() external",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// Contract addresses (will be updated after deployment)
export const CONTRACT_ADDRESSES = {
  PREDICTION_MARKET: import.meta.env.VITE_PREDICTION_MARKET_ADDRESS || "",
  MOCK_USDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || "",
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