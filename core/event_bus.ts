import { EventMap, EventName, EventHandler } from './events.js';

/**
 * Tiny typed EventBus for Neurocore system events:
 * - IntentReceived
 * - ActionStarted
 * - ActionCompleted
 * - SafetyBlocked
 */
export class EventBus {
  private listeners: { [K in EventName]?: Set<EventHandler<K>> } = {};

  /**
   * Registers an event listener for the specified event type.
   * Returns an unsubscribe function.
   */
  on<K extends EventName>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<EventHandler<K>>).add(handler);

    return () => {
      this.listeners[event]?.delete(handler);
    };
  }

  /**
   * Registers a one-time event listener that auto-unsubscribes after first trigger.
   */
  once<K extends EventName>(event: K, handler: EventHandler<K>): () => void {
    const wrapper: EventHandler<K> = (data: EventMap[K]) => {
      this.listeners[event]?.delete(wrapper);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emits an event to all registered handlers for that event type.
   */
  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventBus] Error executing handler for event '${event}':`, error);
        }
      }
    }
  }

  /**
   * Removes all listeners for a given event, or all events if none specified.
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

// Export singleton instance for cross-module core event dispatching
export const globalEventBus = new EventBus();
