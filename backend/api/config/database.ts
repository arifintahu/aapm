import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'aapm_db',
      user: process.env.DB_USER || 'aapm_user',
      password: process.env.DB_PASSWORD || 'aapm_password',
      ssl: process.env.DB_SSL === 'true',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    };
  }

  async initialize(): Promise<void> {
    try {
      // Map DB_SSL=true to TLS with certificate verification disabled (sslmode=require equivalent)
      // DB_SSL=false will disable TLS entirely (sslmode=disable).
      const sslSetting = this.config.ssl
        ? { rejectUnauthorized: false }
        : false;

      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: sslSetting,
        max: this.config.max,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      };

      this.pool = new Pool(poolConfig);

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      logger.info('Database connection established successfully', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
      });

      // Set up connection error handling
      this.pool.on('error', (err) => {
        logger.error('Unexpected error on idle client', err);
      });

      // Clean up expired sessions periodically (every hour)
      setInterval(async () => {
        try {
          await this.query('SELECT cleanup_expired_sessions()');
          logger.debug('Expired sessions cleaned up');
        } catch (error) {
          logger.error('Failed to clean up expired sessions:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getClient() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool.connect();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }

  isInitialized(): boolean {
    return this.pool !== null;
  }

  getConfig(): DatabaseConfig {
    return { ...this.config };
  }
}

export const database = new DatabaseManager();
export default database;