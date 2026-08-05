/**
 * Memory + learning primitives for the Hive Swarm Mind.
 *
 * Responsibilities:
 * - IntentMemoryStore: compact intent records with outcome metadata
 * - learningLogger: captures confidence vs actual success for calibration
 */

export interface IntentRecord {
  id: string;
  intent: string;
  source: string;
  confidence: number;
  phase?: number | null;
  requiresConfirmation: boolean;
  status: 'pending' | 'completed' | 'failed' | 'pending_confirmation';
  provider?: string | null;
  latencyMs?: number | null;
  success?: boolean | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  timestamp: number;
}

export interface LearningSample {
  confidence: number;
  success: boolean;
  provider: string;
  latencyMs: number;
  intentHash: string;
  timestamp: number;
}

export class IntentMemoryStore {
  private records: IntentRecord[] = [];
  private maxRecords = 200;

  add(record: IntentRecord) {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  recent(count = 20) {
    return this.records.slice(-count);
  }

  byProvider(provider: string) {
    return this.records.filter(r => r.provider === provider);
  }

  failed() {
    return this.records.filter(r => r.status === 'failed');
  }
}

export class LearningLogger {
  private samples: LearningSample[] = [];
  private maxSamples = 500;

  log(sample: LearningSample) {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }

  recent(count = 50) {
    return this.samples.slice(-count);
  }

  providerStats(provider: string) {
    const items = this.samples.filter(s => s.provider === provider);
    if (!items.length) return null;
    const successRate = items.filter(s => s.success).length / items.length;
    const avgLatency = items.reduce((acc, s) => acc + (s.latencyMs || 0), 0) / items.length;
    return {
      provider,
      count: items.length,
      successRate,
      avgLatency
    };
  }

  thresholdSuggestion() {
    const items = this.samples;
    if (items.length < 20) return null;
    const sorted = items.slice().sort((a, b) => a.confidence - b.confidence);
    const median = sorted[Math.floor(sorted.length / 2)].confidence;
    const successAboveMedian = items.filter(s => s.confidence >= median && s.success).length / items.filter(s => s.confidence >= median).length;
    const successBelowMedian = items.filter(s => s.confidence < median && s.success).length / items.filter(s => s.confidence < median).length;
    return {
      medianConfidence: median,
      successRateAboveMedian: successAboveMedian,
      successRateBelowMedian: successBelowMedian,
      recommendation: successAboveMedian > successBelowMedian + 0.1 ? 'keep_or_raise_thresholds' : 'lower_thresholds'
    };
  }
}
