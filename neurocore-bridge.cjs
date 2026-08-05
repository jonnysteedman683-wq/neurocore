/**
 * neurocore-bridge.cjs
 * ESM/CJS bridge for Neurocore TypeScript modules.
 * Uses dynamic import() to load ESM TypeScript modules from server.js (CommonJS).
 */

const path = require('path');
const fs = require('fs');

// Resolve Neurocore repo root from server.js location
const NEUROCORE_ROOT = path.resolve(__dirname, '../neurocore');
const NEUROCORE_LIB = path.join(NEUROCORE_ROOT, 'lib');

let _moduleCache = null;
let _importPromise = null;

/**
 * Dynamically import Neurocore ESM modules.
 * Uses tsx/ts-node loader for on-the-fly TypeScript transpilation.
 */
async function loadNeurocoreModules() {
  if (_moduleCache) return _moduleCache;
  
  // Check if already loading
  if (_importPromise) return _importPromise;
  
  _importPromise = (async () => {
    try {
      // Import the main Neurocore module
      // tsx handles TypeScript transpilation automatically
      const mod = await import('file://' + path.join(NEUROCORE_LIB, 'neurocore-swarm.ts').replace(/\\/g, '/'));
      
      _moduleCache = {
        OmniSwarmAdapter: mod.OmniSwarmAdapter,
        NeuroStreamAdapter: mod.NeuroStreamAdapter,
        SwarmUpgradeRegistry: mod.SwarmUpgradeRegistry,
        FederatedDebateEngine: mod.FederatedDebateEngine,
        SafetyGate: mod.SafetyGate,
        // Types are compile-time only
      };
      
      let spikeComm = null;
      try {
        const spikeMod = await import('file://' + path.join(NEUROCORE_ROOT, 'adapters', 'omnibus-swarm', 'spike-comm.js').replace(/\\/g, '/'));
        spikeComm = {
          encodeIntentToSpikes: spikeMod.encodeIntentToSpikes,
          decodeSpikesToIntent: spikeMod.decodeSpikesToIntent,
          hashIntentToPhase: spikeMod.hashIntentToPhase,
          groupByPhase: spikeMod.groupByPhase,
          PHASE_BUCKETS: spikeMod.PHASE_BUCKETS,
        };
      } catch (spikeErr) {
        console.warn('[neurocore-bridge] Spike comm module not available:', spikeErr.message);
      }
      
      let memoryStore = null;
      let learningLogger = null;
      try {
        const memoryMod = await import('file://' + path.join(NEUROCORE_LIB, 'memory', 'learning.ts').replace(/\\/g, '/'));
        memoryStore = new memoryMod.IntentMemoryStore();
        learningLogger = new memoryMod.LearningLogger();
      } catch (memoryErr) {
        console.warn('[neurocore-bridge] Memory/learning module not available:', memoryErr.message);
      }

      let functionCallAdapter = null;
      try {
        const funcMod = await import('file://' + path.join(NEUROCORE_ROOT, 'adapters', 'function-call-adapter.ts').replace(/\\/g, '/'));
        functionCallAdapter = new funcMod.FunctionCallAdapter();
      } catch (funcErr) {
        console.warn('[neurocore-bridge] Function-call adapter not available:', funcErr.message);
      }
      
      return {
        ..._moduleCache,
        spikeComm,
        memoryStore,
        learningLogger,
        functionCallAdapter
      };
    } catch (err) {
      console.error('[neurocore-bridge] Failed to load Neurocore modules:', err.message);
      throw err;
    }
  })();
  
  return _importPromise;
}

/**
 * Convenience wrapper to get a connected OmniSwarmAdapter instance.
 */
async function getSwarmAdapter(config = {}) {
  const modules = await loadNeurocoreModules();
  const adapter = new modules.OmniSwarmAdapter();
  await adapter.connect(config);
  return adapter;
}

/**
 * Check if Neurocore modules are loadable.
 */
async function isAvailable() {
  try {
    await loadNeurocoreModules();
    return true;
  } catch {
    return false;
  }
}

function getMemoryStore() {
  return _moduleCache?.memoryStore || null;
}

function getLearningLogger() {
  return _moduleCache?.learningLogger || null;
}

function getFunctionCallAdapter() {
  return _moduleCache?.functionCallAdapter || null;
}

async function getFunctionCallAdapterAsync() {
  await loadNeurocoreModules();
  return getFunctionCallAdapter();
}

module.exports = {
  loadNeurocoreModules,
  getSwarmAdapter,
  isAvailable,
  getMemoryStore,
  getLearningLogger,
  getFunctionCallAdapter,
  getFunctionCallAdapterAsync,
  NEUROCORE_ROOT,
  NEUROCORE_LIB,
};