import webPush from 'web-push';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'vapid-keys' });

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:push@p3protocol.app';

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
let isConfigured = false;

if (!vapidPublicKey || !vapidPrivateKey) {
  logger.info('[VAPID] No VAPID keys found in environment, generating new keys...');
  const keys = webPush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  logger.info('[VAPID] Generated new VAPID keys. For persistence, set these environment variables:');
  logger.info(`[VAPID] VAPID_PUBLIC_KEY=${vapidPublicKey}`);
  logger.info(`[VAPID] VAPID_PRIVATE_KEY=${vapidPrivateKey}`);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export function getVapidPrivateKey(): string {
  return vapidPrivateKey;
}

export function getVapidSubject(): string {
  return VAPID_SUBJECT;
}

export function configureWebPush(): void {
  if (isConfigured) return;
  webPush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
  isConfigured = true;
  logger.info('[VAPID] Web push configured with VAPID credentials');
}

configureWebPush();

export { webPush };
