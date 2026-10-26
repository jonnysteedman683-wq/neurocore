/**
 * Neurocore TypeScript Interfaces
 * Shared across all adapters and streams
 */

// NeuroIntent: normalized neural signal output
// Produced by neural decoder (AS)
// Consumed by swarm adapter (AG)

export type NeuroIntentSource = 'eeg' | 'mock' | 'audio' | 'bci';

export interface NeuroIntent {
  id: string;
  source: NeuroIntentSource;
  intent: string;
  confidence: number;     // 0.0 - 1.0
  features: Record<string, unknown>;
  timestamp: number;      // epoch milliseconds
  requiresConfirmation: boolean;  // true if confidence < 0.75 or high-risk
}

// SwarmAction: command dispatched to OMNIBUS swarm
export type SwarmActionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface SwarmAction {
  id: string;
  intentId: string;       // links back to originating intent
  action: string;         // command category
  parameters: Record<string, unknown>;
  status: SwarmActionStatus;
  requiresOperator: boolean;
  estimatedCostUSD?: number;
  log: string[];
  result?: Record<string, unknown>;
}

// Safety interfaces
export interface SafetyPolicy {
  allowedIntents: string[];
  blockedIntents: string[];
  confidenceThreshold: number;
  maxCostUSD: number;
  allowedFeatures: string[];
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiresOperator: boolean;
  riskLevel: 'low' | 'moderate' | 'high';
}

export interface EmergencyStopResult {
  stopped: boolean;
  componentsAffected: string[];
  stateSnapshot: 'preserved' | 'partial' | 'lost';
  recoveryPath: string;
}

// EmergencyStopResult
// (types exported individually above)
