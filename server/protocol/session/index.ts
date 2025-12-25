/**
 * Session Fabric Index
 * 
 * Central export point for Atlas API 2.0 Session Fabric.
 * Provides session management, lane communication, and priority scheduling.
 */

import { Router } from 'express';

export {
  handshakeRouter,
  getSession,
  getAllSessions,
  updateSessionActivity,
  closeSession,
  createSession,
  validateSession,
  addSSEConnection,
  removeSSEConnection,
  setSessionConnectionState,
  type DeviceCapabilities,
  type SessionLanes,
  type HandshakeResponse,
  type Session,
} from './handshake';

export {
  lanesRouter,
  publishToLane,
  publishManifest,
  publishAccess,
  publishBinaryAccessFrame,
  publishSignedAccessFrame,
  broadcastBinaryAccessFrame,
  broadcastToLane,
  getConnectedClients,
  type SSEClient,
  type LaneEvent,
  type ManifestEvent,
  type AccessEvent,
  type ReceiptPayload,
  type BinaryAccessFrameOptions,
} from './lanes';

export {
  priorityScheduler,
  PriorityScheduler,
  Priority,
  type LaneType,
  type PriorityEntry,
  type FocusSignal,
} from './priority';

import { handshakeRouter } from './handshake';
import { lanesRouter } from './lanes';

export const sessionRouter = Router();

sessionRouter.use('/session', handshakeRouter);
sessionRouter.use('/session', lanesRouter);

export default sessionRouter;
