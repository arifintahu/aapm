/**
 * Request validation middleware
 * Provides validation utilities for API requests
 */
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate wallet address format
 */
export function validateWalletAddress(address: string): ValidationResult {
  const errors: string[] = [];
  
  if (!address) {
    errors.push('Wallet address is required');
  } else if (typeof address !== 'string') {
    errors.push('Wallet address must be a string');
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    errors.push('Invalid wallet address format');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (email && typeof email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate bet amount
 */
export function validateBetAmount(amount: any): ValidationResult {
  const errors: string[] = [];
  
  if (amount === undefined || amount === null) {
    errors.push('Bet amount is required');
  } else if (typeof amount !== 'string' && typeof amount !== 'number') {
    errors.push('Bet amount must be a string or number');
  } else {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount)) {
      errors.push('Bet amount must be a valid number');
    } else if (numAmount <= 0) {
      errors.push('Bet amount must be greater than 0');
    } else if (numAmount > 1000) {
      errors.push('Bet amount cannot exceed 1000 ETH');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate bet outcome
 */
export function validateBetOutcome(outcome: any): ValidationResult {
  const errors: string[] = [];
  
  if (outcome === undefined || outcome === null) {
    errors.push('Bet outcome is required');
  } else if (typeof outcome !== 'boolean') {
    errors.push('Bet outcome must be a boolean (true/false)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: any, limit: any): ValidationResult {
  const errors: string[] = [];
  
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    } else if (pageNum > 1000) {
      errors.push('Page number cannot exceed 1000');
    }
  }
  
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1) {
      errors.push('Limit must be a positive integer');
    } else if (limitNum > 100) {
      errors.push('Limit cannot exceed 100');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate event ID format
 */
export function validateEventId(eventId: any): ValidationResult {
  const errors: string[] = [];
  
  if (!eventId) {
    errors.push('Event ID is required');
  } else if (typeof eventId !== 'string') {
    errors.push('Event ID must be a string');
  } else if (eventId.length < 1 || eventId.length > 100) {
    errors.push('Event ID must be between 1 and 100 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate event creation data
 */
export function validateEventCreation(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data.title || typeof data.title !== 'string') {
    errors.push('Event title is required and must be a string');
  } else if (data.title.length < 3 || data.title.length > 200) {
    errors.push('Event title must be between 3 and 200 characters');
  }
  
  if (!data.description || typeof data.description !== 'string') {
    errors.push('Event description is required and must be a string');
  } else if (data.description.length < 10 || data.description.length > 1000) {
    errors.push('Event description must be between 10 and 1000 characters');
  }
  
  if (!data.endTime) {
    errors.push('Event end time is required');
  } else {
    const endTime = new Date(data.endTime);
    if (isNaN(endTime.getTime())) {
      errors.push('Invalid end time format');
    } else if (endTime <= new Date()) {
      errors.push('End time must be in the future');
    } else if (endTime > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) {
      errors.push('End time cannot be more than 1 year in the future');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generic validation middleware factory
 */
export function validateRequest(
  validationFn: (data: any) => ValidationResult,
  dataSource: 'body' | 'params' | 'query' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[dataSource];
      const result = validationFn(data);
      
      if (!result.isValid) {
        logger.warn('Validation failed:', {
          url: req.url,
          method: req.method,
          errors: result.errors,
          data: dataSource === 'body' ? '[REDACTED]' : data,
        });
        
        const response: ApiResponse = {
          success: false,
          error: 'Validation failed',
          details: result.errors,
        };
        
        res.status(400).json(response);
        return;
      }
      
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
      };
      
      res.status(500).json(response);
    }
  };
}

/**
 * Sanitize input data
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Sanitization middleware
 */
export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.body) {
      req.body = sanitizeInput(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeInput(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeInput(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Sanitization middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Request processing error',
    };
    
    res.status(500).json(response);
  }
}

/**
 * Rate limiting data store (in-memory for development)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiting middleware
 */
export function rateLimit(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      let record = rateLimitStore.get(key);
      
      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + windowMs,
        };
        rateLimitStore.set(key, record);
        next();
        return;
      }
      
      if (record.count >= maxRequests) {
        logger.warn('Rate limit exceeded:', {
          ip: key,
          count: record.count,
          maxRequests,
          resetTime: new Date(record.resetTime),
        });
        
        const response: ApiResponse = {
          success: false,
          error: 'Rate limit exceeded',
          details: [`Too many requests. Try again after ${new Date(record.resetTime).toISOString()}`],
        };
        
        res.status(429).json(response);
        return;
      }
      
      record.count++;
      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      next(); // Continue on error to avoid blocking legitimate requests
    }
  };
}

/**
 * Clean up rate limit store periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes