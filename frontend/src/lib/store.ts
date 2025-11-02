import { create } from "zustand";
import { ethers } from "ethers";
import { IProvider } from "@web3auth/base";
import { web3AuthService } from "./web3auth";
import { gaslessService, SmartAccount } from "./gasless";
import { contractService, PredictionEvent, UserBet, Outcome } from "./contracts";
import { backendAuthService } from "./backend-auth";
import toast from "react-hot-toast";

console.log(`[${new Date().toISOString()}] STORE MODULE LOADED`);

// Helper function to get accounts with retry logic
const getAccountsWithRetry = async (context: 'login' | 'initialize', maxRetries: number = 5, retryDelay: number = 500): Promise<string[]> => {
  let accounts: string[] = [];
  let retryCount = 0;
  
  while ((!accounts || accounts.length === 0) && retryCount < maxRetries) {
    try {
      accounts = await web3AuthService.getAccounts();
      if (!accounts || accounts.length === 0) {
        console.log(`${context} attempt ${retryCount + 1}: No accounts found, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryCount++;
      }
    } catch (accountError) {
      console.log(`${context} attempt ${retryCount + 1}: Error getting accounts:`, accountError);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryCount++;
    }
  }
  
  if (!accounts || accounts.length === 0) {
    throw new Error(`Unable to retrieve wallet address after ${context}. Please try again.`);
  }
  
  return accounts;
};

// Helper function to authenticate and setup smart account
const authenticateAndSetupSmartAccount = async (
  provider: IProvider,
  accounts: string[],
  userInfo: any
): Promise<{ smartAccount: SmartAccount; authResult: any }> => {
  console.log('Authenticating with backend - accounts:', accounts);
  console.log('Authenticating with backend - userInfo:', userInfo);
  
  // Authenticate with backend
  const authResult = await backendAuthService.authenticateWithWeb3Auth(
    accounts[0],
    userInfo.email,
    userInfo.name,
    userInfo.profileImage
  );
  
  if (!authResult.success) {
    throw new Error(authResult.error || 'Backend authentication failed');
  }
  
  // Create smart account using Web3Auth provider (smart account address comes from backend auth)
  const smartAccount = await gaslessService.createSmartAccountFromProvider(
    provider, 
    authResult?.data?.user?.smartAccountAddress
  );
  
  // Set up contract service
  contractService.setSigner(smartAccount.signer);
  
  return { smartAccount, authResult };
};

// Helper function to update state and load initial data
const updateStateAndLoadData = async (
  set: any,
  get: any,
  provider: IProvider,
  smartAccount: SmartAccount,
  accounts: string[],
  userInfo: any
): Promise<void> => {
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
};

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

// Global initialization state to prevent race conditions
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

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

  // Actions
  initialize: async () => {
    console.log(`[${new Date().toISOString()}] INITIALIZE FUNCTION CALLED - NEW VERSION`);
    
    // Prevent multiple simultaneous initializations
    if (isInitializing) {
      console.log('Initialization already in progress, waiting for completion...');
      if (initializationPromise) {
        await initializationPromise;
      }
      return;
    }

    // Create initialization promise to handle concurrent calls
    initializationPromise = (async () => {
      isInitializing = true;
      
      try {
        set({ isInitializing: true });
        
        // Initialize Web3Auth
        await web3AuthService.init();
        
        // Check if user is already connected
        if (web3AuthService.isConnected()) {
          const provider = web3AuthService.getProvider();
          if (provider) {
            try {
              // Get user info
              const userInfo = await web3AuthService.getUserInfo();
              
              // Get accounts with retry logic (using longer retry for initialize after refresh)
              const accounts = await getAccountsWithRetry('initialize', 5, 500);
              
              // Authenticate and setup smart account
              const { smartAccount } = await authenticateAndSetupSmartAccount(provider, accounts, userInfo);
              
              // Update state and load initial data
              await updateStateAndLoadData(set, get, provider, smartAccount, accounts, userInfo);
            } catch (accountError) {
              console.log('Failed to get accounts or authenticate:', accountError);
              // User needs to login manually
            }
          }
        }
      } catch (error) {
        console.error("Initialization failed:", error);
      } finally {
        set({ isInitializing: false });
        isInitializing = false;
        initializationPromise = null;
      }
    })();

    await initializationPromise;
  },

  // Login with Web3Auth
  login: async () => {
    try {
      set({ isLoading: true });
      
      const provider = await web3AuthService.login();
      const userInfo = await web3AuthService.getUserInfo();
      
      // Get accounts with retry logic (using longer retry for login)
      const accounts = await getAccountsWithRetry('login', 5, 500);
      
      // Authenticate and setup smart account
      const { smartAccount } = await authenticateAndSetupSmartAccount(provider, accounts, userInfo);
      
      // Show success toast for smart account creation
      toast.success(
        `🎉 Smart Account Created!\nAddress: ${smartAccount.address.slice(0, 6)}...${smartAccount.address.slice(-4)}`,
        {
          duration: 2500,
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
          },
        }
      );
      
      // Update state and load initial data
      await updateStateAndLoadData(set, get, provider, smartAccount, accounts, userInfo);
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
      backendAuthService.logout();
      
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
      const { user, smartAccount } = get();
      if (!user || !smartAccount || !contractService.isContractsInitialized()) {
        return;
      }
      
      // Use smart account address instead of user wallet address
      const balance = await contractService.getUSDCBalance(smartAccount.address);
      set({ usdcBalance: balance });
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  },

  // Place a bet
  placeBet: async (eventId: number, prediction: Outcome, amount: string) => {
    try {
      const { smartAccount, usdcBalance } = get();
      if (!smartAccount || !contractService.isContractsInitialized()) {
        throw new Error("Not connected");
      }
      
      // Check if user has sufficient balance
      const balanceNum = parseFloat(usdcBalance);
      const amountNum = parseFloat(amount);
      if (balanceNum < amountNum) {
        throw new Error(`Insufficient USDC balance. You have ${usdcBalance} USDC but need ${amount} USDC. Please claim tokens from the faucet first.`);
      }
      
      set({ isLoading: true });
      
      const contracts = contractService.getContractAddresses();
      
      // Create approve + bet transaction
      const transactions = await gaslessService.createApproveAndBetTransaction(
        contracts.MOCK_USDC,
        contracts.PREDICTION_MARKET,
        amount,
        eventId,
        prediction
      );
      
      // Execute batch transaction
      const txHash = await gaslessService.executeBatchTransaction(transactions);
      
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
      
      const { smartAccount } = get();
      if (!smartAccount || !contractService.isContractsInitialized()) {
        throw new Error("Not connected");
      }
      
      const targetAddress = smartAccount.address; // Use smart account address
      console.log("Claiming faucet for smart account:", targetAddress);
      
      // Get contract addresses
      const contracts = contractService.getContractAddresses();
      
      // Create the faucetTo transaction data
      const mockUSDCInterface = new ethers.Interface([
        "function faucetTo(address to)"
      ]);
      
      const txData = mockUSDCInterface.encodeFunctionData("faucetTo", [targetAddress]);
      
      // Execute through gasless service
      const txHash = await gaslessService.executeTransaction(
        contracts.MOCK_USDC,
        txData,
        "0"
      );
      
      console.log("Faucet transaction successful:", txHash);
      
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