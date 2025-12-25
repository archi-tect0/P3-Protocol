import { Router } from 'express';
import { getEnabledModules } from '../config/flags';

const router = Router();

const SDK_VERSION = '2.0.0';

router.get('/', (req, res) => {
  res.json({
    version: SDK_VERSION,
    modules: getEnabledModules(),
    server: 'p3-protocol',
  });
});

export default router;
