import { Router } from 'express';
import { createError } from '../middleware/errors';
import { listEvents, listEventsReverse, getEventData, countEvents, getRecentEvents } from '../../explorer/index';

const router = Router();

router.post('/feed', async (req, res, next) => {
  try {
    const { topic, limit = 100, since, cursor } = req.body;

    if (!topic) {
      throw createError('topic required', 400, 'invalid_request');
    }

    const startTs = since || 0;
    const endTs = Date.now();

    const eventIds = await listEventsReverse(topic, startTs, endTs, Math.min(limit + 1, 1000));
    
    const hasMore = eventIds.length > limit;
    const resultIds = hasMore ? eventIds.slice(0, limit) : eventIds;

    const items = await Promise.all(
      resultIds.map(async (id) => {
        const data = await getEventData(id);
        return data ? { id, eventId: id, ...data } : null;
      })
    );

    res.json({
      items: items.filter(Boolean),
      hasMore,
      cursor: hasMore ? resultIds[resultIds.length - 1] : undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/event/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    const data = await getEventData(eventId);
    
    if (!data) {
      return res.json(null);
    }

    res.json({ id: eventId, eventId, ...data });
  } catch (err) {
    next(err);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    const { query, appId, limit = 50 } = req.body;

    if (!query) {
      throw createError('query required', 400, 'invalid_request');
    }

    // Basic search implementation - in production, use proper search index
    const topic = appId || 'global';
    const eventIds = await listEventsReverse(topic, 0, Date.now(), 1000);
    
    const results = [];
    for (const id of eventIds) {
      if (results.length >= limit) break;
      
      const data = await getEventData(id);
      if (data) {
        const searchable = JSON.stringify(data).toLowerCase();
        if (searchable.includes(query.toLowerCase())) {
          results.push({ id, eventId: id, ...data });
        }
      }
    }

    res.json({
      items: results,
      hasMore: false,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/stats', async (req, res, next) => {
  try {
    const { appId } = req.body;
    const topic = appId || 'global';

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const [totalEvents, last24h] = await Promise.all([
      countEvents(topic),
      countEvents(topic, dayAgo, now),
    ]);

    // Get recent events to calculate top events
    const recentEvents = await getRecentEvents(topic, 100);
    const eventCounts = new Map<string, number>();
    
    for (const { eventId } of recentEvents) {
      const data = await getEventData(eventId);
      if (data?.event) {
        eventCounts.set(data.event, (eventCounts.get(data.event) || 0) + 1);
      }
    }

    const topEvents = Array.from(eventCounts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ totalEvents, last24h, topEvents });
  } catch (err) {
    next(err);
  }
});

export default router;
