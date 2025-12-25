import { Router, Request, Response } from 'express';
import { 
  listEvents, 
  listEventsReverse, 
  getEventData, 
  countEvents, 
  getRecentEvents,
  getEventsByIds 
} from '../explorer/index';

const router = Router();

router.get('/api/explorer/:appId/events', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const startTs = parseInt(req.query.start as string) || 0;
    const endTs = parseInt(req.query.end as string) || Date.now();
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    
    const events = order === 'asc' 
      ? await listEvents(appId, startTs, endTs, limit)
      : await listEventsReverse(appId, startTs, endTs, limit);
    
    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Explorer list error:', error);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

router.get('/api/explorer/:appId/recent', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const count = Math.min(parseInt(req.query.count as string) || 10, 100);
    
    const events = await getRecentEvents(appId, count);
    res.json({ events });
  } catch (error) {
    console.error('Explorer recent error:', error);
    res.status(500).json({ error: 'Failed to get recent events' });
  }
});

router.get('/api/explorer/:appId/count', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const startTs = req.query.start ? parseInt(req.query.start as string) : undefined;
    const endTs = req.query.end ? parseInt(req.query.end as string) : undefined;
    
    const count = await countEvents(appId, startTs, endTs);
    res.json({ count });
  } catch (error) {
    console.error('Explorer count error:', error);
    res.status(500).json({ error: 'Failed to count events' });
  }
});

router.get('/api/explorer/event/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await getEventData(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ event });
  } catch (error) {
    console.error('Explorer get error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

router.post('/api/explorer/events/batch', async (req: Request, res: Response) => {
  try {
    const { eventIds } = req.body;
    
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: 'eventIds array required' });
    }
    
    if (eventIds.length > 100) {
      return res.status(400).json({ error: 'Max 100 events per batch' });
    }
    
    const events = await getEventsByIds(eventIds);
    res.json({ events });
  } catch (error) {
    console.error('Explorer batch error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

export default router;
