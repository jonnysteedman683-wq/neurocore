// Integration test: AS decoder → SafetyGate → AG adapter
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import adapter
import { OmniSwarmAdapter } from '../lib/neurocore-swarm';
import type { NeuroIntent, PolicyDecision } from '../contracts/index';
import { evaluateSafety } from '../core/safety_gate';

describe('Neurocore End-to-End Integration', () => {
  it('should reject unsafe intent (low confidence)', async () => {
    const intent: NeuroIntent = {
      id: 'test-01',
      source: 'mock',
      intent: 'route',
      confidence: 0.5,
      features: { alpha_power: 5.2, quality: 0.5 },
      timestamp: Date.now(),
      requiresConfirmation: true
    };

    const decision = evaluateSafety(intent);
    assert.ok(!decision.allowed, 'Should block low-confidence intent');
    assert.strictEqual(decision.riskLevel, 'high');
  });

  it('should accept and route valid intent', async () => {
    const intent: NeuroIntent = {
      id: 'test-02',
      source: 'mock',
      intent: 'execute',
      confidence: 0.95,
      features: { alpha_power: 35.1, quality: 0.95 },
      timestamp: Date.now(),
      requiresConfirmation: false
    };

    const adapter = new OmniSwarmAdapter();
    await adapter.connect();

    const caps = await adapter.capabilities();
    assert.ok(caps.roles.length > 0);
    assert.deepStrictEqual(caps.phases, ['planning', 'execution', 'verification']);

    const result = await adapter.start(intent);
    assert.ok(result.actionId);
    assert.strictEqual(result.status, 'completed');
  });

  it('should return pending_confirmation for requiresConfirmation=true', async () => {
    const intent: NeuroIntent = {
      id: 'test-03',
      source: 'mock',
      intent: 'query',
      confidence: 0.8,
      features: { alpha_power: 15.0, quality: 0.8 },
      timestamp: Date.now(),
      requiresConfirmation: true
    };

    const adapter = new OmniSwarmAdapter();
    await adapter.connect();

    const result = await adapter.start(intent);
    assert.strictEqual(result.status, 'pending_confirmation');
  });

  it('should handle blocked intent safely', async () => {
    const decision = evaluateSafety({
      id: 'test-04',
      source: 'mock',
      intent: 'harm',
      confidence: 0.99,
      features: { quality: 1.0 },
      timestamp: Date.now(),
      requiresConfirmation: false
    });

    assert.ok(!decision.allowed);
    assert.strictEqual(decision.reason, 'blocked_intent');
  });

  it('should accept known intent types', async () => {
    const result = evaluateSafety({
      id: 'test-05',
      source: 'mock',
      intent: 'observe', // Known type
      confidence: 0.85,
      features: { alpha_power: 12.0, quality: 0.85 },
      timestamp: Date.now(),
      requiresConfirmation: false
    });

    assert.ok(result.allowed);
    assert.strictEqual(result.riskLevel, 'low');
  });
});
