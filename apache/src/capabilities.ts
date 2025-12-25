const TTL_MS = 60000;

const caps = new Map<string, number>();

export async function grant(moduleId: string, cap: string): Promise<void> {
  caps.set(`${moduleId}:${cap}`, Date.now() + TTL_MS);
}

export function hasCap(moduleId: string, cap: string): boolean {
  const k = `${moduleId}:${cap}`;
  const exp = caps.get(k);
  if (!exp) return false;
  if (Date.now() > exp) {
    caps.delete(k);
    return false;
  }
  return true;
}

export function revokeAll() {
  caps.clear();
}
