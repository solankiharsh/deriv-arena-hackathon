'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import { derivTradingWS } from '@/lib/deriv/trading-ws';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  formatDuration,
  getContractLabel,
  getSymbolDisplayName,
} from '@/lib/trading-copilot/widget-symbols';

export type CopilotTradeTicketData = {
  symbol: string;
  contract_type: string;
  amount: number;
  duration: number;
  duration_unit: string;
  barrier?: string;
};

type TicketState =
  | 'idle'
  | 'pricing'
  | 'ready'
  | 'executing'
  | 'purchased'
  | 'error'
  | 'cancelled';

const PROPOSAL_REFRESH_MS = 4000;

export function WidgetTradeTicket({ data }: { data: CopilotTradeTicketData }) {
  const { symbol, contract_type, amount, duration, duration_unit, barrier } = data;
  const isAuthorized = useAuthStore((s) => s.isAuthorized);
  const currency = useAuthStore((s) => s.currency);

  const [state, setState] = useState<TicketState>(isAuthorized ? 'pricing' : 'idle');
  const [askPrice, setAskPrice] = useState<number | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contractId, setContractId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refreshProposal = useCallback(async () => {
    try {
      const proposal = await derivTradingWS.sendProposal({
        amount,
        contractType: contract_type,
        symbol,
        duration,
        durationUnit: duration_unit,
        currency,
      });
      setProposalId(proposal.proposalId);
      setAskPrice(proposal.askPrice);
      setPayout(proposal.payout);
      setState((prev) => (prev === 'purchased' || prev === 'error' ? prev : 'ready'));
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'Pricing unavailable';
      setError(msg);
      setState('error');
      clearTimer();
    }
  }, [amount, contract_type, symbol, duration, duration_unit, currency, clearTimer]);

  useEffect(() => {
    if (!isAuthorized) {
      setState('idle');
      return;
    }
    if (state !== 'pricing' && state !== 'ready') return;

    void refreshProposal();
    clearTimer();
    timerRef.current = setInterval(() => {
      void refreshProposal();
    }, PROPOSAL_REFRESH_MS);

    return () => clearTimer();
  }, [isAuthorized, refreshProposal, clearTimer, state]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleConfirm = async () => {
    if (!proposalId || askPrice == null) return;
    clearTimer();
    setState('executing');
    try {
      const buy = await derivTradingWS.sendBuy(proposalId, askPrice);
      setContractId(buy.contractId);
      setState('purchased');
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'Trade failed';
      setError(msg);
      setState('error');
    }
  };

  const handleCancel = () => {
    clearTimer();
    setState('cancelled');
  };

  const isRise = contract_type === 'CALL' || contract_type === 'MULTUP';
  const DirectionIcon = isRise ? ArrowUpCircle : ArrowDownCircle;
  const directionColor = isRise ? 'text-accent-primary' : 'text-error';
  const payoutPct =
    payout != null && askPrice != null && askPrice > 0
      ? (((payout - askPrice) / askPrice) * 100).toFixed(0)
      : null;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <DirectionIcon className={`h-5 w-5 ${directionColor}`} />
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {getContractLabel(contract_type)} · {getSymbolDisplayName(symbol)}
          </h3>
          <p className="text-xs text-text-muted">
            {formatDuration(duration, duration_unit)}
            {barrier ? ` · Barrier ${barrier}` : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        {!isAuthorized ? (
          <p className="text-sm text-text-muted">
            Connect your Deriv account in the Arena to preview and execute this ticket.
          </p>
        ) : state === 'purchased' ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <CheckCircle2 className="h-8 w-8 text-accent-primary" />
            <p className="text-sm font-semibold text-accent-primary">Trade purchased</p>
            {contractId ? (
              <p className="text-xs text-text-muted">Contract #{contractId}</p>
            ) : null}
          </div>
        ) : state === 'cancelled' ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <XCircle className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">Ticket cancelled</p>
          </div>
        ) : state === 'error' ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <XCircle className="h-8 w-8 text-error" />
            <p className="text-sm text-error">{error ?? 'Pricing failed'}</p>
          </div>
        ) : state === 'executing' ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            <span className="text-sm text-text-muted">Executing trade…</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Stake</span>
              <span className="font-mono font-medium text-text-primary">
                {currency} {amount.toFixed(2)}
              </span>
            </div>
            {askPrice != null ? (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Price</span>
                <span className="font-mono font-medium text-text-primary">
                  {currency} {askPrice.toFixed(2)}
                </span>
              </div>
            ) : null}
            {payout != null ? (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Potential payout</span>
                <span className="font-mono font-medium text-accent-primary">
                  {currency} {payout.toFixed(2)}
                  {payoutPct ? <span className="ml-1 text-xs">({payoutPct}%)</span> : null}
                </span>
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={state !== 'ready'}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  isRise
                    ? 'bg-accent-primary text-black hover:brightness-110 disabled:opacity-50'
                    : 'bg-error text-white hover:brightness-110 disabled:opacity-50'
                } disabled:cursor-not-allowed`}
              >
                {state === 'ready' ? 'Confirm trade' : 'Pricing…'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-bg-secondary"
              >
                Cancel
              </button>
            </div>

            <p className="text-[10px] text-text-muted">
              Binary options involve substantial risk of loss.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
