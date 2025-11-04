import dotenv from 'dotenv';
import { EnvironmentConfig } from '../types/index.js';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

export const config: EnvironmentConfig = {
  gasless: {
    factoryAddress: process.env.GASLESS_FACTORY_ADDRESS as string,
    gasPayerPrivateKey: process.env.GASLESS_GAS_PAYER_PRIVATE_KEY as string,
    chainId: parseInt(process.env.GASLESS_CHAIN_ID as string, 10),
  },
  contracts: {
    predictionMarketAddress: process.env.PREDICTION_MARKET_ADDRESS as string,
    rpcUrl: process.env.RPC_URL as string,
  },
  database: {
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT as string, 10),
    database: process.env.DB_NAME as string,
    username: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    ssl: (process.env.DB_SSL as string) === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS as string, 10),
  },
  port: parseInt(process.env.PORT as string, 10),
  nodeEnv: process.env.NODE_ENV as string,
};

// Validate required environment variables
const requiredEnvVars = [
  'GASLESS_FACTORY_ADDRESS',
  'GASLESS_GAS_PAYER_PRIVATE_KEY',
  'PREDICTION_MARKET_ADDRESS',
  'RPC_URL',
];

export function validateEnvironment(): void {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  if (!config.gasless.gasPayerPrivateKey) {
    throw new Error('GAS_PAYER_PRIVATE_KEY or PRIVATE_KEY is required');
  }
  

  
  console.log('✅ Environment configuration validated successfully');
}

export default config;