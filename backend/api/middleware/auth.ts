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
    
    // Log all authentication attempts for debugging
    logger.info('Authentication attempt', {
      url: req.url,
      method: req.method,
      authHeader: authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'missing',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: Missing or invalid authorization header', {
        url: req.url,
        authHeader: authHeader || 'undefined',
      });
      
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
      
      logger.info('JWT token verified successfully', {
        userId: decoded.userId,
        url: req.url,
      });
      
      // Get user from storage
      const user = storage.getUserById(decoded.userId);
      
      if (!user) {
        logger.warn('Authentication failed: User not found', {
          userId: decoded.userId,
          url: req.url,
        });
        
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
        logger.warn('Authentication failed: Invalid or expired session', {
          userId: decoded.userId,
          url: req.url,
        });
        
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