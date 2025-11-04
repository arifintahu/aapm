export interface GaslessConfig {
  factoryAddress: string;
  gasPayerPrivateKey: string;
  chainId: number;
}



export interface ContractConfig {
  predictionMarketAddress: string;
  privateKey: string;
  rpcUrl: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface EnvironmentConfig {
  gasless: GaslessConfig;
  contracts: ContractConfig;
  database: DatabaseConfig;
  port: number;
  nodeEnv: string;
}

export interface User {
  id: string;
  walletAddress: string;
  smartAccountAddress?: string;
  email?: string;
  name?: string;
  profileImage?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserSession {
  userId: string;
  token: string;
  expiresAt: Date;
  smartAccountAddress?: string;
}

export interface BetRecord {
  id: string;
  userId: string;
  eventId: number;
  betType: 'YES' | 'NO';
  amount: string;
  transactionHash: string;
  blockNumber?: number;
  timestamp: Date;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

export interface EventData {
  id: number;
  question: string;
  status: 'ACTIVE' | 'RESOLVED';
  result?: 'YES' | 'NO';
  totalYesBets: string;
  totalNoBets: string;
  totalPool: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface SmartAccountData {
  address: string;
  owner: string;
  isDeployed: boolean;
  nonce?: number;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
}

export interface GaslessTransactionRequest {
  to: string;
  value?: string;
  data?: string;
}

export interface GaslessTransactionResponse {
  userOpHash: string;
  transactionHash?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  receipt?: any;
  success?: boolean;
  gasUsed?: string;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface BettingHistoryQuery extends PaginationParams {
  userId?: string;
  eventId?: number;
  status?: BetRecord['status'];
}