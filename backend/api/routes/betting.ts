/**
 * Betting API Routes
 * Handle bet placement, history, and gasless transactions
 */
import { Router, type Request, type Response } from 'express';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage/index.js';
import { gaslessService } from '../services/gasless.js';
import { BetRecord, ApiResponse, TransactionRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config/environment.js';

const router = Router();

// Prediction Market Contract ABI (minimal for betting)
const PREDICTION_MARKET_ABI = [
  'function placeBet(uint256 eventId, bool betYes) external',
  'function events(uint256) external view returns (string memory question, uint8 status, bool result, uint256 totalYesBets, uint256 totalNoBets, uint256 totalPool)',
];

/**
 * Place a bet (gasless transaction)
 * POST /api/betting/place-bet
 */
router.post('/place-bet', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, betType, amount, smartAccountAddress } = req.body;
    const userId = req.user!.id;

    // Validate input
    if (!eventId || !betType || !amount || !smartAccountAddress) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: eventId, betType, amount, smartAccountAddress',
      };
      res.status(400).json(response);
      return;
    }

    if (!['YES', 'NO'].includes(betType)) {
      const response: ApiResponse = {
        success: false,
        error: 'betType must be either "YES" or "NO"',
      };
      res.status(400).json(response);
      return;
    }

    // Validate event exists and is active
    const event = await storage.getEvent(parseInt(eventId, 10));
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Event not found',
      };
      res.status(404).json(response);
      return;
    }

    if (event.status !== 'ACTIVE') {
      const response: ApiResponse = {
        success: false,
        error: 'Event is not active for betting',
      };
      res.status(400).json(response);
      return;
    }

    // Validate amount
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid bet amount',
      };
      res.status(400).json(response);
      return;
    }

    // Create bet record
    const betId = uuidv4();
    const betRecord: BetRecord = {
      id: betId,
      userId,
      eventId: parseInt(eventId, 10),
      betType: betType as 'YES' | 'NO',
      amount: amount.toString(),
      transactionHash: '', // Will be updated after transaction
      timestamp: new Date(),
      status: 'PENDING',
    };

    await storage.createBetRecord(betRecord);

    try {
      // Prepare contract interaction
      const contractAddress = config.contracts.predictionMarketAddress;
      if (!contractAddress) {
        throw new Error('Prediction market contract address not configured');
      }

      // Create contract interface
      const contractInterface = new ethers.Interface(PREDICTION_MARKET_ABI);
      
      // Encode function call
      const functionData = contractInterface.encodeFunctionData('placeBet', [
        eventId,
        betType === 'YES'
      ]);

      const transaction = {
        to: contractAddress,
        data: functionData,
        value: '0', // Assuming we're using ERC-20 tokens, not ETH
      };

      logger.info(`Placing bet for user ${userId}`, {
        betId,
        eventId,
        betType,
        amount,
        smartAccountAddress,
      });

      // Execute gasless transaction
      const txResponse = await gaslessService.executeGaslessTransaction(
        smartAccountAddress,
        [transaction]
      );

      if (txResponse.txHash) {
        // Update bet record with transaction details
        const updatedBet = await storage.updateBetRecord(betId, {
          transactionHash: txResponse.txHash,
          blockNumber: undefined, // Will be updated when we get receipt
          status: 'CONFIRMED',
        });

        // Update event totals (simplified - in production, this should be done by listening to contract events)
        const currentYes = parseFloat(event.totalYesBets);
        const currentNo = parseFloat(event.totalNoBets);
        const currentPool = parseFloat(event.totalPool);

        const newYes = betType === 'YES' ? currentYes + betAmount : currentYes;
        const newNo = betType === 'NO' ? currentNo + betAmount : currentNo;
        const newPool = currentPool + betAmount;

        await storage.updateEvent(parseInt(eventId, 10), {
          totalYesBets: newYes.toString(),
          totalNoBets: newNo.toString(),
          totalPool: newPool.toString(),
        });

        logger.info(`Bet placed successfully: ${betId}`, {
          transactionHash: txResponse.txHash,
          smartAccount: txResponse.smartAccount,
        });

        const response: ApiResponse<{
          bet: BetRecord;
          transaction: typeof txResponse;
        }> = {
          success: true,
          data: {
            bet: updatedBet!,
            transaction: txResponse,
          },
          message: 'Bet placed successfully',
        };

        res.json(response);
      } else {
        // Transaction failed
        await storage.updateBetRecord(betId, {
          status: 'FAILED',
        });

        const response: ApiResponse = {
          success: false,
          error: 'Transaction failed',
        };
        res.status(500).json(response);
      }
    } catch (txError) {
      logger.error('Transaction error:', txError);
      
      // Update bet record as failed
      await storage.updateBetRecord(betId, {
        status: 'FAILED',
      });

      const response: ApiResponse = {
        success: false,
        error: `Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`,
      };
      res.status(500).json(response);
    }
  } catch (error) {
    logger.error('Error placing bet:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to place bet',
    };
    res.status(500).json(response);
  }
});

