import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ";

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7", // Sepolia testnet
  rpcTarget: "https://rpc.sepolia.org",
  displayName: "Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io/",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
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

export class Web3AuthService {
  private provider: IProvider | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await web3auth.initModal();
      this.isInitialized = true;
      
      if (web3auth.connected) {
        this.provider = web3auth.provider;
      }
    } catch (error) {
      console.error("Web3Auth initialization failed:", error);
      throw error;
    }
  }

  async login(): Promise<IProvider> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const provider = await web3auth.connect();
      if (!provider) {
        throw new Error("Failed to connect to Web3Auth");
      }
      
      this.provider = provider;
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
      const accounts = await this.provider.request({
        method: "eth_accounts",
      });
      return accounts as string[];
    } catch (error) {
      console.error("Failed to get accounts:", error);
      throw error;
    }
  }
}

export const web3AuthService = new Web3AuthService();