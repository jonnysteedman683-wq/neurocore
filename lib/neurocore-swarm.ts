/**
 * Neurocore OmniSwarmAdapter — bridges Neurocore intents to OMNIBUS SwarmRuntimeEngine
 * This file is owned by Antigravity (AG) but reviewed by Hermes
 */

import type { NeuroIntent, PolicyDecision, SafetyPolicy, EmergencyStopResult } from '../contracts/index';

export { type NeuroIntent, type PolicyDecision, type SafetyPolicy, type EmergencyStopResult };

// Re-export for convenience
export interface SwarmProvider {
  connect(config?: { baseUrl?: string; maxConcurrency?: number }): Promise<void>;
  capabilities(): Promise<{ roles: string[]; phases: string[] }>;
  start(intent: NeuroIntent): Promise<{ actionId: string; status: string }>;
  status(actionId: string): Promise<{ actionId: string; status: string; output: string[] }>;
  stop?(actionId: string): Promise<{ actionId: string; status: string }>;
  emergencyStop?(): Promise<{ stopped: boolean }>;
}

export class OmniSwarmAdapter implements SwarmProvider {
  private engine: any = null;
  private pendingActions: Map<string, any> = new Map();
  private processedActions: Map<string, any> = new Map();
  private skillCards: Map<string, any> = new Map();

  async connect(config: { baseUrl?: string; maxConcurrency?: number } = {}): Promise<void> {
    // Dynamically load SwarmRuntimeEngine — lives in the OMNIBUS repo, not installed here.
    // Using createRequire avoids TypeScript module-resolution errors for the external path.
    // The require call is wrapped in try/catch so absence gracefully falls back to mock mode.
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const mod = require('../Omnibus/swarm_runtime.cjs');
      const SwarmRuntimeEngine = mod.SwarmRuntimeEngine;
      this.engine = new SwarmRuntimeEngine();
      this.registerDefaultSkills();
    } catch (err) {
      console.warn('SwarmRuntimeEngine not found, running in mock mode:', err);
      this.engine = null;
      this.registerMockSkills();
    }
    console.log('OmniSwarmAdapter: Connected');
  }

  private registerDefaultSkills() {
    // Register default skill cards for swarm capabilities
    this.skillCards.set('neural_path_routing', {
      id: 'neural_path_routing',
      name: 'Neural Path Routing',
      description: 'Routes decoded intents to appropriate swarm subsystems',
      type: 'routing'
    });
    this.skillCards.set('knowledge_extraction', {
      id: 'knowledge_extraction',
      name: 'Knowledge Extraction',
      description: 'Extracts knowledge from intent signals',
      type: 'cognitive'
    });
  }

  private registerMockSkills() {
    this.skillCards.set('mock_routing', { id: 'mock_routing', name: 'Mock Routing', type: 'routing' });
  }

  async capabilities(): Promise<{ roles: string[]; phases: string[] }> {
    return {
      roles: Array.from(this.skillCards.values()).map(s => s.name || s.id),
      phases: ['planning', 'execution', 'verification']
    };
  }

  async start(intent: NeuroIntent): Promise<{ actionId: string; status: string }> {
    const actionType = intent.intent.toLowerCase();
    const actionId = `action-${intent.id}`;

    if (intent.requiresConfirmation) {
      this.pendingActions.set(actionId, {
        id: actionId,
        type: actionType,
        intent,
        status: 'pending_confirmation',
        reasoning: `Intent ${intent.id} requires operator confirmation`
      });
      return { actionId, status: 'pending_confirmation' };
    }

    // Mock mode: engine is null (OMNIBUS not available)
    if (!this.engine) {
      const mockAction = {
        id: actionId,
        type: actionType,
        status: 'completed',
        reasoning: `Mock execution of intent ${intent.id}`
      };
      this.processedActions.set(actionId, mockAction);
      return { actionId, status: 'completed' };
    }

    // Auto-process non-confirmation intents via real engine
    try {
      const action = this.engine.enqueueAction(
        actionType,
        `target-${actionType}`,
        intent.features,
        `NeuroIntent ${intent.source} → ${actionType} (conf: ${intent.confidence})`
      );

      this.pendingActions.set(actionId, action);

      // Process the queue
      await this.engine.processQueue();

      this.processedActions.set(actionId, action);
      this.pendingActions.delete(actionId);

      return { actionId, status: action.status || 'completed' };
    } catch (err) {
      console.error('Failed to enqueue/process action:', err);
      this.pendingActions.set(actionId, {
        id: actionId,
        type: actionType,
        status: 'failed',
        reasoning: `Error: ${(err as Error).message}`
      });
      return { actionId, status: 'failed' };
    }
  }

  async status(actionId: string): Promise<{ actionId: string; status: string; output: string[] }> {
    const action = this.processedActions.get(actionId) || this.pendingActions.get(actionId);

    if (!action) {
      return {
        actionId,
        status: 'unknown',
        output: ['Action not found in engine state.']
      };
    }

    return {
      actionId,
      status: action.status,
      output: [action.reasoning || '', `Action type: ${action.type || 'N/A'}`]
    };
  }

  async stop(actionId: string): Promise<{ actionId: string; status: string }> {
    const existed = this.pendingActions.delete(actionId);
    return {
      actionId,
      status: existed ? 'cancelled' : 'not_found'
    };
  }

  async emergencyStop(): Promise<{ stopped: boolean }> {
    if (this.engine && typeof this.engine.resetQueue === 'function') {
      this.engine.resetQueue();
    }
    this.pendingActions.clear();
    return { stopped: true };
  }
}