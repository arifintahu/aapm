/**
 * Prediction Market Events API Routes
 * Handle event creation, retrieval, and resolution
 */
import { Router, type Request, type Response } from 'express';
import { storage } from '../storage/index.js';
import { EventData, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * Get all events
 * GET /api/events
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const events = storage.getAllEvents();
    
    // Add statistics for each event
    const eventsWithStats = events.map(event => {
      const stats = storage.getEventStats(event.id);
      return {
        ...event,
        stats,
      };
    });

    const response: ApiResponse<typeof eventsWithStats> = {
      success: true,
      data: eventsWithStats,
      message: 'Events retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting events:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve events',
    };
    res.status(500).json(response);
  }
});

/**
 * Get specific event by ID
 * GET /api/events/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id, 10);
    
    if (isNaN(eventId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid event ID',
      };
      res.status(400).json(response);
      return;
    }

    const event = storage.getEvent(eventId);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Event not found',
      };
      res.status(404).json(response);
      return;
    }

    // Add statistics
    const stats = storage.getEventStats(eventId);
    const eventWithStats = {
      ...event,
      stats,
    };

    const response: ApiResponse<typeof eventWithStats> = {
      success: true,
      data: eventWithStats,
      message: 'Event retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting event:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve event',
    };
    res.status(500).json(response);
  }
});

/**
 * Create new event (Admin only)
 * POST /api/events
 */
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'Question is required and must be a string',
      };
      res.status(400).json(response);
      return;
    }

    // Get next event ID
    const allEvents = storage.getAllEvents();
    const nextId = Math.max(...allEvents.map(e => e.id), 0) + 1;

    const newEvent: EventData = {
      id: nextId,
      question: question.trim(),
      status: 'ACTIVE',
      totalYesBets: '0',
      totalNoBets: '0',
      totalPool: '0',
      createdAt: new Date(),
    };

    const createdEvent = storage.createEvent(newEvent);

    logger.info(`New event created: ${createdEvent.id}`, {
      question: createdEvent.question,
      createdBy: req.user?.id,
    });

    const response: ApiResponse<EventData> = {
      success: true,
      data: createdEvent,
      message: 'Event created successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating event:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create event',
    };
    res.status(500).json(response);
  }
});

/**
 * Resolve event (Admin only)
 * PUT /api/events/:id/resolve
 */
router.put('/:id/resolve', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { result } = req.body;

    if (isNaN(eventId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid event ID',
      };
      res.status(400).json(response);
      return;
    }

    if (!result || !['YES', 'NO'].includes(result)) {
      const response: ApiResponse = {
        success: false,
        error: 'Result must be either "YES" or "NO"',
      };
      res.status(400).json(response);
      return;
    }

    const event = storage.getEvent(eventId);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Event not found',
      };
      res.status(404).json(response);
      return;
    }

    if (event.status === 'RESOLVED') {
      const response: ApiResponse = {
        success: false,
        error: 'Event is already resolved',
      };
      res.status(400).json(response);
      return;
    }

    const updatedEvent = storage.updateEvent(eventId, {
      status: 'RESOLVED',
      result: result as 'YES' | 'NO',
      resolvedAt: new Date(),
    });

    logger.info(`Event resolved: ${eventId}`, {
      result,
      resolvedBy: req.user?.id,
    });

    const response: ApiResponse<EventData> = {
      success: true,
      data: updatedEvent!,
      message: 'Event resolved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error resolving event:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to resolve event',
    };
    res.status(500).json(response);
  }
});

/**
 * Update event betting totals (Internal use)
 * PUT /api/events/:id/totals
 */
router.put('/:id/totals', async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { totalYesBets, totalNoBets, totalPool } = req.body;

    if (isNaN(eventId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid event ID',
      };
      res.status(400).json(response);
      return;
    }

    const event = storage.getEvent(eventId);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Event not found',
      };
      res.status(404).json(response);
      return;
    }

    const updates: Partial<EventData> = {};
    
    if (totalYesBets !== undefined) updates.totalYesBets = totalYesBets;
    if (totalNoBets !== undefined) updates.totalNoBets = totalNoBets;
    if (totalPool !== undefined) updates.totalPool = totalPool;

    const updatedEvent = storage.updateEvent(eventId, updates);

    const response: ApiResponse<EventData> = {
      success: true,
      data: updatedEvent!,
      message: 'Event totals updated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating event totals:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update event totals',
    };
    res.status(500).json(response);
  }
});

/**
 * Get event betting history
 * GET /api/events/:id/bets
 */
router.get('/:id/bets', async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id, 10);
    
    if (isNaN(eventId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid event ID',
      };
      res.status(400).json(response);
      return;
    }

    const event = storage.getEvent(eventId);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Event not found',
      };
      res.status(404).json(response);
      return;
    }

    const bets = storage.getBetsByEvent(eventId);
    
    // Sort by timestamp (newest first)
    bets.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const response: ApiResponse<typeof bets> = {
      success: true,
      data: bets,
      message: 'Event betting history retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting event betting history:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve event betting history',
    };
    res.status(500).json(response);
  }
});

export default router;