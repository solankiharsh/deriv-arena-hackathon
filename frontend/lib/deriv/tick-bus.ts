"use strict";

import { derivWS } from "./websocket";

/**
 * Shared tick multiplexer. Multiple consumers can subscribe to the same symbol
 * but only ONE Deriv WebSocket subscription exists per symbol. When the last
 * consumer for a symbol unsubscribes, the WS subscription is torn down.
 */

export interface TickEvent {
  symbol: string;
  quote: number;
  epoch: number;
  ask: number;
  bid: number;
  pipSize: number;
}

type TickListener = (tick: TickEvent) => void;

interface SymbolBus {
  wsSubscriptionId: string | null;
  listeners: Map<string, TickListener>;
  subscribing: boolean;
}

const buses = new Map<string, SymbolBus>();
let listenerId = 0;

function getOrCreateBus(symbol: string): SymbolBus {
  let bus = buses.get(symbol);
  if (!bus) {
    bus = { wsSubscriptionId: null, listeners: new Map(), subscribing: false };
    buses.set(symbol, bus);
  }
  return bus;
}

async function ensureWSSubscription(symbol: string): Promise<void> {
  const bus = getOrCreateBus(symbol);
  if (bus.wsSubscriptionId || bus.subscribing) return;

  bus.subscribing = true;
  try {
    const subId = await derivWS.subscribe(
      { ticks: symbol },
      (data) => {
        const tick = (data as Record<string, unknown>).tick as
          | { quote: number; epoch: number; ask: number; bid: number; pip_size: number; symbol: string }
          | undefined;
        if (!tick) return;

        const event: TickEvent = {
          symbol: tick.symbol,
          quote: tick.quote,
          epoch: tick.epoch,
          ask: tick.ask,
          bid: tick.bid,
          pipSize: tick.pip_size,
        };

        const b = buses.get(symbol);
        if (b) {
          b.listeners.forEach((cb) => cb(event));
        }
      }
    );

    bus.wsSubscriptionId = subId;
  } catch {
    // Subscription failed — consumers will get no ticks but won't crash
  } finally {
    bus.subscribing = false;
  }
}

/**
 * Subscribe to tick events for a symbol. Returns an unsubscribe function.
 * Multiple callers can subscribe to the same symbol — only one WS stream is opened.
 */
export function subscribeTicks(symbol: string, callback: TickListener): () => void {
  const id = String(++listenerId);
  const bus = getOrCreateBus(symbol);
  bus.listeners.set(id, callback);

  ensureWSSubscription(symbol);

  return () => {
    bus.listeners.delete(id);

    if (bus.listeners.size === 0 && bus.wsSubscriptionId) {
      derivWS.unsubscribe(bus.wsSubscriptionId).catch(() => {});
      bus.wsSubscriptionId = null;
      buses.delete(symbol);
    }
  };
}
