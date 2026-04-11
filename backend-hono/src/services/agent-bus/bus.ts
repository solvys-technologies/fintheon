// [claude-code 2026-04-10] S8-T1: AgentBus — typed in-process pub/sub singleton

import { EventEmitter } from "events";
import type { BusTopic, BusMessage } from "./types.js";

/**
 * AgentBus — typed in-process pub/sub for inter-agent communication.
 *
 * Singleton. All agent results, DAG events, and surface pushes flow through here.
 * NOT a distributed queue — this is single-instance, designed for our Bun server.
 */
class AgentBus {
  private emitter = new EventEmitter();
  private messageCount = 0;

  constructor() {
    // High listener ceiling — each active DAG + each SSE client = 1 listener
    this.emitter.setMaxListeners(200);
  }

  /** Publish a typed message to a topic */
  publish<T>(
    topic: BusTopic,
    message: Omit<BusMessage<T>, "topic" | "timestamp">,
  ): void {
    const full: BusMessage<T> = {
      ...message,
      topic,
      timestamp: Date.now(),
    };
    this.messageCount++;
    this.emitter.emit(topic, full);
    // Emit to wildcard subscribers at every prefix level
    // e.g., 'dag.task.dispatch' → emits to 'dag.task.*' AND 'dag.*'
    const parts = topic.split(".");
    for (let i = 1; i < parts.length; i++) {
      this.emitter.emit(`${parts.slice(0, i).join(".")}.*`, full);
    }
  }

  /** Subscribe to a specific topic */
  subscribe<T>(
    topic: BusTopic | `${string}.*`,
    handler: (msg: BusMessage<T>) => void,
  ): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }

  /** Subscribe to a topic, auto-unsubscribe after first message */
  once<T>(topic: BusTopic, handler: (msg: BusMessage<T>) => void): void {
    this.emitter.once(topic, handler);
  }

  /** Get total messages published (for monitoring) */
  get stats() {
    return {
      messageCount: this.messageCount,
      listenerCount:
        this.emitter.listenerCount("dag.task.dispatch") +
        this.emitter.listenerCount("dag.task.result") +
        this.emitter.listenerCount("surface.boardroom"),
    };
  }

  /** Remove all listeners (for testing/shutdown) */
  reset(): void {
    this.emitter.removeAllListeners();
    this.messageCount = 0;
  }
}

// Singleton export
export const agentBus = new AgentBus();
