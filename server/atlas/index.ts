import { Router } from 'express';
import atlasRoutes from './routes';
import proxyRouter from '../proxy';
import metricsRouter from '../metrics/routes';
import flowStreamRouter from '../flows/stream';
import rokuRouter from './roku';
import pulseRouter from './pulse';

const router = Router();

router.use('/proxy', proxyRouter);
router.use('/metrics', metricsRouter);
router.use('/flows', flowStreamRouter);
router.use('/roku', rokuRouter);
router.use('/pulse', pulseRouter);
router.use('/', atlasRoutes);

export default router;
