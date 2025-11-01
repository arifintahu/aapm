import { User, UserSession, BetRecord, EventData, SmartAccountData } from '../types/index.js';
import { database } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * PostgreSQL storage implementation
 * Replaces the in-memory storage with persistent database storage
 */
class PostgreSQLStorage {
  constructor() {
    // Initialize will be called from the main app
  }

  async initialize(): Promise<void> {
    await database.initialize();
    logger.info('PostgreSQL storage initialized');
  }

  // User management
  async createUser(user: User): Promise<User> {
    const query = `
      INSERT INTO users (id, wallet_address, smart_account_address, email, name, profile_image, created_at, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      user.id,
      user.walletAddress.toLowerCase(),
      user.smartAccountAddress?.toLowerCase() || null,
      user.email || null,
      user.name || null,
      user.profileImage || null,
      user.createdAt,
      user.lastLoginAt
    ];

    try {
      const result = await database.query(query, values);
      return this.mapUserFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    const query = 'SELECT * FROM users WHERE id = $1';
    
    try {
      const result = await database.query(query, [id]);
      return result.rows[0] ? this.mapUserFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  async getUserByWallet(walletAddress: string): Promise<User | undefined> {
    const query = 'SELECT * FROM users WHERE wallet_address = $1';
    
    try {
      const result = await database.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0] ? this.mapUserFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get user by wallet:', error);
      throw error;
    }
  }

  async getUserBySmartAccount(smartAccountAddress: string): Promise<User | undefined> {
    const query = 'SELECT * FROM users WHERE smart_account_address = $1';
    
    try {
      const result = await database.query(query, [smartAccountAddress.toLowerCase()]);
      return result.rows[0] ? this.mapUserFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get user by smart account:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUserById(id);
    if (!user) return undefined;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.walletAddress !== undefined) {
      fields.push(`wallet_address = $${paramIndex++}`);
      values.push(updates.walletAddress.toLowerCase());
    }
    if (updates.smartAccountAddress !== undefined) {
      fields.push(`smart_account_address = $${paramIndex++}`);
      values.push(updates.smartAccountAddress?.toLowerCase() || null);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.profileImage !== undefined) {
      fields.push(`profile_image = $${paramIndex++}`);
      values.push(updates.profileImage);
    }
    if (updates.lastLoginAt !== undefined) {
      fields.push(`last_login_at = $${paramIndex++}`);
      values.push(updates.lastLoginAt);
    }

    if (fields.length === 0) return user;

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    try {
      const result = await database.query(query, values);
      return result.rows[0] ? this.mapUserFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  // Session management
  async createSession(session: UserSession): Promise<UserSession> {
    const query = `
      INSERT INTO user_sessions (user_id, token, smart_account_address, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      session.userId,
      session.token,
      session.smartAccountAddress?.toLowerCase() || null,
      session.expiresAt
    ];

    try {
      const result = await database.query(query, values);
      return this.mapSessionFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  async getSession(token: string): Promise<UserSession | undefined> {
    const query = 'SELECT * FROM user_sessions WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP';
    
    try {
      const result = await database.query(query, [token]);
      return result.rows[0] ? this.mapSessionFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get session:', error);
      throw error;
    }
  }

  async deleteSession(token: string): Promise<boolean> {
    const query = 'DELETE FROM user_sessions WHERE token = $1';
    
    try {
      const result = await database.query(query, [token]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete session:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    const query = 'DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP';
    
    try {
      const result = await database.query(query);
      logger.debug(`Cleaned up ${result.rowCount} expired sessions`);
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      throw error;
    }
  }

  // Bet record management
  async createBetRecord(bet: BetRecord): Promise<BetRecord> {
    const query = `
      INSERT INTO bet_records (id, user_id, event_id, bet_type, amount, transaction_hash, block_number, timestamp, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      bet.id,
      bet.userId,
      bet.eventId,
      bet.betType,
      bet.amount,
      bet.transactionHash,
      bet.blockNumber || null,
      bet.timestamp,
      bet.status
    ];

    try {
      const result = await database.query(query, values);
      return this.mapBetRecordFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create bet record:', error);
      throw error;
    }
  }

  async getBetRecord(id: string): Promise<BetRecord | undefined> {
    const query = 'SELECT * FROM bet_records WHERE id = $1';
    
    try {
      const result = await database.query(query, [id]);
      return result.rows[0] ? this.mapBetRecordFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get bet record:', error);
      throw error;
    }
  }

  async getBetsByUser(userId: string): Promise<BetRecord[]> {
    const query = 'SELECT * FROM bet_records WHERE user_id = $1 ORDER BY timestamp DESC';
    
    try {
      const result = await database.query(query, [userId]);
      return result.rows.map((row: any) => this.mapBetRecordFromDb(row));
    } catch (error) {
      logger.error('Failed to get bets by user:', error);
      throw error;
    }
  }

  async getBetsByEvent(eventId: number): Promise<BetRecord[]> {
    const query = 'SELECT * FROM bet_records WHERE event_id = $1 ORDER BY timestamp DESC';
    
    try {
      const result = await database.query(query, [eventId]);
      return result.rows.map((row: any) => this.mapBetRecordFromDb(row));
    } catch (error) {
      logger.error('Failed to get bets by event:', error);
      throw error;
    }
  }

  async updateBetRecord(id: string, updates: Partial<BetRecord>): Promise<BetRecord | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.blockNumber !== undefined) {
      fields.push(`block_number = $${paramIndex++}`);
      values.push(updates.blockNumber);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) return this.getBetRecord(id);

    const query = `
      UPDATE bet_records 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    try {
      const result = await database.query(query, values);
      return result.rows[0] ? this.mapBetRecordFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to update bet record:', error);
      throw error;
    }
  }

  async getAllBetRecords(): Promise<BetRecord[]> {
    const query = 'SELECT * FROM bet_records ORDER BY timestamp DESC';
    
    try {
      const result = await database.query(query);
      return result.rows.map((row: any) => this.mapBetRecordFromDb(row));
    } catch (error) {
      logger.error('Failed to get all bet records:', error);
      throw error;
    }
  }

  // Event management
  async createEvent(event: EventData): Promise<EventData> {
    const query = `
      INSERT INTO events (question, status, result, total_yes_bets, total_no_bets, total_pool, created_at, resolved_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      event.question,
      event.status,
      event.result || null,
      event.totalYesBets,
      event.totalNoBets,
      event.totalPool,
      event.createdAt,
      event.resolvedAt || null
    ];

    try {
      const result = await database.query(query, values);
      return this.mapEventFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create event:', error);
      throw error;
    }
  }

  async getEvent(id: number): Promise<EventData | undefined> {
    const query = 'SELECT * FROM events WHERE id = $1';
    
    try {
      const result = await database.query(query, [id]);
      return result.rows[0] ? this.mapEventFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get event:', error);
      throw error;
    }
  }

  async getAllEvents(): Promise<EventData[]> {
    const query = 'SELECT * FROM events ORDER BY created_at DESC';
    
    try {
      const result = await database.query(query);
      return result.rows.map((row: any) => this.mapEventFromDb(row));
    } catch (error) {
      logger.error('Failed to get all events:', error);
      throw error;
    }
  }

  async updateEvent(id: number, updates: Partial<EventData>): Promise<EventData | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.question !== undefined) {
      fields.push(`question = $${paramIndex++}`);
      values.push(updates.question);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.result !== undefined) {
      fields.push(`result = $${paramIndex++}`);
      values.push(updates.result);
    }
    if (updates.totalYesBets !== undefined) {
      fields.push(`total_yes_bets = $${paramIndex++}`);
      values.push(updates.totalYesBets);
    }
    if (updates.totalNoBets !== undefined) {
      fields.push(`total_no_bets = $${paramIndex++}`);
      values.push(updates.totalNoBets);
    }
    if (updates.totalPool !== undefined) {
      fields.push(`total_pool = $${paramIndex++}`);
      values.push(updates.totalPool);
    }
    if (updates.resolvedAt !== undefined) {
      fields.push(`resolved_at = $${paramIndex++}`);
      values.push(updates.resolvedAt);
    }

    if (fields.length === 0) return this.getEvent(id);

    const query = `
      UPDATE events 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    try {
      const result = await database.query(query, values);
      return result.rows[0] ? this.mapEventFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to update event:', error);
      throw error;
    }
  }

  // Smart account management
  async createSmartAccount(smartAccount: SmartAccountData): Promise<SmartAccountData> {
    const query = `
      INSERT INTO smart_accounts (address, owner, is_deployed, nonce)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (address) DO UPDATE SET
        owner = EXCLUDED.owner,
        is_deployed = EXCLUDED.is_deployed,
        nonce = EXCLUDED.nonce,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      smartAccount.address.toLowerCase(),
      smartAccount.owner.toLowerCase(),
      smartAccount.isDeployed,
      smartAccount.nonce || 0
    ];

    try {
      const result = await database.query(query, values);
      return this.mapSmartAccountFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create smart account:', error);
      throw error;
    }
  }

  async getSmartAccount(address: string): Promise<SmartAccountData | undefined> {
    const query = 'SELECT * FROM smart_accounts WHERE address = $1';
    
    try {
      const result = await database.query(query, [address.toLowerCase()]);
      return result.rows[0] ? this.mapSmartAccountFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to get smart account:', error);
      throw error;
    }
  }

  async updateSmartAccount(address: string, updates: Partial<SmartAccountData>): Promise<SmartAccountData | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.owner !== undefined) {
      fields.push(`owner = $${paramIndex++}`);
      values.push(updates.owner.toLowerCase());
    }
    if (updates.isDeployed !== undefined) {
      fields.push(`is_deployed = $${paramIndex++}`);
      values.push(updates.isDeployed);
    }
    if (updates.nonce !== undefined) {
      fields.push(`nonce = $${paramIndex++}`);
      values.push(updates.nonce);
    }

    if (fields.length === 0) return this.getSmartAccount(address);

    const query = `
      UPDATE smart_accounts 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE address = $${paramIndex}
      RETURNING *
    `;
    values.push(address.toLowerCase());

    try {
      const result = await database.query(query, values);
      return result.rows[0] ? this.mapSmartAccountFromDb(result.rows[0]) : undefined;
    } catch (error) {
      logger.error('Failed to update smart account:', error);
      throw error;
    }
  }

  // Statistics and analytics
  async getEventStats(eventId: number): Promise<{ totalBets: number; totalVolume: string; yesPercentage: number; noPercentage: number } | undefined> {
    const query = `
      SELECT 
        COUNT(*) as total_bets,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_volume,
        COALESCE(SUM(CASE WHEN bet_type = 'YES' THEN CAST(amount AS DECIMAL) ELSE 0 END), 0) as yes_volume,
        COALESCE(SUM(CASE WHEN bet_type = 'NO' THEN CAST(amount AS DECIMAL) ELSE 0 END), 0) as no_volume
      FROM bet_records 
      WHERE event_id = $1 AND status = 'CONFIRMED'
    `;
    
    try {
      const result = await database.query(query, [eventId]);
      const row = result.rows[0];
      
      if (!row || row.total_bets === '0') {
        return { totalBets: 0, totalVolume: '0', yesPercentage: 50, noPercentage: 50 };
      }

      const totalVolume = parseFloat(row.total_volume);
      const yesVolume = parseFloat(row.yes_volume);
      const noVolume = parseFloat(row.no_volume);
      
      const yesPercentage = totalVolume > 0 ? (yesVolume / totalVolume) * 100 : 50;
      const noPercentage = totalVolume > 0 ? (noVolume / totalVolume) * 100 : 50;

      return {
        totalBets: parseInt(row.total_bets),
        totalVolume: row.total_volume,
        yesPercentage,
        noPercentage
      };
    } catch (error) {
      logger.error('Failed to get event stats:', error);
      throw error;
    }
  }

  async getUserStats(userId: string): Promise<{ totalBets: number; totalVolume: string; winnings: string }> {
    const query = `
      SELECT 
        COUNT(*) as total_bets,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_volume
      FROM bet_records 
      WHERE user_id = $1 AND status = 'CONFIRMED'
    `;
    
    try {
      const result = await database.query(query, [userId]);
      const row = result.rows[0];
      
      return {
        totalBets: parseInt(row.total_bets || '0'),
        totalVolume: row.total_volume || '0',
        winnings: '0' // TODO: Calculate actual winnings based on resolved events
      };
    } catch (error) {
      logger.error('Failed to get user stats:', error);
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    const queries = [
      'DELETE FROM bet_records',
      'DELETE FROM user_sessions',
      'DELETE FROM smart_accounts',
      'DELETE FROM events WHERE id != 1', // Keep the default event
      'DELETE FROM users'
    ];

    try {
      for (const query of queries) {
        await database.query(query);
      }
      logger.info('All data cleared from database');
    } catch (error) {
      logger.error('Failed to clear all data:', error);
      throw error;
    }
  }

  async getStorageStats(): Promise<{ users: number; sessions: number; bets: number; events: number; smartAccounts: number }> {
    const queries = [
      'SELECT COUNT(*) as count FROM users',
      'SELECT COUNT(*) as count FROM user_sessions',
      'SELECT COUNT(*) as count FROM bet_records',
      'SELECT COUNT(*) as count FROM events',
      'SELECT COUNT(*) as count FROM smart_accounts'
    ];

    try {
      const results = await Promise.all(queries.map(query => database.query(query)));
      
      return {
        users: parseInt(results[0].rows[0].count),
        sessions: parseInt(results[1].rows[0].count),
        bets: parseInt(results[2].rows[0].count),
        events: parseInt(results[3].rows[0].count),
        smartAccounts: parseInt(results[4].rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw error;
    }
  }

  // Helper methods to map database rows to TypeScript interfaces
  private mapUserFromDb(row: any): User {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      smartAccountAddress: row.smart_account_address,
      email: row.email,
      name: row.name,
      profileImage: row.profile_image,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at
    };
  }

  private mapSessionFromDb(row: any): UserSession {
    return {
      userId: row.user_id,
      token: row.token,
      smartAccountAddress: row.smart_account_address,
      expiresAt: row.expires_at
    };
  }

  private mapBetRecordFromDb(row: any): BetRecord {
    return {
      id: row.id,
      userId: row.user_id,
      eventId: row.event_id,
      betType: row.bet_type,
      amount: row.amount,
      transactionHash: row.transaction_hash,
      blockNumber: row.block_number,
      timestamp: row.timestamp,
      status: row.status
    };
  }

  private mapEventFromDb(row: any): EventData {
    return {
      id: row.id,
      question: row.question,
      status: row.status,
      result: row.result,
      totalYesBets: row.total_yes_bets,
      totalNoBets: row.total_no_bets,
      totalPool: row.total_pool,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    };
  }

  private mapSmartAccountFromDb(row: any): SmartAccountData {
    return {
      address: row.address,
      owner: row.owner,
      isDeployed: row.is_deployed,
      nonce: row.nonce
    };
  }
}

export const storage = new PostgreSQLStorage();
export default storage;