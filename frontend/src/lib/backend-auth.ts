import { IProvider } from "@web3auth/base";

export interface BackendAuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      walletAddress: string;
      email?: string;
      name?: string;
      profileImage?: string;
      smartAccountAddress?: string;
    };
  };
  error?: string;
}

export class BackendAuthService {
  private readonly backendUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
    // Load existing token from localStorage
    this.authToken = localStorage.getItem('authToken');
  }

  async authenticateWithWeb3Auth(
    walletAddress: string,
    email?: string,
    name?: string,
    profileImage?: string,
    idToken?: string
  ): Promise<BackendAuthResponse> {
    try {
      const response = await fetch(`${this.backendUrl}/api/auth/web3auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          email,
          name,
          profileImage,
          idToken,
        }),
      });

      const result: BackendAuthResponse = await response.json();

      if (result.success && result.data?.token) {
        this.authToken = result.data.token;
        localStorage.setItem('authToken', this.authToken);
      }

      return result;
    } catch (error) {
      console.error('Backend authentication failed:', error);
      return {
        success: false,
        error: 'Failed to authenticate with backend',
      };
    }
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  logout(): void {
    this.authToken = null;
    localStorage.removeItem('authToken');
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }
}

export const backendAuthService = new BackendAuthService();