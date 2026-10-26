import { NeuroIntent, SwarmAction, PolicyDecision } from '@/contracts';

export interface EventMap {
  IntentReceived: { intent: NeuroIntent };
  ActionStarted: { action: SwarmAction };
  ActionCompleted: { action: SwarmAction };
  SafetyBlocked: { intent: NeuroIntent; decision: PolicyDecision };
}

export type EventName = keyof EventMap;
export type EventHandler<T extends EventName> = (data: EventMap[T]) => void;
