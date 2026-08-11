import type { NeuroIntent, PolicyDecision } from '../contracts/index';

const ALLOWED_INTENTS = new Set(['route', 'execute', 'query', 'observe']);
const ALLOWED_FEATURE_KEYS = new Set(['alpha_power', 'beta_alpha_ratio', 'asymmetry', 'quality']);

/**
 * Evaluates safety policies for an incoming NeuroIntent.
 *
 * Rules:
 * 1. Blocks confidence < 0.75
 * 2. Blocks unknown intent types (allowlist: route, execute, query, observe)
 * 3. Blocks feature keys not in allowlist: alpha_power, beta_alpha_ratio, asymmetry, quality
 */
export function evaluateSafety(intent: NeuroIntent): PolicyDecision {
  // 1. Intent type check — blocked or unknown
  if (!ALLOWED_INTENTS.has(intent.intent)) {
    return {
      allowed: false,
      reason: 'blocked_intent',
      requiresOperator: true,
      riskLevel: 'high'
    };
  }

  // 2. Confidence check (< 0.75)
  if (intent.confidence < 0.75) {
    return {
      allowed: false,
      reason: `Confidence score ${intent.confidence} is below safety threshold 0.75`,
      requiresOperator: true,
      riskLevel: 'high'
    };
  }

  // 3. Feature keys check
  if (intent.features && typeof intent.features === 'object') {
    const invalidKeys = Object.keys(intent.features).filter(key => !ALLOWED_FEATURE_KEYS.has(key));
    if (invalidKeys.length > 0) {
      return {
        allowed: false,
        reason: `Feature keys [${invalidKeys.join(', ')}] are not in safety allowlist`,
        requiresOperator: true,
        riskLevel: 'moderate'
      };
    }
  }

  // Determine risk level for allowed intent
  const requiresOperator = intent.confidence < 0.85;
  const riskLevel = requiresOperator ? 'moderate' : 'low';

  return {
    allowed: true,
    reason: 'ok',
    requiresOperator,
    riskLevel
  };
}
