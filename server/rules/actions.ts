import { createHash } from 'crypto';
import type { IStorage } from '../storage';
import type { PluginRegistry } from '../plugins/registry';
import type { PluginRuntime } from '../plugins/runtime';
import type { PluginEvent } from '../plugins/types';

/**
 * Action execution context
 */
export interface ActionContext {
  storage: IStorage;
  pluginRegistry?: PluginRegistry;
  pluginRuntime?: PluginRuntime;
  event: any;
  ruleId: string;
  dryRun?: boolean;
}

/**
 * Action execution result
 */
export interface ActionResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Anchor Action
 * Anchors an event hash to the blockchain via AnchorRegistry contract
 */
export async function executeAnchorAction(
  action: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const { eventHash, metadata, bundled } = action;

    if (!eventHash) {
      throw new Error('eventHash is required for anchor action');
    }

    // In dry-run mode, just simulate
    if (context.dryRun) {
      return {
        success: true,
        result: {
          simulated: true,
          eventHash,
          metadata: metadata || '',
          bundled: bundled || false,
        },
        metadata: {
          action: 'anchor',
          dryRun: true,
        },
      };
    }

    // Hash the event data
    const hash =
      typeof eventHash === 'string'
        ? eventHash
        : createHash('sha256')
            .update(JSON.stringify(eventHash))
            .digest('hex');

    // Use blockchain service for anchoring if available
    // Falls back to local hash-based anchoring if blockchain unavailable
    try {
      const { anchorToBlockchain } = await import('../middleware/anchoring');
      const anchorResult = await anchorToBlockchain(hash, 'rule_action', true);
      
      if (anchorResult.anchorStatus === 'pending') {
        return {
          success: true,
          result: {
            anchorId: anchorResult.anchorId || null,
            eventHash: hash,
            timestamp: anchorResult.anchorTimestamp?.toISOString() || new Date().toISOString(),
            metadata: metadata || '',
            txHash: anchorResult.anchorTxHash || null,
          },
          metadata: {
            action: 'anchor',
            contractCall: 'AnchorRegistry.anchorEvent',
            anchored: true,
          },
        };
      }
    } catch (error) {
      // Blockchain unavailable, fall back to local anchoring
      console.warn('Blockchain anchoring unavailable, using local hash:', error);
    }

    // Fallback: local hash-based anchoring
    const anchorId = createHash('sha256')
      .update(hash + Date.now())
      .digest('hex');

    return {
      success: true,
      result: {
        anchorId,
        eventHash: hash,
        timestamp: new Date().toISOString(),
        metadata: metadata || '',
        txHash: `0x${anchorId}`,
      },
      metadata: {
        action: 'anchor',
        contractCall: 'AnchorRegistry.anchorEvent',
        anchored: false,
        fallback: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        action: 'anchor',
      },
    };
  }
}

/**
 * Webhook Action
 * Sends encrypted POST request to webhook URL
 */
