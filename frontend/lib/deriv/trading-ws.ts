"use strict";

type MessageHandler = (data: Record<string, unknown>) => void;

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (err: { code: string; message: string }) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class DerivTradingWS {
  private static instance: DerivTradingWS;
  private ws: WebSocket | null = null;
  private reqId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private msgTypeListeners = new Map<string, Set<MessageHandler>>();
  private subscriptionCallbacks = new Map<string, MessageHandler>();
  private _isConnected = false;
  private _isAuthenticated = false;
  private reconnecting = false;

  private constructor() {}

  static getInstance(): DerivTradingWS {
    if (!DerivTradingWS.instance) {
      DerivTradingWS.instance = new DerivTradingWS();
    }
    return DerivTradingWS.instance;
  }

  get isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  get isAuthenticated(): boolean {
    return this._isAuthenticated && this.isConnected;
  }

  async connect(): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.reconnecting) return false;

    this.reconnecting = true;
    try {
      const res = await fetch("/api/auth/deriv-ws", { credentials: "same-origin" });
      if (!res.ok) return false;
      const data = await res.json();
      const wsUrl: string | null = data.wsUrl || null;
      if (!wsUrl) return false;

      return this.connectToUrl(wsUrl);
    } catch {
      return false;
    } finally {
      this.reconnecting = false;
    }
  }

  private connectToUrl(wsUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws;
        this._isConnected = true;
        this._isAuthenticated = true;
        resolve(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          this.handleMessage(data);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        this._isConnected = false;
        this._isAuthenticated = false;
        this.pendingRequests.forEach((p) =>
          p.reject({ code: "WS_CLOSED", message: "WebSocket closed" })
        );
        this.pendingRequests.clear();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
      };
    });
  }

  private handleMessage(data: Record<string, unknown>): void {
    const reqId = data.req_id as number | undefined;
    const msgType = data.msg_type as string | undefined;

    if (reqId && this.pendingRequests.has(reqId)) {
      const pending = this.pendingRequests.get(reqId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(reqId);

      if (data.error) {
        const err = data.error as { code: string; message: string };
        pending.reject(err);
      } else {
        pending.resolve(data);
      }
    }

    const subscription = data.subscription as { id: string } | undefined;
    if (subscription?.id && this.subscriptionCallbacks.has(subscription.id)) {
      this.subscriptionCallbacks.get(subscription.id)!(data);
    }

    if (msgType && this.msgTypeListeners.has(msgType)) {
      this.msgTypeListeners.get(msgType)!.forEach((cb) => cb(data));
    }
  }

  send(request: Record<string, unknown>, timeoutMs = 30000): Promise<Record<string, unknown>> {
    const id = this.reqId++;
    const message = { ...request, req_id: id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject({ code: "TIMEOUT", message: "Request timed out" });
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject({ code: "NOT_CONNECTED", message: "Trading WebSocket not connected" });
      }
    });
  }

  subscribe(
    request: Record<string, unknown>,
    callback: MessageHandler
  ): Promise<string> {
    const id = this.reqId++;
    const message = { ...request, subscribe: 1, req_id: id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject({ code: "TIMEOUT", message: "Subscription timed out" });
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (data) => {
          const sub = data.subscription as { id: string } | undefined;
          if (sub?.id) {
            this.subscriptionCallbacks.set(sub.id, callback);
            callback(data);
            resolve(sub.id);
          } else {
            callback(data);
            resolve("");
          }
        },
        reject,
        timeout,
      });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject({ code: "NOT_CONNECTED", message: "Trading WebSocket not connected" });
      }
    });
  }

  onMsgType(msgType: string, callback: MessageHandler): () => void {
    if (!this.msgTypeListeners.has(msgType)) {
      this.msgTypeListeners.set(msgType, new Set());
    }
    this.msgTypeListeners.get(msgType)!.add(callback);
    return () => {
      this.msgTypeListeners.get(msgType)?.delete(callback);
    };
  }

  async sendProposal(params: {
    amount: number;
    contractType: string;
    symbol: string;
    duration: number;
    durationUnit: string;
    currency?: string;
  }): Promise<{ proposalId: string; askPrice: number; payout: number }> {
    const response = await this.send({
      proposal: 1,
      amount: params.amount,
      basis: "stake",
      contract_type: params.contractType,
      currency: params.currency ?? "USD",
      duration: params.duration,
      duration_unit: params.durationUnit,
      symbol: params.symbol,
    });

    const proposal = response.proposal as {
      id: string;
      ask_price: number;
      payout: number;
    } | undefined;

    if (!proposal?.id) {
      throw { code: "NO_PROPOSAL", message: "No proposal returned" };
    }

    return {
      proposalId: proposal.id,
      askPrice: proposal.ask_price,
      payout: proposal.payout,
    };
  }

  async sendBuy(proposalId: string, price: number): Promise<{
    contractId: number;
    buyPrice: number;
    balanceAfter: number;
    payout: number;
  }> {
    const response = await this.send({ buy: proposalId, price });

    const buy = response.buy as {
      contract_id: number;
      buy_price: number;
      balance_after: number;
      payout: number;
    } | undefined;

    if (!buy?.contract_id) {
      throw { code: "BUY_FAILED", message: "Buy did not return a contract" };
    }

    return {
      contractId: buy.contract_id,
      buyPrice: buy.buy_price,
      balanceAfter: buy.balance_after,
      payout: buy.payout,
    };
  }

  async subscribeOpenContract(
    contractId: number,
    callback: (data: Record<string, unknown>) => void
  ): Promise<string> {
    return this.subscribe(
      { proposal_open_contract: 1, contract_id: contractId },
      callback
    );
  }

  subscribeBalance(callback: (balance: number, currency: string) => void): void {
    this.subscribe({ balance: 1 }, (data) => {
      const bal = data.balance as { balance: number; currency: string } | undefined;
      if (bal) callback(bal.balance, bal.currency);
    }).catch(() => {});
  }

  disconnect(): void {
    this._isConnected = false;
    this._isAuthenticated = false;
    this.pendingRequests.forEach((p) =>
      p.reject({ code: "DISCONNECT", message: "Manually disconnected" })
    );
    this.pendingRequests.clear();
    this.subscriptionCallbacks.clear();
    this.ws?.close();
    this.ws = null;
  }
}

export const derivTradingWS = DerivTradingWS.getInstance();
