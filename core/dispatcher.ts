/**
 * Neurocore Intent Dispatcher
 * Routes validated intents to appropriate agent streams
 */

import { evaluateSafety } from './safety_gate';
import type { NeuroIntent } from '../contracts/index';

// Stream routing table — maps intent categories to agent streams
const ROUTING_TABLE: Record<string, string[]> = {
  'infra': ['ag'],        // Antigravity handles infrastructure
  'upgrade': ['ag'],      // Dependency management
  'lint': ['ag'],         // Code hygiene
  'neural': ['as'],       // AI Studio (Gemini) handles neural decoding
  'signal': ['as'],       // Signal processing
  'decode': ['as'],       // Intent decoding
  'code': ['jules'],      // Code generation/refactoring
  'review': ['jules'],    // PR review automation
  'test': ['jules']       // Testing/validation
};

// Fallback routing for unrecognized intents
const DEFAULT_STREAM = 'hermes';  // Default back to orchestrator

interface DispatchResult {
  intentId: string;
  routedTo: string;
  status: 'dispatched' | 'rejected' | 'queued';
  reason?: string;
}

/**
 * Dispatch an intent to the appropriate agent stream
 */
export async function dispatchIntent(intent: NeuroIntent): Promise<DispatchResult> {
  // First pass through safety gate
  const safetyResult = evaluateSafety(intent);
  
  if (!safetyResult.allowed) {
    return {
      intentId: intent.id,
      routedTo: 'blocked',
      status: 'rejected',
      reason: safetyResult.reason
    };
  }

  // Determine target stream from intent content
  let routedTo = DEFAULT_STREAM;
  
  // Primary routing based on intent category
  const categoryMatch = ROUTING_TABLE[intent.intent.toLowerCase()];
  if (categoryMatch && categoryMatch.length > 0) {
    routedTo = categoryMatch[0];
  }

  // High-risk intents require operator confirmation regardless
  let status: 'dispatched' | 'queued' = 'dispatched';
  if (intent.requiresConfirmation || safetyResult.requiresOperator) {
    status = 'queued';
  }

  return {
    intentId: intent.id,
    routedTo,
    status,
    reason: `${safetyResult.reason} → ${routedTo}`
  };
}

/**
 * Batch dispatch multiple intents
 */
export async function dispatchBatch(intents: NeuroIntent[]): Promise<DispatchResult[]> {
  return Promise.all(intents.map(dispatchIntent));
}