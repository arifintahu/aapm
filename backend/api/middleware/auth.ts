import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage/index.js';
import { User, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: 'Authorization token required',
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; iat: number; exp: number };
      
      // Get user from storage
      const user = storage.getUserById(decoded.userId);
      
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found',
        };
        res.status(401).json(response);
        return;
      }

      // Check if session exists and is valid
      const session = storage.getSession(token);
      
      if (!session) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid or expired session',
        };
        res.status(401).json(response);
        return;
      }

      // Attach user to request
      req.user = user;
      
      // Update last login time
      storage.updateUser(user.id, {
        lastLoginAt: new Date(),
      });

      next();
    } catch (jwtError) {
      logger.error('JWT verification error:', jwtError);
      
      const response: ApiResponse = {
        success: false,
        error: 'Invalid token',
      };
      res.status(401).json(response);
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Authentication failed',
    };
    res.status(500).json(response);
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; iat: number; exp: number };
      const user = storage.getUserById(decoded.userId);
      
      if (user) {
        const session = storage.getSession(token);
        if (session) {
          req.user = user;
          storage.updateUser(user.id, {
            lastLoginAt: new Date(),
          });
        }
      }
    } catch (jwtError) {
      // Invalid token, but continue without user
      logger.warn('Invalid token in optional auth:', jwtError);
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

/**
 * Admin middleware
 * Requires authentication and admin privileges
 */
export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // First run auth middleware
  await authMiddleware(req, res, () => {
    // Check if user has admin privileges
    // For now, we'll use a simple check - in production, this should be more sophisticated
    const user = req.user;
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Authentication required',
      };
      res.status(401).json(response);
      return;
    }

    // Simple admin check - you can enhance this based on your requirements
    // For demo purposes, we'll check if the user's wallet address matches a specific admin address
    const adminAddresses = [
      '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5e', // Example admin address
      // Add more admin addresses as needed
    ];

    const isAdmin = adminAddresses.includes(user.walletAddress);
    
    if (!isAdmin) {
      const response: ApiResponse = {
        success: false,
        error: 'Admin privileges required',
      };
      res.status(403).json(response);
      return;
    }

    next();
  });
};

/**
 * Generate JWT token for user
 */
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): { userId: string; iat: number; exp: number } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; iat: number; exp: number };
  } catch (error) {
    return null;
  }
};

export default authMiddleware;