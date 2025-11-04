import dotenv from 'dotenv';
import { EnvironmentConfig } from '../types/index.js';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

export const config: EnvironmentConfig = {
  gasless: {
    factoryAddress: process.env.GASLESS_FACTORY_ADDRESS!,
    gasPayerPrivateKey: process.env.GASLESS_GAS_PAYER_PRIVATE_KEY!,
    chainId: parseInt(process.env.GASLESS_CHAIN_ID!, 10),
  },
  contracts: {
    predictionMarketAddress: process.env.PREDICTION_MARKET_ADDRESS!,
    rpcUrl: process.env.RPC_URL!,
  },
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    database: process.env.DB_NAME!,
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS!, 10),
  },
  port: parseInt(process.env.PORT!, 10),
  nodeEnv: process.env.NODE_ENV!,
};

// Validate required environment variables
const requiredEnvVars = [
  'GASLESS_FACTORY_ADDRESS',
  'GASLESS_GAS_PAYER_PRIVATE_KEY',
  'PREDICTION_MARKET_ADDRESS',
  'PRIVATE_KEY',
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