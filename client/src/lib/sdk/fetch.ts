export async function p3Fetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = `p3:cache:${path}`;
  const cached = sessionStorage.getItem(key);
  if (cached && !init.method) return JSON.parse(cached);

  const res = await fetch(path, { ...init, headers: { ...(init.headers || {}), 'Accept': 'application/json' } });
  if (!res.ok) {
    // Single retry
    const retry = await fetch(path, init);
    if (!retry.ok) throw new Error(`HTTP ${retry.status}`);
    const json = await retry.json();
    if (!init.method) sessionStorage.setItem(key, JSON.stringify(json));
    return json;
  }
  const json = await res.json();
  if (!init.method) sessionStorage.setItem(key, JSON.stringify(json));
  return json;
}
