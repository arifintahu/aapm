import dotenv from 'dotenv';
import { EnvironmentConfig } from '../types/index.js';

// Load environment variables
dotenv.config({ path: '../.env' });

export const config: EnvironmentConfig = {
  biconomy: {
    apiKey: process.env.BICONOMY_API_KEY || '',
    bundlerUrl: process.env.BICONOMY_BUNDLER_URL || '',
    chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  },
  web3Auth: {
    clientId: process.env.WEB3AUTH_CLIENT_ID || '',
    network: process.env.WEB3AUTH_NETWORK || 'sapphire_devnet',
  },
  contracts: {
    predictionMarketAddress: process.env.PREDICTION_MARKET_ADDRESS || '',
    privateKey: process.env.PRIVATE_KEY || '',
    rpcUrl: process.env.RPC_URL || '',
  },
  privateKey: process.env.PRIVATE_KEY || '',
  rpcUrl: process.env.RPC_URL || '',
  chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
const requiredEnvVars = [
  'BICONOMY_API_KEY',
  'BICONOMY_ID',
  'VITE_WEB3AUTH_CLIENT_ID',
  'SEPOLIA_RPC_URL',
  'PRIVATE_KEY',
];

export function validateEnvironment(): void {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  if (!config.biconomy.apiKey) {
    throw new Error('BICONOMY_API_KEY is required');
  }
  
  if (!config.web3Auth.clientId) {
    throw new Error('VITE_WEB3AUTH_CLIENT_ID is required');
  }
  
  console.log('✅ Environment configuration validated successfully');
}

export default config;