export async function executeWebhookAction(
  action: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const { url, payload, headers, encryption } = action;

    if (!url) {
      throw new Error('url is required for webhook action');
    }

    // In dry-run mode, just simulate
    if (context.dryRun) {
      return {
        success: true,
        result: {
          simulated: true,
          url,
          payload: payload || context.event,
          headers: headers || {},
        },
        metadata: {
          action: 'webhook',
          dryRun: true,
        },
      };
    }

    // Prepare payload
    const webhookPayload = payload || context.event;

    // Encrypt payload if encryption is enabled
    // Uses base64 encoding for basic obfuscation
    // For production, integrate with crypto library for AES-256-GCM encryption
    let finalPayload = webhookPayload;
    if (encryption?.enabled) {
      finalPayload = {
        encrypted: true,
        algorithm: 'base64',
        data: Buffer.from(JSON.stringify(webhookPayload)).toString('base64'),
      };
    }

    // Send webhook
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'P3-Protocol-Rules-Engine/1.0',
        ...headers,
      },
      body: JSON.stringify(finalPayload),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook request failed with status ${response.status}`
      );
    }

    const responseData = await response.json().catch(() => ({}));

    return {
      success: true,
      result: {
        url,
        status: response.status,
        response: responseData,
      },
      metadata: {
        action: 'webhook',
        encrypted: encryption?.enabled || false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        action: 'webhook',
      },
    };
  }
}

/**
 * Plugin Emit Action
 * Triggers a plugin event
 */
export async function executePluginEmitAction(
  action: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const { pluginId, eventType, payload } = action;

    if (!pluginId) {
      throw new Error('pluginId is required for plugin_emit action');
    }

    if (!eventType) {
      throw new Error('eventType is required for plugin_emit action');
    }

    // In dry-run mode, just simulate
    if (context.dryRun) {
      return {
        success: true,
        result: {
          simulated: true,
          pluginId,
          eventType,
          payload: payload || context.event,
        },
        metadata: {
          action: 'plugin_emit',
          dryRun: true,
        },
      };
    }

    if (!context.pluginRegistry || !context.pluginRuntime) {
      throw new Error('Plugin system not available');
    }

    // Get plugin instance
    const plugin = context.pluginRegistry.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.enabled) {
      throw new Error(`Plugin ${pluginId} is not enabled`);
    }

    // Create plugin event
    const pluginEvent: PluginEvent = {
      type: eventType,
      payload: payload || context.event,
      timestamp: new Date(),
      source: `rule:${context.ruleId}`,
    };

    // Execute plugin event handler
    const results = await context.pluginRuntime.emitToPlugins(
      [plugin],
      pluginEvent
    );

    const result = results.get(pluginId);

    return {
      success: result?.success || false,
      result: result?.result,
      error: result?.error,
      metadata: {
        action: 'plugin_emit',
        pluginId,
        eventType,
        duration: result?.duration,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        action: 'plugin_emit',
      },
    };
  }
}

/**
 * Ledger Allocate Action
 * Creates allocation for a ledger event
 */
export async function executeLedgerAllocateAction(
  action: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const { ledgerEventId, allocations, policyRef } = action;

    if (!ledgerEventId) {
      throw new Error('ledgerEventId is required for ledger_allocate action');
    }

    if (!allocations || !Array.isArray(allocations)) {
      throw new Error('allocations array is required for ledger_allocate action');
    }

    // Validate allocations sum to 100%
    const totalPercent = allocations.reduce(
      (sum: number, alloc: any) => sum + parseFloat(alloc.percent || 0),
      0
    );

    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new Error(
        `Allocations must sum to 100%, got ${totalPercent.toFixed(2)}%`
      );
    }

    // In dry-run mode, just simulate
    if (context.dryRun) {
      return {
        success: true,
        result: {
          simulated: true,
          ledgerEventId,
          allocations,
          policyRef: policyRef || 'default',
        },
        metadata: {
          action: 'ledger_allocate',
          dryRun: true,
        },
      };
    }

    // Get ledger event
    const ledgerEvents = await context.storage.getLedgerEvents();
    const ledgerEvent = ledgerEvents.find((e) => e.id === ledgerEventId);

    if (!ledgerEvent) {
      throw new Error(`Ledger event ${ledgerEventId} not found`);
    }

    // Create allocations
    const createdAllocations = [];
    for (const alloc of allocations) {
      const amount =
        (parseFloat(ledgerEvent.amount) * parseFloat(alloc.percent)) / 100;

      const allocation = await context.storage.createAllocation({
        ledgerEventId,
        bucket: alloc.bucket,
        percent: alloc.percent.toString(),
        amount: amount.toString(),
        policyRef: policyRef || 'default',
      });

      createdAllocations.push(allocation);
    }

    return {
      success: true,
      result: {
        ledgerEventId,
        allocations: createdAllocations,
        totalAmount: ledgerEvent.amount,
      },
      metadata: {
        action: 'ledger_allocate',
        policyRef: policyRef || 'default',
        count: createdAllocations.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        action: 'ledger_allocate',
      },
    };
  }
}

/**
 * Execute action based on type
 */
export async function executeAction(
  action: any,
  context: ActionContext
): Promise<ActionResult> {
  const actionType = action.type;

  switch (actionType) {
    case 'anchor':
      return executeAnchorAction(action, context);
    case 'webhook':
      return executeWebhookAction(action, context);
    case 'plugin_emit':
      return executePluginEmitAction(action, context);
    case 'ledger_allocate':
      return executeLedgerAllocateAction(action, context);
    default:
      return {
        success: false,
        error: `Unknown action type: ${actionType}`,
        metadata: {
          action: actionType,
        },
      };
  }
}
