/**
 * Safety gate implementation for Neurocore
 * Evaluates NeuroIntent objects against policy rules
 */

import type {
  NeuroIntent,
  SafetyPolicy,
  PolicyDecision
} from '../contracts/index.ts';

export class SafetyGate {
  private policy: SafetyPolicy;

  constructor(policy: SafetyPolicy) {
    this.policy = policy;
  }

  evaluate(intent: NeuroIntent): PolicyDecision {
    // Block explicitly forbidden intents
    if (this.policy.blockedIntents?.includes(intent.intent)) {
      return {
        allowed: false,
        reason: 'blocked_intent',
        requiresOperator: true,
        riskLevel: 'high'
      };
    }

    // Block unknown intents
    if (!this.policy.allowedIntents?.includes(intent.intent)) {
      return {
        allowed: false,
        reason: 'unknown_intent',
        requiresOperator: true,
        riskLevel: 'high'
      };
    }

    // Confidence threshold
    const threshold = this.policy.confidenceThreshold ?? 0.7;
    if (intent.confidence < threshold) {
      return {
        allowed: false,
        reason: 'low_confidence',
        requiresOperator: true,
        riskLevel: 'high'
      };
    }

    // Feature validation
    const allowedKeys = new Set(this.policy.allowedFeatures ?? []);
    if (allowedKeys.size > 0) {
      for (const key of Object.keys(intent.features)) {
        if (!allowedKeys.has(key)) {
          return {
            allowed: false,
            reason: `disallowed_feature:${key}`,
            requiresOperator: false,
            riskLevel: 'moderate'
          };
        }
      }
    }

    // Moderate risk: confidence < 0.9
    const requiresOperator = intent.confidence < 0.9;
    const riskLevel = requiresOperator ? 'moderate' : 'low';

    return {
      allowed: true,
      reason: 'ok',
      requiresOperator,
      riskLevel
    };
  }
}

