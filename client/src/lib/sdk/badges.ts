import { attest } from "./attest";
import { isPolicyLoaded } from "./policy";
import { isAnchorsLoaded } from "./anchors";
import { isTicketValid } from "./bridge";
import type { BadgeState } from "./types";

export interface BadgeInfo {
  state: BadgeState;
  label: string;
  color: string;
  icon: string;
  details: string[];
}

export async function getBadgeState(): Promise<BadgeInfo> {
  const details: string[] = [];
  
  // Check anchors
  if (!isAnchorsLoaded()) {
    details.push('Anchors not loaded');
  }
  
  // Check policy
  if (!isPolicyLoaded()) {
    details.push('Using dev policy');
  }
  
  // Check ticket
  if (!isTicketValid()) {
    details.push('No valid session ticket');
  }
  
  // Run attestation
  try {
    const result = await attest();
    if (!result.valid) {
      return {
        state: 'rejected',
        label: 'Rejected',
        color: 'red',
        icon: '✗',
        details: [...details, ...result.errors]
      };
    }
    if (result.warnings.length > 0) {
      return {
        state: 'sandboxed',
        label: 'Sandboxed',
        color: 'yellow',
        icon: '⚠',
        details: [...details, ...result.warnings]
      };
    }
  } catch (e: any) {
    return {
      state: 'rejected',
      label: 'Rejected',
      color: 'red',
      icon: '✗',
      details: [...details, e.message]
    };
  }
  
  // All checks passed
  if (details.length === 0) {
    return {
      state: 'verified',
      label: 'Verified Protocol',
      color: 'green',
      icon: '✓',
      details: ['All attestation checks passed']
    };
  }
  
  return {
    state: 'pending',
    label: 'Pending',
    color: 'blue',
    icon: '○',
    details
  };
}

export function getBadgeColor(state: BadgeState): string {
  const colors: Record<BadgeState, string> = {
    verified: '#22c55e',
    sandboxed: '#eab308',
    pending: '#3b82f6',
    rejected: '#ef4444'
  };
  return colors[state];
}

export function getBadgeIcon(state: BadgeState): string {
  const icons: Record<BadgeState, string> = {
    verified: '✓',
    sandboxed: '⚠',
    pending: '○',
    rejected: '✗'
  };
  return icons[state];
}
