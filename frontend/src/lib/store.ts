import { create } from "zustand";
import { IProvider } from "@web3auth/base";
import { web3AuthService } from "./web3auth";
import { biconomyService, SmartAccount } from "./biconomy";
import { contractService, PredictionEvent, UserBet, Outcome } from "./contracts";

interface User {
  address: string;
  email?: string;
  name?: string;
  profileImage?: string;
}

interface AppState {
  // Authentication state
  isAuthenticated: boolean;
  user: User | null;
  provider: IProvider | null;
  smartAccount: SmartAccount | null;
  
  // Loading states
  isLoading: boolean;
  isInitializing: boolean;
  
  // Contract state
  events: PredictionEvent[];
  userBets: Record<number, UserBet[]>;
  usdcBalance: string;
  
  // UI state
  selectedEventId: number | null;
  showWalletModal: boolean;
  showBetModal: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loadEvents: () => Promise<void>;
  loadUserBets: (eventId: number) => Promise<void>;
  loadBalance: () => Promise<void>;
  placeBet: (eventId: number, prediction: Outcome, amount: string) => Promise<string>;
  claimWinnings: (eventId: number) => Promise<string>;
  claimFaucet: () => Promise<string>;
  
  // UI actions
  setSelectedEvent: (eventId: number | null) => void;
  setShowWalletModal: (show: boolean) => void;
  setShowBetModal: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  provider: null,
  smartAccount: null,
  isLoading: false,
  isInitializing: true,
  events: [],
  userBets: {},
  usdcBalance: "0",
  selectedEventId: null,
  showWalletModal: false,
  showBetModal: false,

  // Initialize the app
  initialize: async () => {
    try {
      set({ isInitializing: true });
      
      // Initialize Web3Auth
      await web3AuthService.init();
      
      // Check if user is already connected
      if (web3AuthService.isConnected()) {
        const provider = web3AuthService.getProvider();
        if (provider) {
          // Get user info
          const userInfo = await web3AuthService.getUserInfo();
          const accounts = await web3AuthService.getAccounts();
          
          // Create smart account
          const smartAccount = await biconomyService.createSmartAccount(provider);
          
          // Set up contract service
          contractService.setSigner(smartAccount.signer);
          
          set({
            isAuthenticated: true,
            provider,
            smartAccount,
            user: {
              address: accounts[0],
              email: userInfo.email,
              name: userInfo.name,
              profileImage: userInfo.profileImage,
            },
          });
          
          // Load initial data
          await get().loadEvents();
          await get().loadBalance();
        }
      }
    } catch (error) {
      console.error("Initialization failed:", error);
    } finally {
      set({ isInitializing: false });
    }
  },

  // Login with Web3Auth
  login: async () => {
    try {
      set({ isLoading: true });
      
      const provider = await web3AuthService.login();
      const userInfo = await web3AuthService.getUserInfo();
      const accounts = await web3AuthService.getAccounts();
      
      // Create smart account
      const smartAccount = await biconomyService.createSmartAccount(provider);
      
      // Set up contract service
      contractService.setSigner(smartAccount.signer);
      
      set({
        isAuthenticated: true,
        provider,
        smartAccount,
        user: {
          address: accounts[0],
          email: userInfo.email,
          name: userInfo.name,
          profileImage: userInfo.profileImage,
        },
      });
      
      // Load initial data
      await get().loadEvents();
      await get().loadBalance();
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Logout
  logout: async () => {
    try {
      set({ isLoading: true });
      
      await web3AuthService.logout();
      
      set({
        isAuthenticated: false,
        user: null,
        provider: null,
        smartAccount: null,
        events: [],
        userBets: {},
        usdcBalance: "0",
        selectedEventId: null,
      });
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Load events
  loadEvents: async () => {
    try {
      if (!contractService.isContractsInitialized()) {
        console.warn("Contracts not initialized");
        return;
      }
      
      const eventCount = await contractService.getEventCount();
      const events: PredictionEvent[] = [];
      
      for (let i = 0; i < eventCount; i++) {
        const event = await contractService.getEvent(i);
        events.push(event);
      }
      
      set({ events });
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  },

  // Load user bets for a specific event
  loadUserBets: async (eventId: number) => {
    try {
      const { user, userBets } = get();
      if (!user || !contractService.isContractsInitialized()) {
        return;
      }
      
      const bets = await contractService.getUserBets(eventId, user.address);
      
      set({
        userBets: {
          ...userBets,
          [eventId]: bets,
        },
      });
    } catch (error) {
      console.error("Failed to load user bets:", error);
    }
  },

  // Load USDC balance
  loadBalance: async () => {
    try {
      const { user } = get();
      if (!user || !contractService.isContractsInitialized()) {
        return;
      }
      
      const balance = await contractService.getUSDCBalance(user.address);
      set({ usdcBalance: balance });
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  },

  // Place a bet
  placeBet: async (eventId: number, prediction: Outcome, amount: string) => {
    try {
      const { smartAccount } = get();
      if (!smartAccount || !contractService.isContractsInitialized()) {
        throw new Error("Not connected");
      }
      
      set({ isLoading: true });
      
      const contracts = contractService.getContractAddresses();
      
      // Create approve + bet transaction
      const transactions = await biconomyService.createApproveAndBetTransaction(
        contracts.MOCK_USDC,
        contracts.PREDICTION_MARKET,
        amount,
        eventId,
        prediction
      );
      
      // Execute batch transaction
      const txHash = await biconomyService.executeBatchTransaction(transactions);
      
      // Reload data
      await get().loadBalance();
      await get().loadUserBets(eventId);
      await get().loadEvents();
      
      return txHash;
    } catch (error) {
      console.error("Failed to place bet:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Claim winnings
  claimWinnings: async (eventId: number) => {
    try {
      set({ isLoading: true });
      
      const txHash = await contractService.claimWinnings(eventId);
      
      // Reload data
      await get().loadBalance();
      await get().loadUserBets(eventId);
      
      return txHash;
    } catch (error) {
      console.error("Failed to claim winnings:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Claim from faucet
  claimFaucet: async () => {
    try {
      set({ isLoading: true });
      
      const txHash = await contractService.claimFromFaucet();
      
      // Reload balance
      await get().loadBalance();
      
      return txHash;
    } catch (error) {
      console.error("Failed to claim from faucet:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // UI actions
  setSelectedEvent: (eventId: number | null) => {
    set({ selectedEventId: eventId });
  },

  setShowWalletModal: (show: boolean) => {
    set({ showWalletModal: show });
  },

  setShowBetModal: (show: boolean) => {
    set({ showBetModal: show });
  },
}));