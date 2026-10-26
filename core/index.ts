// Core module barrel exports
export { evaluateSafety } from './safety_gate';
export { dispatchIntent, dispatchBatch } from './dispatcher';
export { EventBus, globalEventBus } from './event_bus';
export type { EventMap, EventName, EventHandler } from './events';
export type { PolicyDecision, NeuroIntent } from '@/contracts';