/**
 * Get user betting history
 * GET /api/betting/history
 */
router.get('/history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20, eventId, status } = req.query;

    let bets = await storage.getBetsByUser(userId);

    // Filter by event ID if provided
    if (eventId) {
      const eventIdNum = parseInt(eventId as string, 10);
      if (!isNaN(eventIdNum)) {
        bets = bets.filter(bet => bet.eventId === eventIdNum);
      }
    }

    // Filter by status if provided
    if (status && ['PENDING', 'CONFIRMED', 'FAILED'].includes(status as string)) {
      bets = bets.filter(bet => bet.status === status);
    }

    // Sort by timestamp (newest first)
    bets.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Pagination
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedBets = bets.slice(startIndex, endIndex);

    // Add event details to each bet
    const betsWithEvents = await Promise.all(paginatedBets.map(async bet => {
      const event = await storage.getEvent(bet.eventId);
      return {
        ...bet,
        event: event ? {
          id: event.id,
          question: event.question,
          status: event.status,
          result: event.result,
        } : null,
      };
    }));

    const response: ApiResponse<{
      bets: typeof betsWithEvents;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> = {
      success: true,
      data: {
        bets: betsWithEvents,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: bets.length,
          totalPages: Math.ceil(bets.length / limitNum),
        },
      },
      message: 'Betting history retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting betting history:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve betting history',
    };
    res.status(500).json(response);
  }
});

/**
 * Get specific bet details
 * GET /api/betting/:betId
 */
router.get('/:betId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { betId } = req.params;
    const userId = req.user!.id;

    const bet = await storage.getBetRecord(betId);

    if (!bet) {
      const response: ApiResponse = {
        success: false,
        error: 'Bet not found',
      };
      res.status(404).json(response);
      return;
    }

    // Check if bet belongs to the user
    if (bet.userId !== userId) {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied',
      };
      res.status(403).json(response);
      return;
    }

    // Add event details
    const event = await storage.getEvent(bet.eventId);
    const betWithEvent = {
      ...bet,
      event: event ? {
        id: event.id,
        question: event.question,
        status: event.status,
        result: event.result,
      } : null,
    };

    const response: ApiResponse<typeof betWithEvent> = {
      success: true,
      data: betWithEvent,
      message: 'Bet details retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting bet details:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve bet details',
    };
    res.status(500).json(response);
  }
});

/**
 * Get user betting statistics
 * GET /api/betting/stats
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const stats = await storage.getUserStats(userId);

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      message: 'User betting statistics retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting user stats:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve user statistics',
    };
    res.status(500).json(response);
  }
});

/**
 * Estimate gas for bet placement
 * POST /api/betting/estimate-gas
 */
