/**
 * User authentication API routes
 * Handle Web3Auth integration, user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage/index.js';
import { gaslessService } from '../services/gasless.js';
import { generateToken } from '../middleware/auth.js';
import { User, UserSession, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * Web3Auth Login/Register
 * POST /api/auth/web3auth
 */
router.post('/web3auth', async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletAddress, email, name, profileImage, idToken } = req.body;

    if (!walletAddress) {
      const response: ApiResponse = {
        success: false,
        error: 'Wallet address is required',
      };
      res.status(400).json(response);
      return;
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid wallet address format',
      };
      res.status(400).json(response);
      return;
    }

    let user = await storage.getUserByWallet(walletAddress);
    
    if (!user) {
      // Create new user
      const userId = uuidv4();
      
      user = {
        id: userId,
        walletAddress: walletAddress.toLowerCase(),
        email,
        name,
        profileImage,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      try {
        // Create smart account for the user
        const smartAccountData = await gaslessService.createSmartAccount(walletAddress);
        user.smartAccountAddress = smartAccountData.address;
        
        logger.info(`Smart account created for new user: ${smartAccountData.address}`, {
          userId,
          walletAddress,
        });
      } catch (smartAccountError) {
        logger.error('Failed to create smart account for new user:', smartAccountError);
        // Continue without smart account - it can be created later
      }

      user = await storage.createUser(user);
      
      logger.info(`New user registered: ${userId}`, {
        walletAddress,
        email,
        smartAccountAddress: user.smartAccountAddress,
      });
    } else {
      // Update existing user info
      const updates: Partial<User> = {
        lastLoginAt: new Date(),
      };

      if (email && email !== user.email) updates.email = email;
      if (name && name !== user.name) updates.name = name;
      if (profileImage && profileImage !== user.profileImage) updates.profileImage = profileImage;

      // Create smart account if not exists
      if (!user.smartAccountAddress) {
        try {
          const smartAccountData = await gaslessService.createSmartAccount(walletAddress);
          updates.smartAccountAddress = smartAccountData.address;
          
          logger.info(`Smart account created for existing user: ${smartAccountData.address}`, {
            userId: user.id,
            walletAddress,
          });
        } catch (smartAccountError) {
          logger.error('Failed to create smart account for existing user:', smartAccountError);
        }
      }

      user = await storage.updateUser(user.id, updates)!;
      
      logger.info(`User logged in: ${user?.id || 'unknown'}`, {
        walletAddress,
        smartAccountAddress: user?.smartAccountAddress || 'none',
      });
    }

    // Generate JWT token
    const token = generateToken(user?.id || '');
    
    // Create session
    const session: UserSession = {
      userId: user?.id || '',
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      smartAccountAddress: user?.smartAccountAddress || '',
    };

    await storage.createSession(session);

    // Remove sensitive data from response
    const userResponse = {
      id: user?.id || '',
      walletAddress: user?.walletAddress || '',
      smartAccountAddress: user?.smartAccountAddress || '',
      email: user?.email || '',
      name: user?.name || '',
      profileImage: user?.profileImage || '',
      createdAt: user?.createdAt || new Date(),
      lastLoginAt: user?.lastLoginAt || new Date(),
    };

    const response: ApiResponse<{
      user: typeof userResponse;
      token: string;
      expiresAt: Date;
    }> = {
      success: true,
      data: {
        user: userResponse,
        token,
        expiresAt: session.expiresAt,
      },
      message: user ? 'Login successful' : 'Registration successful',
    };

    res.json(response);
  } catch (error) {
    logger.error('Web3Auth login/register error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Authentication failed',
    };
    res.status(500).json(response);
  }
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Get user statistics
    const stats = await storage.getUserStats(user.id);

    const userProfile = {
      id: user.id,
      walletAddress: user.walletAddress,
      smartAccountAddress: user.smartAccountAddress,
      email: user.email,
      name: user.name,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      stats,
    };

    const response: ApiResponse<typeof userProfile> = {
      success: true,
      data: userProfile,
      message: 'Profile retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting user profile:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve profile',
    };
    res.status(500).json(response);
  }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { email, name, profileImage } = req.body;

    const updates: Partial<User> = {};
    
    if (email !== undefined) updates.email = email;
    if (name !== undefined) updates.name = name;
    if (profileImage !== undefined) updates.profileImage = profileImage;

    if (Object.keys(updates).length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No valid fields to update',
      };
      res.status(400).json(response);
      return;
    }

    const updatedUser = await storage.updateUser(user.id, updates);

    if (!updatedUser) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    const userResponse = {
      id: updatedUser.id,
      walletAddress: updatedUser.walletAddress,
      smartAccountAddress: updatedUser.smartAccountAddress,
      email: updatedUser.email,
      name: updatedUser.name,
      profileImage: updatedUser.profileImage,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
    };

    const response: ApiResponse<typeof userResponse> = {
      success: true,
      data: userResponse,
      message: 'Profile updated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update profile',
    };
    res.status(500).json(response);
  }
});

/**
 * Create or get smart account
 * POST /api/auth/smart-account
 */
router.post('/smart-account', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  // Detailed request logging to debug 401 errors
  logger.info('Smart account endpoint called', {
    headers: req.headers,
    body: req.body,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    authorization: req.get('Authorization'),
    timestamp: new Date().toISOString(),
  });

  try {
    const user = req.user!;

    if (user.smartAccountAddress) {
      // Smart account already exists, return existing data
      const smartAccountData = await gaslessService.createSmartAccount(user.walletAddress);
      
      const response: ApiResponse<typeof smartAccountData> = {
        success: true,
        data: smartAccountData,
        message: 'Smart account retrieved successfully',
      };

      res.json(response);
      return;
    }

    // Create new smart account
    const smartAccountData = await gaslessService.createSmartAccount(user.walletAddress);
    
    // Update user with smart account address
    const updatedUser = await storage.updateUser(user.id, {
      smartAccountAddress: smartAccountData.address,
    });

    logger.info(`Smart account created for user: ${user.id}`, {
      smartAccountAddress: smartAccountData.address,
      walletAddress: user.walletAddress,
    });

    const response: ApiResponse<typeof smartAccountData> = {
      success: true,
      data: smartAccountData,
      message: 'Smart account created successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error creating smart account:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create smart account',
    };
    res.status(500).json(response);
  }
});

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix

    if (token) {
      await storage.deleteSession(token);
      logger.info(`User logged out: ${req.user!.id}`);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error during logout:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Logout failed',
    };
    res.status(500).json(response);
  }
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    
    // Generate new token
    const newToken = generateToken(user.id);
    
    // Delete old session
    const authHeader = req.headers.authorization;
    const oldToken = authHeader?.substring(7);
    if (oldToken) {
      await storage.deleteSession(oldToken);
    }

    // Create new session
    const session: UserSession = {
      userId: user.id,
      token: newToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      smartAccountAddress: user.smartAccountAddress,
    };

    await storage.createSession(session);

    const response: ApiResponse<{
      token: string;
      expiresAt: Date;
    }> = {
      success: true,
      data: {
        token: newToken,
        expiresAt: session.expiresAt,
      },
      message: 'Token refreshed successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error refreshing token:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Token refresh failed',
    };
    res.status(500).json(response);
  }
});

export default router;
