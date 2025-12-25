import type { Session, FlowStep, Recipe } from '../types';
import { recipes } from '../recipes';
import { getMetrics } from './observability';
import { runFlow } from './orchestrator';
import { startSession, grantScopes } from './sessionBridge';

export interface TriggerResult {
  recipeId: string;
  triggered: boolean;
  reason?: string;
  error?: string;
}

export interface CronTrigger {
  type: 'cron';
  expr: string;
}

export interface ThresholdTrigger {
  type: 'threshold';
  metric: string;
  gte?: number;
  lte?: number;
}

export type Trigger = CronTrigger | ThresholdTrigger;

const triggeredRecipes = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000;

export async function tickCron(now: Date = new Date()): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  const min = now.getMinutes();
  const hour = now.getHours();
  const dom = now.getDate();
  const dow = now.getDay();

  for (const recipe of recipes) {
    const triggers = (recipe as any).triggers || [];
    
    for (const trigger of triggers) {
      if (trigger.type !== 'cron') continue;
      
      if (matchesSimpleCron(trigger.expr, { min, hour, dom, dow })) {
        if (isOnCooldown(recipe.id)) {
          results.push({ recipeId: recipe.id, triggered: false, reason: 'cooldown' });
          continue;
        }

        try {
          const session = createSystemSession(recipe.roles || ['admin']);
          await runFlow(recipe.steps, session);
          markTriggered(recipe.id);
          results.push({ recipeId: recipe.id, triggered: true });
        } catch (err: any) {
          results.push({ recipeId: recipe.id, triggered: false, error: err.message });
        }
      }
    }
  }

  return results;
}

export async function tickThreshold(): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const metrics = getMetrics({ start: now - dayMs, end: now });

  for (const recipe of recipes) {
    const triggers = (recipe as any).triggers || [];
    
    for (const trigger of triggers) {
      if (trigger.type !== 'threshold') continue;
      
      const value = getMetricValue(metrics, trigger.metric);
      const meetsThreshold = 
        (trigger.gte !== undefined && value >= trigger.gte) ||
        (trigger.lte !== undefined && value <= trigger.lte);
      
      if (meetsThreshold) {
        if (isOnCooldown(recipe.id)) {
          results.push({ recipeId: recipe.id, triggered: false, reason: 'cooldown' });
          continue;
        }

        try {
          const session = createSystemSession(recipe.roles || ['admin']);
          await runFlow(recipe.steps, session);
          markTriggered(recipe.id);
          results.push({ recipeId: recipe.id, triggered: true });
        } catch (err: any) {
          results.push({ recipeId: recipe.id, triggered: false, error: err.message });
        }
      }
    }
  }

  return results;
}

function matchesSimpleCron(
  expr: string,
  ctx: { min: number; hour: number; dom: number; dow: number }
): boolean {
  const parts = expr.split(' ').filter(p => p.trim());
  if (parts.length < 2) return false;

  const [minExpr, hourExpr, domExpr, , dowExpr] = parts;

  const minMatch = minExpr === '*' || parseInt(minExpr) === ctx.min;
  const hourMatch = hourExpr === '*' || parseInt(hourExpr) === ctx.hour;
  const domMatch = !domExpr || domExpr === '*' || parseInt(domExpr) === ctx.dom;
  const dowMatch = !dowExpr || dowExpr === '*' || parseInt(dowExpr) === ctx.dow;

  return minMatch && hourMatch && domMatch && dowMatch;
}

function getMetricValue(metrics: any, key: string): number {
  if (key === 'errorspermin' || key === 'errors_per_min') {
    const totalErrors = Object.values(metrics.byEndpoint || {}).reduce(
      (acc: number, ep: any) => acc + (ep.errors || 0),
      0
    );
    return totalErrors / 60;
  }

  if (key === 'totalcalls') {
    return metrics.totals || 0;
  }

  if (key === 'errorrate') {
    const total = metrics.totals || 1;
    const errors = Object.values(metrics.byEndpoint || {}).reduce(
      (acc: number, ep: any) => acc + (ep.errors || 0),
      0
    );
    return (errors as number) / total;
  }

  return 0;
}

function createSystemSession(roles: string[]): Session {
  const systemWallet = '0x0000000000000000000000000000000000000000';
  const session = startSession(systemWallet, roles as any);
  grantScopes(systemWallet, ['admin', 'messages', 'registry']);
  return session;
}

function isOnCooldown(recipeId: string): boolean {
  const lastTriggered = triggeredRecipes.get(recipeId);
  if (!lastTriggered) return false;
  return Date.now() - lastTriggered < COOLDOWN_MS;
}

function markTriggered(recipeId: string): void {
  triggeredRecipes.set(recipeId, Date.now());
}

export function getTriggeredRecipes(): Array<{ id: string; lastTriggered: number }> {
  const result: Array<{ id: string; lastTriggered: number }> = [];
  for (const [id, ts] of triggeredRecipes) {
    result.push({ id, lastTriggered: ts });
  }
  return result;
}

export function clearTriggerCooldown(recipeId: string): void {
  triggeredRecipes.delete(recipeId);
}