router.post('/estimate-gas', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, betType, smartAccountAddress } = req.body;

    if (!eventId || !betType || !smartAccountAddress) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: eventId, betType, smartAccountAddress',
      };
      res.status(400).json(response);
      return;
    }

    const contractAddress = config.contracts.predictionMarketAddress;
    if (!contractAddress) {
      const response: ApiResponse = {
        success: false,
        error: 'Prediction market contract address not configured',
      };
      res.status(500).json(response);
      return;
    }

    // Create contract interface
    const contractInterface = new ethers.Interface(PREDICTION_MARKET_ABI);
    
    // Encode function call
    const functionData = contractInterface.encodeFunctionData('placeBet', [
      eventId,
      betType === 'YES'
    ]);

    const transaction = {
      to: contractAddress,
      data: functionData,
      value: '0',
    };

    const gasEstimate = await gaslessService.estimateGas(
      smartAccountAddress,
      [transaction]
    );

    const response: ApiResponse<typeof gasEstimate> = {
      success: true,
      data: gasEstimate,
      message: 'Gas estimation completed',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error estimating gas:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to estimate gas',
    };
    res.status(500).json(response);
  }
});

/**
 * Execute bundled transactions gaslessly
 * POST /api/betting/send-bundle
 */
router.post('/send-bundle', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerAddress, transactions, signature } = req.body;

    // Validate input
    if (!ownerAddress || !Array.isArray(transactions) || transactions.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request: ownerAddress and transactions array required',
      };
      res.status(400).json(response);
      return;
    }

    // Validate transaction format
    for (const tx of transactions) {
      if (!tx.to || !tx.data) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid transaction format: to and data fields required',
        };
        res.status(400).json(response);
        return;
      }
    }

    logger.info('Executing bundle transaction', { 
      ownerAddress, 
      transactionCount: transactions.length 
    });

    // Normalize transactions and add signature to each transaction
    const normalizedTransactions = transactions.map(tx => ({
      to: tx.to,
      data: tx.data,
      value: tx.value || '0',
      signature: tx.signature || signature // Use transaction-specific signature or global signature
    }));

    // Execute gasless bundle
    const result = await gaslessService.executeGaslessTransaction(
      ownerAddress,
      normalizedTransactions
    );

    const response: ApiResponse = {
      success: true,
      data: {
        txHash: result.txHash,
        smartAccount: result.smartAccount,
        transactionCount: transactions.length
      },
    };

    logger.info('Bundle transaction executed successfully', {
      ownerAddress,
      txHash: result.txHash,
      smartAccount: result.smartAccount
    });

    res.json(response);
  } catch (error) {
    logger.error('Error executing bundle transaction:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to execute bundle transaction',
    };
    res.status(500).json(response);
  }
});

/**
 * Get transaction hash for user to sign
 * POST /api/betting/get-tx-hash
 */
router.post('/get-tx-hash', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerAddress, to, value = '0', data, transactions } = req.body;

    // Check if this is a batch transaction request
    if (transactions && Array.isArray(transactions)) {
      // Batch transaction request
      if (!ownerAddress || !transactions.length) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing required fields: ownerAddress, transactions array',
        };
        res.status(400).json(response);
        return;
      }

      // Validate transaction format
      for (const tx of transactions) {
        if (!tx.to || !tx.data) {
          const response: ApiResponse = {
            success: false,
            error: 'Invalid transaction format: to and data fields required for each transaction',
          };
          res.status(400).json(response);
          return;
        }
      }

      // Get batch transaction hash to sign
      const result = await gaslessService.getBatchTransactionHashToSign(
        ownerAddress,
        transactions
      );

      const response: ApiResponse = {
        success: true,
        data: {
          txHash: result.txHash,
          smartAccount: result.smartAccount,
          nonce: result.nonce
        }
      };

      res.json(response);
    } else {
      // Single transaction request
      if (!ownerAddress || !to || !data) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing required fields: ownerAddress, to, data',
        };
        res.status(400).json(response);
        return;
      }

      // Get single transaction hash to sign
      const result = await gaslessService.getTransactionHashToSign(
        ownerAddress,
        to,
        value,
        data
      );

      logger.info('DEBUG: get-tx-hash response', {
        ownerAddress,
        to,
        value,
        data,
        txHash: result.txHash,
        smartAccount: result.smartAccount,
        nonce: result.nonce
      });

      const response: ApiResponse = {
        success: true,
        data: {
          txHash: result.txHash,
          smartAccount: result.smartAccount,
          nonce: result.nonce
        }
      };

      res.json(response);
    }
  } catch (error) {
    logger.error('Error getting transaction hash:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get transaction hash',
    };
    res.status(500).json(response);
  }
});

export default router;