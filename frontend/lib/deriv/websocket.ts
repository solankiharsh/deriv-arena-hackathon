"use strict";

import type { AnyDerivRequest, DerivBaseResponse } from "./types";

type MessageCallback = (response: Record<string, unknown>) => void;
type SubscriptionCallback = (response: Record<string, unknown>) => void;

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: DerivBaseResponse["error"]) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ActiveSubscription {
  subscriptionId: string;
  callback: SubscriptionCallback;
  originalRequest: Record<string, unknown>;
}

class DerivWebSocketManager {
  private static instance: DerivWebSocketManager;
  private ws: WebSocket | null = null;
  private reqId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private subscriptions = new Map<string, ActiveSubscription>();
  private msgTypeCallbacks = new Map<string, Set<SubscriptionCallback>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isAuthorized = false;
  private authToken: string | null = null;
  private connectionListeners = new Set<(connected: boolean) => void>();
  private messageQueue: Array<Record<string, unknown>> = [];

  private constructor() {}

  static getInstance(): DerivWebSocketManager {
    if (!DerivWebSocketManager.instance) {
      DerivWebSocketManager.instance = new DerivWebSocketManager();
    }
    return DerivWebSocketManager.instance;
  }

  connect(appId: string): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const url = `${process.env.NEXT_PUBLIC_DERIV_WS_URL || "wss://ws.derivws.com/websockets/v3"}?app_id=${appId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.notifyConnectionListeners(true);
      // Re-authorize and flush queued messages
      if (this.authToken) {
        this.authorize(this.authToken).then(() => {
          this.flushQueue();
          this.resubscribeAll();
        }).catch(() => {});
      } else {
        this.flushQueue();
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      this.isAuthorized = false;
      this.stopHeartbeat();
      this.notifyConnectionListeners(false);
      this.scheduleReconnect(appId);
    };

    this.ws.onerror = () => {
      // Error handling is done via onclose
    };
  }

  private handleMessage(data: Record<string, unknown>): void {
    const reqId = data.req_id as number | undefined;
    const msgType = data.msg_type as string;

    // Handle pending one-shot requests
    if (reqId && this.pendingRequests.has(reqId)) {
      const pending = this.pendingRequests.get(reqId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(reqId);

      if (data.error) {
        pending.reject(data.error as DerivBaseResponse["error"]);
      } else {
        pending.resolve(data);
      }
    }

    // Handle streaming subscriptions (subscription id in response)
    const subscription = data.subscription as { id: string } | undefined;
    if (subscription?.id && this.subscriptions.has(subscription.id)) {
      const sub = this.subscriptions.get(subscription.id)!;
      sub.callback(data);
    }

    // Handle msg_type listeners
    if (msgType && this.msgTypeCallbacks.has(msgType)) {
      const callbacks = this.msgTypeCallbacks.get(msgType)!;
      callbacks.forEach((cb) => cb(data));
    }
  }

  async authorize(token: string): Promise<Record<string, unknown>> {
    this.authToken = token;
    const response = await this.send({ authorize: token });
    if (!response.error) {
      this.isAuthorized = true;
    }
    return response;
  }

  send(request: AnyDerivRequest | Record<string, unknown>): Promise<Record<string, unknown>> {
    const reqId = this.reqId++;
    const message = { ...request, req_id: reqId };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject({ code: "TIMEOUT", message: "Request timed out after 30s" });
      }, 30000);

      this.pendingRequests.set(reqId, { resolve, reject, timeout });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.messageQueue.push(message);
      }
    });
  }

  subscribe(
    request: AnyDerivRequest | Record<string, unknown>,
    callback: SubscriptionCallback
  ): Promise<string> {
    const reqId = this.reqId++;
    const message = { ...request, subscribe: 1, req_id: reqId };
    let subscriptionId = "";

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject({ code: "TIMEOUT", message: "Subscription timed out after 30s" });
      }, 30000);

      this.pendingRequests.set(reqId, {
        resolve: (data) => {
          const sub = data.subscription as { id: string } | undefined;
          if (sub?.id) {
            subscriptionId = sub.id;
            this.subscriptions.set(subscriptionId, {
              subscriptionId,
              callback,
              originalRequest: message,
            });
            callback(data);
            resolve(subscriptionId);
          } else {
            resolve("");
            callback(data);
          }
        },
        reject,
        timeout,
      });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.messageQueue.push(message);
      }
    });
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.send({ forget: subscriptionId });
    }
  }

  onMsgType(msgType: string, callback: MessageCallback): () => void {
    if (!this.msgTypeCallbacks.has(msgType)) {
      this.msgTypeCallbacks.set(msgType, new Set());
    }
    this.msgTypeCallbacks.get(msgType)!.add(callback);
    return () => {
      this.msgTypeCallbacks.get(msgType)?.delete(callback);
    };
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get authorized(): boolean {
    return this.isAuthorized;
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  private async resubscribeAll(): Promise<void> {
    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    for (const sub of subs) {
      try {
        await this.subscribe(sub.originalRequest, sub.callback);
      } catch {
        // Resubscription failed, skip
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(appId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect(appId);
    }, delay);
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach((l) => l(connected));
  }

  disconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.isAuthorized = false;
    this.authToken = null;
    this.subscriptions.clear();
    this.pendingRequests.clear();
    this.messageQueue = [];
    this.ws?.close();
    this.ws = null;
  }
}

export const derivWS = DerivWebSocketManager.getInstance();
