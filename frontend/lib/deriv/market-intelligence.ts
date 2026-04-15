"use strict";

import { derivWS } from "./websocket";
import type {
  ContractsForResponse,
  ProposalResponse,
  TradingTimesResponse,
  ContractType,
} from "./types";

type DurationUnit = "s" | "m" | "h" | "d" | "t";

export interface ContractAvailability {
  contractType: string;
  minDuration: string;
  maxDuration: string;
  sentiment: string;
}

export interface ProposalPreview {
  askPrice: number;
  payout: number;
  longcode: string;
}

export async function fetchContractsForAsset(asset: string): Promise<ContractAvailability[]> {
  const response = await derivWS.send({
    contracts_for: asset,
    product_type: "basic",
  });
  const data = response as unknown as ContractsForResponse;
  const list = data.contracts_for?.available ?? [];

  return list.map((contract) => ({
    contractType: contract.contract_type,
    minDuration: contract.min_contract_duration,
    maxDuration: contract.max_contract_duration,
    sentiment: contract.sentiment,
  }));
}

export async function fetchProposalPreview(params: {
  symbol: string;
  amount: number;
  duration: number;
  durationUnit: DurationUnit;
  contractType: ContractType;
  currency?: string;
}): Promise<ProposalPreview | null> {
  const response = await derivWS.send({
    proposal: 1,
    amount: params.amount,
    basis: "stake",
    contract_type: params.contractType,
    currency: params.currency ?? "USD",
    duration: params.duration,
    duration_unit: params.durationUnit,
    symbol: params.symbol,
  });

  const data = response as unknown as ProposalResponse;
  if (!data.proposal) return null;

  return {
    askPrice: data.proposal.ask_price,
    payout: data.proposal.payout,
    longcode: data.proposal.longcode,
  };
}

export async function fetchMarketHours(symbol: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await derivWS.send({ trading_times: today });
  const data = response as unknown as TradingTimesResponse;
  const markets = data.trading_times?.markets ?? [];

  for (const market of markets) {
    for (const sub of market.submarkets) {
      const match = sub.symbols.find((item) => item.symbol === symbol);
      if (match) {
        const open = match.times.open?.[0] ?? "n/a";
        const close = match.times.close?.[0] ?? "n/a";
        return `${open} - ${close}`;
      }
    }
  }

  return null;
}
