const enabled = process.env.ENABLE_PRIVACY_ANALYTICS !== "false";

type Event = { 
  type: string; 
  ts: number; 
  hashedUserId: string; 
  fields?: Record<string, any> 
};

function laplaceNoise(scale: number): number {
  const u = 1 - Math.random();
  return (Math.log(u) < 0 ? 1 : -1) * Math.log(Math.abs(u)) * scale;
}

export function dpCount(rawCount: number, epsilon = 1.0): number {
  if (!enabled) return rawCount;
  
  const scale = 1 / epsilon;
  const noise = laplaceNoise(scale);
  return Math.max(0, Math.round(rawCount + noise));
}

export function aggregate(events: Event[], k = 50, epsilon = 1.0): Record<string, number> {
  if (!enabled) {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.type, (counts.get(e.type) || 0) + 1);
    return Object.fromEntries(counts);
  }

  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.type, (counts.get(e.type) || 0) + 1);

  const result: Record<string, number> = {};
  for (const [type, count] of counts.entries()) {
    if (count < k) continue;
    result[type] = dpCount(count, epsilon);
  }
  return result;
}

export function analyzeUserBehavior(events: Event[], epsilon = 0.5) {
  if (!enabled) return { totalEvents: events.length };
  
  const hourCounts = new Array(24).fill(0);
  for (const e of events) {
    const hour = new Date(e.ts).getHours();
    hourCounts[hour]++;
  }
  
  return {
    totalEvents: dpCount(events.length, epsilon),
    peakHour: hourCounts.indexOf(Math.max(...hourCounts)),
    averageEventsPerHour: dpCount(events.length / 24, epsilon)
  };
}
