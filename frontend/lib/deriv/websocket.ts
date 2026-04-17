"use strict";

import type { AnyDerivRequest, DerivBaseResponse } from "./types";

/**
 * Legacy `wss://ws.derivws.com/websockets/v3?app_id=` expects a numeric application ID.
 * OAuth `client_id` values are often alphanumeric; those must not be used as `app_id`
 * (they produce failed WebSocket handshakes). Optional override: NEXT_PUBLIC_DERIV_LEGACY_WS_APP_ID.
 */
function resolveLegacyV3AppId(appId: string): string {
  const override = (process.env.NEXT_PUBLIC_DERIV_LEGACY_WS_APP_ID || "").trim();
  if (override && /^\d+$/.test(override)) return override;
  const trimmed = (appId || "").trim();
  if (trimmed && /^\d+$/.test(trimmed)) return trimmed;
  const pub = (process.env.NEXT_PUBLIC_DERIV_APP_ID || "").trim();
  if (pub && /^\d+$/.test(pub)) return pub;
  return "1089";
}

/**
 * Ask the backend for a fresh, OTP-signed Deriv v2 WebSocket URL for the
 * current user session. Returns `null` when the user isn't signed in or the
 * Deriv OTP endpoint is unavailable — callers should fall back to legacy.
 */
async function fetchOtpWsUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/auth/deriv-ws", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { wsUrl?: string | null };
    return typeof data.wsUrl === "string" && data.wsUrl ? data.wsUrl : null;
  } catch {
    return null;
  }
}

/**
 * Extract only the host from a WebSocket URL. We never expose the full URL
 * (which may include OTP tokens or query strings) to UI listeners.
 */
function safeHostFromUrl(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

type MessageCallback = (response: Record<string, unknown>) => void;
type SubscriptionCallback = (response: Record<string, unknown>) => void;

/**
 * Which Deriv WebSocket path the current connection is using.
 *
 * - `v2-otp`      : OTP-signed new v2 endpoint (`api.derivws.com/trading/v1/...`).
 * - `v3-legacy`   : Fallback to the legacy `ws.derivws.com/websockets/v3?app_id=` endpoint.
 * - `disconnected`: Not connected.
 */
export type DerivStreamSource = "v2-otp" | "v3-legacy" | "disconnected";

export interface DerivStreamStatus {
  connected: boolean;
  source: DerivStreamSource;
  /** Host portion of the active WS URL (never includes tokens / query params). */
  host: string | null;
  /** ISO timestamp of the last connection state change. */
  changedAt: string;
}

type StatusListener = (status: DerivStreamStatus) => void;

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
  private statusListeners = new Set<StatusListener>();
  private messageQueue: Array<Record<string, unknown>> = [];
  private currentSource: DerivStreamSource = "disconnected";
  private currentHost: string | null = null;
  private statusChangedAt: string = new Date(0).toISOString();

  private constructor() {}

  static getInstance(): DerivWebSocketManager {
    if (!DerivWebSocketManager.instance) {
      DerivWebSocketManager.instance = new DerivWebSocketManager();
    }
    return DerivWebSocketManager.instance;
  }

  /**
   * Connect to Deriv's trading WebSocket.
   *
   * Preference order (new API first, legacy only as fallback):
   *   1. OTP-signed v2 URL from `/api/auth/deriv-ws` (authenticated Deriv session).
   *   2. Legacy unauthenticated `wss://ws.derivws.com/websockets/v3?app_id=<numeric>`.
   *
   * Returns a fire-and-forget `void` to preserve backwards compatibility with
   * existing call sites, but internally runs asynchronously.
   */
  connect(appId: string): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    void this.connectInternal(appId);
  }

  private async connectInternal(appId: string): Promise<void> {
    const legacyAppId = resolveLegacyV3AppId(appId);
    const otpUrl = await fetchOtpWsUrl();
    const useOtp = Boolean(otpUrl);
    const url =
      otpUrl ||
      `${process.env.NEXT_PUBLIC_DERIV_WS_URL || "wss://ws.derivws.com/websockets/v3"}?app_id=${legacyAppId}`;

    // Track the active path + host for the status indicator. We extract host
    // only (never the full URL) so OTP tokens never leak into listeners or UI.
    const nextSource: DerivStreamSource = useOtp ? "v2-otp" : "v3-legacy";
    this.currentHost = safeHostFromUrl(url);
    this.currentSource = nextSource;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.currentSource = "disconnected";
      this.notifyConnectionListeners(false);
      this.scheduleReconnect(appId);
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.notifyConnectionListeners(true);

      // OTP URLs are pre-authenticated by Deriv; `authorize` returns an
      // `AlreadyAuthorized` error there, so skip it. Legacy connections still
      // need an explicit authorize when we have a token.
      if (useOtp) {
        this.isAuthorized = true;
        this.flushQueue();
        this.resubscribeAll();
      } else if (this.authToken) {
        this.authorize(this.authToken)
          .then(() => {
            this.flushQueue();
            this.resubscribeAll();
          })
          .catch(() => {});
      } else {
        this.flushQueue();
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }
      this.handleMessage(data);
    };

    socket.onclose = () => {
      this.isAuthorized = false;
      this.stopHeartbeat();
      this.currentSource = "disconnected";
      this.currentHost = null;
      this.notifyConnectionListeners(false);
      // Always reconnect via connect() so we re-attempt OTP first; a fresh OTP
      // URL is fetched each time since the previous one has a short TTL.
      this.scheduleReconnect(appId);
    };

    socket.onerror = () => {
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

  /**
   * Subscribe to stream status changes (connected + which API path is in use).
   * Fires immediately with the current snapshot so UI doesn't flicker on mount.
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getStatus(): DerivStreamStatus {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      source: this.currentSource,
      host: this.currentHost,
      changedAt: this.statusChangedAt,
    };
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
    this.statusChangedAt = new Date().toISOString();
    this.connectionListeners.forEach((l) => l(connected));
    const snapshot = this.getStatus();
    this.statusListeners.forEach((l) => l(snapshot));
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
