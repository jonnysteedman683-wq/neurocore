/**
 * Spike-based communication primitives for Hive Swarm Mind.
 *
 * Concepts:
 * - Intent -> spike train encoding
 * - Spike train -> intent decoding
 * - Phase-tagged concurrent dispatch
 */

const PHASE_BUCKETS = 8;

function hashIntentToPhase(intent, source = 'mock') {
  const str = `${source}:${intent}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return ((h % PHASE_BUCKETS) + PHASE_BUCKETS) % PHASE_BUCKETS;
}

function encodeIntentToSpikes(intentObj) {
  const tokens = [
    intentObj.id || '',
    intentObj.source || '',
    intentObj.intent || '',
    String(intentObj.confidence ?? ''),
    String(intentObj.requiresConfirmation ?? '')
  ].filter(Boolean);

  const phase = hashIntentToPhase(intentObj.intent || '', intentObj.source);
  const spikes = [];
  const now = Date.now();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    for (let t = 0; t < token.length; t++) {
      const code = token.charCodeAt(t);
      if (code % 3 === 0) {
        spikes.push({
          time: now + i * 17 + t * 3,
          channel: (code + phase) % 16,
          polarity: code % 2 === 0 ? 1 : -1,
          phase,
          tokenIndex: i
        });
      }
    }
  }

  return {
    format: 'spike-train-v1',
    phase,
    intentId: intentObj.id,
    spikeCount: spikes.length,
    spikes: spikes.slice(0, 64)
  };
}

function decodeSpikesToIntent(spikePayload) {
  if (!spikePayload || spikePayload.format !== 'spike-train-v1') {
    return null;
  }

  const buckets = new Array(16).fill(null).map(() => []);
  for (const s of spikePayload.spikes) {
    const ch = s.channel % 16;
    buckets[ch].push(s);
  }

  const tokenFragments = [];
  for (let i = 0; i < 16; i++) {
    if (!buckets[i].length) continue;
    const sorted = buckets[i].slice().sort((a, b) => a.time - b.time);
    let frag = '';
    for (const s of sorted) {
      const approxCode = (s.polarity > 0 ? 0 : 1) + (s.channel - (s.phase % 16)) * 3;
      if (approxCode > 31 && approxCode < 127) {
        frag += String.fromCharCode(approxCode);
      }
    }
    if (frag.trim()) tokenFragments.push(frag);
  }

  const reconstructed = tokenFragments.join(' ').trim() || spikePayload.intentId || '';

  return {
    id: spikePayload.intentId,
    source: 'spike-decoded',
    intent: reconstructed,
    confidence: 0.5,
    features: {
      spikeCount: spikePayload.spikeCount,
      phase: spikePayload.phase,
      decoded: !!reconstructed
    },
    timestamp: Date.now(),
    requiresConfirmation: true
  };
}

function groupByPhase(spikePayloads) {
  const groups = new Map();
  for (const payload of spikePayloads) {
    const key = payload.phase ?? 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(payload);
  }
  return groups;
}

module.exports = {
  encodeIntentToSpikes,
  decodeSpikesToIntent,
  hashIntentToPhase,
  groupByPhase,
  PHASE_BUCKETS
};
