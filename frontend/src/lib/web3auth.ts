import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { MetamaskAdapter } from "@web3auth/metamask-adapter";

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;

export const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: import.meta.env.VITE_CHAIN_ID,
  rpcTarget: import.meta.env.VITE_CHAIN_RPC_URL,
  displayName: import.meta.env.VITE_CHAIN_NETWORK_NAME,
  blockExplorerUrl: import.meta.env.VITE_CHAIN_BLOCK_EXPLORER_URL,
  ticker: import.meta.env.VITE_CHAIN_TICKER,
  tickerName: import.meta.env.VITE_CHAIN_TICKER_NAME,
  logo: import.meta.env.VITE_CHAIN_LOGO_URL,
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
  privateKeyProvider,
});

const openloginAdapter = new OpenloginAdapter({
  loginSettings: {
    mfaLevel: "optional",
  },
  adapterSettings: {
    uxMode: "popup",
    whiteLabel: {
      appName: "Gasless Prediction Market",
      appUrl: "https://web3auth.io",
      logoLight: "https://web3auth.io/images/web3authlog.png",
      logoDark: "https://web3auth.io/images/web3authlogodark.png",
      defaultLanguage: "en",
      mode: "light",
    },
  },
});

web3auth.configureAdapter(openloginAdapter);

// Enable MetaMask in the Web3Auth modal
const metamaskAdapter = new MetamaskAdapter({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
  chainConfig,
});

web3auth.configureAdapter(metamaskAdapter);

export class Web3AuthService {
  private provider: IProvider | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInit();
    await this.initializationPromise;
  }

  private async performInit(): Promise<void> {
    
    try {
      await web3auth.initModal({
        modalConfig: {
          openlogin: {
            showOnModal: true,
            label: "Login",
            loginMethods: {
              google: {
                showOnModal: true,
                name: "Google"
              },
              facebook: {
                showOnModal: false,
                name: ""
              },
              twitter: {
                showOnModal: false,
                name: ""
              },
              reddit: {
                showOnModal: false,
                name: ""
              },
              discord: {
                showOnModal: false,
                name: ""
              },
              twitch: {
                showOnModal: false,
                name: ""
              },
              apple: {
                showOnModal: false,
                name: ""
              },
              line: {
                showOnModal: false,
                name: ""
              },
              github: {
                showOnModal: false,
                name: ""
              },
              kakao: {
                showOnModal: false,
                name: ""
              },
              linkedin: {
                showOnModal: false,
                name: ""
              },
              weibo: {
                showOnModal: false,
                name: ""
              },
              wechat: {
                showOnModal: false,
                name: ""
              },
              farcaster: {
                showOnModal: false,
                name: ""
              },
              email_passwordless: {
                showOnModal: false,
                name: ""
              },
              sms_passwordless: {
                showOnModal: false,
                name: ""
              },
            },
          },
          metamask: { showOnModal: true, label: "MetaMask" },
        },
      });
      this.isInitialized = true;
      
      if (web3auth.connected) {
        this.provider = web3auth.provider;
        
        // Add a small delay to ensure Web3Auth provider is fully ready after page reload
        if (this.provider) {
          console.log('Web3Auth already connected, waiting for provider to be ready...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error("Web3Auth initialization failed:", error);
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  async login(): Promise<IProvider> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      console.log('Attempting Web3Auth login...');
      const provider = await web3auth.connect();
      if (!provider) {
        throw new Error("Failed to connect to Web3Auth");
      }
      
      console.log('Web3Auth login successful, provider:', provider);
      this.provider = provider;
      
      // Verify accounts are available immediately after login
      try {
        const accounts = await provider.request({ method: "eth_accounts" });
        console.log('Accounts immediately after login:', accounts);
      } catch (accountError) {
        console.warn('Could not get accounts immediately after login:', accountError);
      }
      
      return provider;
    } catch (error) {
      console.error("Web3Auth login failed:", error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await web3auth.logout();
      this.provider = null;
    } catch (error) {
      console.error("Web3Auth logout failed:", error);
      throw error;
    }
  }

  async getUserInfo() {
    if (!web3auth.connected) {
      throw new Error("User not connected");
    }
    
    try {
      return await web3auth.getUserInfo();
    } catch (error) {
      console.error("Failed to get user info:", error);
      throw error;
    }
  }

  getProvider(): IProvider | null {
    return this.provider;
  }

  isConnected(): boolean {
    return web3auth.connected;
  }

  async getPrivateKey(): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not available");
    }

    try {
      const privateKey = await this.provider.request({
        method: "eth_private_key",
      });
      return privateKey as string;
    } catch (error) {
      console.error("Failed to get private key:", error);
      throw error;
    }
  }

  async getAccounts(): Promise<string[]> {
    if (!this.provider) {
      throw new Error("Provider not available");
    }

    try {
      console.log('Getting accounts from provider...');
      
      // Add a small delay to ensure provider is ready, especially after page refresh
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const accounts = await this.provider.request({
        method: "eth_accounts",
      });
      console.log('Accounts received:', accounts);
      return accounts as string[];
    } catch (error) {
      console.error("Failed to get accounts:", error);
      throw error;
    }
  }
}

export const web3AuthService = new Web3AuthService();