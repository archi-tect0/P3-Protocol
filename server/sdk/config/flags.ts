export const sdkFlags = {
  sdkEnabled: process.env.FLAG_SDK_ENABLED !== '0',
  sdkCrypto: process.env.FLAG_SDK_CRYPTO !== '0',
  sdkAnchor: process.env.FLAG_SDK_ANCHOR !== '0',
  sdkSession: process.env.FLAG_SDK_SESSION !== '0',
  sdkDAO: process.env.FLAG_SDK_DAO !== '0',
  sdkExplorer: process.env.FLAG_SDK_EXPLORER !== '0',
  sdkAudit: process.env.FLAG_SDK_AUDIT !== '0',
  sdkMedia: process.env.FLAG_SDK_MEDIA !== '0',
  ticketGate: process.env.FLAG_TICKET_GATE === '1',
  ticketExpirySeconds: parseInt(process.env.TICKET_EXPIRY || '604800', 10),
};

export function isFlagEnabled(flag: Exclude<keyof typeof sdkFlags, 'ticketExpirySeconds'>): boolean {
  return sdkFlags[flag] as boolean;
}

export function getEnabledModules(): string[] {
  const moduleFlags = ['sdkCrypto', 'sdkAnchor', 'sdkSession', 'sdkDAO', 'sdkExplorer', 'sdkAudit', 'sdkMedia'];
  return Object.entries(sdkFlags)
    .filter(([key, value]) => moduleFlags.includes(key) && value)
    .map(([key]) => key.replace('sdk', '').toLowerCase());
}
