declare const VITE_KYBER_ENABLED: string | undefined;

export function isKyberEnabled(): boolean {
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('kyber_enabled') === 'true') {
      return true;
    }
  }
  try {
    return (import.meta as unknown as { env: Record<string, string> }).env?.VITE_KYBER_ENABLED === 'true';
  } catch {
    return false;
  }
}

export function setKyberEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('kyber_enabled', enabled ? 'true' : 'false');
  }
}

export function isFeatureEnabled(featureName: string): boolean {
  const localValue = typeof window !== 'undefined' 
    ? localStorage.getItem(`${featureName.toLowerCase()}_enabled`) 
    : null;
  
  if (localValue === 'true') {
    return true;
  }
  
  try {
    const envVar = `VITE_${featureName.toUpperCase()}_ENABLED`;
    const envValue = (import.meta as unknown as { env: Record<string, string> }).env?.[envVar];
    return envValue === 'true';
  } catch {
    return false;
  }
}
