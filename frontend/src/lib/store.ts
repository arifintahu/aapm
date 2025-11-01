import { create } from "zustand";
import { ethers } from "ethers";
import { IProvider } from "@web3auth/base";
import { web3AuthService } from "./web3auth";
import { gaslessService, SmartAccount } from "./gasless";
import { contractService, PredictionEvent, UserBet, Outcome } from "./contracts";
import { backendAuthService } from "./backend-auth";
import toast from "react-hot-toast";

console.log(`[${new Date().toISOString()}] STORE MODULE LOADED`);

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
    console.log(`[${new Date().toISOString()}] INITIALIZE FUNCTION CALLED - NEW VERSION`);
    
    try {
      set({ isInitializing: true });
      
      // Initialize Web3Auth
      await web3AuthService.init();
      
      // Check if user is already connected
      if (web3AuthService.isConnected()) {
        const provider = web3AuthService.getProvider();
        if (provider) {
          try {
            // Get user info and accounts with retry logic
            const userInfo = await web3AuthService.getUserInfo();
            
            // Retry getting accounts if they're not immediately available (page reload scenario)
            let accounts: string[] = [];
            let retryCount = 0;
            const maxRetries = 3;
            
            while ((!accounts || accounts.length === 0) && retryCount < maxRetries) {
              try {
                accounts = await web3AuthService.getAccounts();
                if (!accounts || accounts.length === 0) {
                  console.log(`Store init attempt ${retryCount + 1}: No accounts found, retrying in 300ms...`);
                  await new Promise(resolve => setTimeout(resolve, 300));
                  retryCount++;
                }
              } catch (accountError) {
                console.log(`Store init attempt ${retryCount + 1}: Error getting accounts:`, accountError);
                await new Promise(resolve => setTimeout(resolve, 300));
                retryCount++;
              }
            }
            
            // Check if we actually have accounts
            if (!accounts || accounts.length === 0) {
              console.log('No accounts found after retries, user needs to login');
              return;
            }
            
            console.log('Initialize - accounts:', accounts);
            console.log('Initialize - userInfo:', userInfo);
            
            // Authenticate with backend if not already authenticated
            let authResult;
            if (!backendAuthService.isAuthenticated()) {
              authResult = await backendAuthService.authenticateWithWeb3Auth(
                accounts[0],
                userInfo.email,
                userInfo.name,
                userInfo.profileImage
              );
              
              if (!authResult.success) {
                throw new Error(authResult.error || 'Backend authentication failed');
              }
            }
            
            // Create smart account using Web3Auth provider (smart account address comes from backend auth)
            const smartAccount = await gaslessService.createSmartAccountFromProvider(provider, authResult?.data?.user?.smartAccountAddress);
            
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
    }
  },

  // Login with Web3Auth
  login: async () => {
    try {
      set({ isLoading: true });
      
      const provider = await web3AuthService.login();
      const userInfo = await web3AuthService.getUserInfo();
      
      // Retry getting accounts after login (Web3Auth needs time to initialize)
      let accounts: string[] = [];
      let retryCount = 0;
      const maxRetries = 5;
      
      while ((!accounts || accounts.length === 0) && retryCount < maxRetries) {
        try {
          accounts = await web3AuthService.getAccounts();
          if (!accounts || accounts.length === 0) {
            console.log(`Login attempt ${retryCount + 1}: No accounts found, retrying in 500ms...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            retryCount++;
          }
        } catch (accountError) {
          console.log(`Login attempt ${retryCount + 1}: Error getting accounts:`, accountError);
          await new Promise(resolve => setTimeout(resolve, 500));
          retryCount++;
        }
      }
      
      // Validate accounts
      if (!accounts || accounts.length === 0) {
        throw new Error('Unable to retrieve wallet address after login. Please try again.');
      }
      
      console.log('Login - accounts:', accounts);
      console.log('Login - userInfo:', userInfo);
      
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
      const smartAccount = await gaslessService.createSmartAccountFromProvider(provider, authResult?.data?.user?.smartAccountAddress);
      
      // Show success toast for smart account creation
      toast.success(
        `🎉 Smart Account Created!\nAddress: ${smartAccount.address.slice(0, 6)}...${smartAccount.address.slice(-4)}`,
        {
          duration: 5000,
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
          },
        }
      );
      
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
      const { smartAccount } = get();
      if (!smartAccount || !contractService.isContractsInitialized()) {
        throw new Error("Not connected");
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