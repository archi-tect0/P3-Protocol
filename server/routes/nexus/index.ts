import { Router } from 'express';
import type { IStorage } from '../../storage';
import { createMessagingRoutes } from './messaging';
import { createNotesRoutes } from './notes';
import { createInboxRoutes } from './inbox';
import { createCallsRoutes } from './calls';
import { createDirectoryRoutes } from './directory';
import { createReceiptsRoutes } from './receipts';

export function mountNexusRoutes(storage: IStorage): Router {
  const router = Router();

  router.use('/messaging', createMessagingRoutes(storage));
  router.use('/notes', createNotesRoutes(storage));
  router.use('/inbox', createInboxRoutes(storage));
  router.use('/calls', createCallsRoutes(storage));
  router.use('/directory', createDirectoryRoutes(storage));
  router.use('/receipts', createReceiptsRoutes(storage));

  return router;
}

export { createMessagingRoutes } from './messaging';
export { createNotesRoutes } from './notes';
export { createInboxRoutes } from './inbox';
export { createCallsRoutes } from './calls';
export { createDirectoryRoutes } from './directory';
export { createReceiptsRoutes } from './receipts';
