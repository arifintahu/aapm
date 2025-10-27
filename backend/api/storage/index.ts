import { User, UserSession, BetRecord, EventData, SmartAccountData } from '../types/index.js';

/**
 * In-memory storage for development and testing
 * In production, this should be replaced with a proper database
 */
class InMemoryStorage {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, UserSession> = new Map();
  private betRecords: Map<string, BetRecord> = new Map();
  private events: Map<number, EventData> = new Map();
  private smartAccounts: Map<string, SmartAccountData> = new Map();
  private usersByWallet: Map<string, string> = new Map(); // walletAddress -> userId
  private usersBySmartAccount: Map<string, string> = new Map(); // smartAccountAddress -> userId

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Initialize with the default prediction event
    const defaultEvent: EventData = {
      id: 1,
      question: "Will ETH be above $3,000 by the end of this month?",
      status: 'ACTIVE',
      totalYesBets: '0',
      totalNoBets: '0',
      totalPool: '0',
      createdAt: new Date(),
    };
    this.events.set(1, defaultEvent);
  }

  // User management
  createUser(user: User): User {
    this.users.set(user.id, user);
    this.usersByWallet.set(user.walletAddress.toLowerCase(), user.id);
    if (user.smartAccountAddress) {
      this.usersBySmartAccount.set(user.smartAccountAddress.toLowerCase(), user.id);
    }
    return user;
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByWallet(walletAddress: string): User | undefined {
    const userId = this.usersByWallet.get(walletAddress.toLowerCase());
    return userId ? this.users.get(userId) : undefined;
  }

  getUserBySmartAccount(smartAccountAddress: string): User | undefined {
    const userId = this.usersBySmartAccount.get(smartAccountAddress.toLowerCase());
    return userId ? this.users.get(userId) : undefined;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);

    // Update indexes if wallet addresses changed
    if (updates.walletAddress && updates.walletAddress !== user.walletAddress) {
      this.usersByWallet.delete(user.walletAddress.toLowerCase());
      this.usersByWallet.set(updates.walletAddress.toLowerCase(), id);
    }

    if (updates.smartAccountAddress && updates.smartAccountAddress !== user.smartAccountAddress) {
      if (user.smartAccountAddress) {
        this.usersBySmartAccount.delete(user.smartAccountAddress.toLowerCase());
      }
      this.usersBySmartAccount.set(updates.smartAccountAddress.toLowerCase(), id);
    }

    return updatedUser;
  }

  // Session management
  createSession(session: UserSession): UserSession {
    this.sessions.set(session.token, session);
    return session;
  }

  getSession(token: string): UserSession | undefined {
    const session = this.sessions.get(token);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    if (session) {
      this.sessions.delete(token); // Clean up expired session
    }
    return undefined;
  }

  deleteSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }

  // Bet records management
  createBetRecord(bet: BetRecord): BetRecord {
    this.betRecords.set(bet.id, bet);
    return bet;
  }

  getBetRecord(id: string): BetRecord | undefined {
    return this.betRecords.get(id);
  }

  getBetsByUser(userId: string): BetRecord[] {
    return Array.from(this.betRecords.values()).filter(bet => bet.userId === userId);
  }

  getBetsByEvent(eventId: number): BetRecord[] {
    return Array.from(this.betRecords.values()).filter(bet => bet.eventId === eventId);
  }

  updateBetRecord(id: string, updates: Partial<BetRecord>): BetRecord | undefined {
    const bet = this.betRecords.get(id);
    if (!bet) return undefined;

    const updatedBet = { ...bet, ...updates };
    this.betRecords.set(id, updatedBet);
    return updatedBet;
  }

  getAllBetRecords(): BetRecord[] {
    return Array.from(this.betRecords.values());
  }

  // Event management
  createEvent(event: EventData): EventData {
    this.events.set(event.id, event);
    return event;
  }

  getEvent(id: number): EventData | undefined {
    return this.events.get(id);
  }

  getAllEvents(): EventData[] {
    return Array.from(this.events.values());
  }

  updateEvent(id: number, updates: Partial<EventData>): EventData | undefined {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = { ...event, ...updates };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  // Smart account management
  createSmartAccount(smartAccount: SmartAccountData): SmartAccountData {
    this.smartAccounts.set(smartAccount.address.toLowerCase(), smartAccount);
    return smartAccount;
  }

  getSmartAccount(address: string): SmartAccountData | undefined {
    return this.smartAccounts.get(address.toLowerCase());
  }

  updateSmartAccount(address: string, updates: Partial<SmartAccountData>): SmartAccountData | undefined {
    const account = this.smartAccounts.get(address.toLowerCase());
    if (!account) return undefined;

    const updatedAccount = { ...account, ...updates };
    this.smartAccounts.set(address.toLowerCase(), updatedAccount);
    return updatedAccount;
  }

  // Statistics and analytics
  getEventStats(eventId: number): { totalBets: number; totalVolume: string; yesPercentage: number; noPercentage: number } | undefined {
    const event = this.events.get(eventId);
    if (!event) return undefined;

    const bets = this.getBetsByEvent(eventId);
    const totalBets = bets.length;
    
    const totalYes = parseFloat(event.totalYesBets);
    const totalNo = parseFloat(event.totalNoBets);
    const totalVolume = (totalYes + totalNo).toString();
    
    const yesPercentage = totalVolume === '0' ? 0 : (totalYes / (totalYes + totalNo)) * 100;
    const noPercentage = totalVolume === '0' ? 0 : (totalNo / (totalYes + totalNo)) * 100;

    return {
      totalBets,
      totalVolume,
      yesPercentage,
      noPercentage,
    };
  }

  getUserStats(userId: string): { totalBets: number; totalVolume: string; winnings: string } {
    const bets = this.getBetsByUser(userId);
    const totalBets = bets.length;
    
    const totalVolume = bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0).toString();
    
    // Calculate winnings (simplified - would need more complex logic for actual winnings)
    const winnings = '0'; // TODO: Implement actual winnings calculation
    
    return {
      totalBets,
      totalVolume,
      winnings,
    };
  }

  // Cleanup and maintenance
  clearAllData(): void {
    this.users.clear();
    this.sessions.clear();
    this.betRecords.clear();
    this.events.clear();
    this.smartAccounts.clear();
    this.usersByWallet.clear();
    this.usersBySmartAccount.clear();
    this.initializeDefaultData();
  }

  getStorageStats(): { users: number; sessions: number; bets: number; events: number; smartAccounts: number } {
    return {
      users: this.users.size,
      sessions: this.sessions.size,
      bets: this.betRecords.size,
      events: this.events.size,
      smartAccounts: this.smartAccounts.size,
    };
  }
}

// Export singleton instance
export const storage = new InMemoryStorage();
export default storage;