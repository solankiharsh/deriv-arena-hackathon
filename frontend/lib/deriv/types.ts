"use strict";

// Deriv WebSocket API Type Definitions
// Based on: wss://ws.derivws.com/websockets/v3?app_id=XXX

export type DerivDirection = "CALL" | "PUT";
export type ContractType = "CALL" | "PUT" | "TOUCH" | "NOTOUCH" | "ASIAN" | "DIGIT";

// ── Authorize ──────────────────────────────────────────────────
export interface AuthorizeRequest {
  authorize: string;
  req_id?: number;
}

export interface AuthorizeResponse {
  authorize: {
    account_list: Array<{
      account_type: string;
      currency: string;
      is_disabled: boolean;
      is_virtual: boolean;
      landing_company_name: string;
      loginid: string;
    }>;
    balance: number;
    country: string;
    currency: string;
    email: string;
    fullname: string;
    is_virtual: boolean;
    landing_company_name: string;
    loginid: string;
    user_id: number;
  };
  req_id?: number;
  msg_type: "authorize";
}

// ── Balance ─────────────────────────────────────────────────────
export interface BalanceRequest {
  balance: 1;
  subscribe?: 1;
  req_id?: number;
}

export interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    id?: string;
    loginid: string;
  };
  req_id?: number;
  msg_type: "balance";
  subscription?: { id: string };
}

// ── Active Symbols ──────────────────────────────────────────────
export interface ActiveSymbolsRequest {
  active_symbols: "brief" | "full";
  product_type?: "basic";
  req_id?: number;
}

export interface ActiveSymbol {
  allow_forward_starting: number;
  display_name: string;
  exchange_is_open: number;
  is_trading_suspended: number;
  market: string;
  market_display_name: string;
  pip: number;
  submarket: string;
  submarket_display_name: string;
  symbol: string;
  symbol_type: string;
}

export interface ActiveSymbolsResponse {
  active_symbols: ActiveSymbol[];
  req_id?: number;
  msg_type: "active_symbols";
}

// ── Ticks ───────────────────────────────────────────────────────
export interface TicksRequest {
  ticks: string;
  subscribe?: 1;
  req_id?: number;
}

export interface TickResponse {
  tick: {
    ask: number;
    bid: number;
    epoch: number;
    id: string;
    pip_size: number;
    quote: number;
    symbol: string;
  };
  req_id?: number;
  msg_type: "tick";
  subscription?: { id: string };
}

// ── Ticks History ───────────────────────────────────────────────
export interface TicksHistoryRequest {
  ticks_history: string;
  adjust_start_time?: 1;
  count?: number;
  end?: string | "latest";
  start?: number;
  style?: "ticks" | "candles";
  granularity?: number;
  subscribe?: 1;
  req_id?: number;
}

export interface TicksHistoryResponse {
  history?: { prices: number[]; times: number[] };
  candles?: Array<{ close: number; epoch: number; high: number; low: number; open: number }>;
  req_id?: number;
  msg_type: "history" | "candles";
}

// ── Proposal ────────────────────────────────────────────────────
export interface ProposalRequest {
  proposal: 1;
  amount: number;
  basis: "stake" | "payout";
  contract_type: ContractType;
  currency: string;
  duration: number;
  duration_unit: "s" | "m" | "h" | "d" | "t";
  symbol: string;
  subscribe?: 1;
  req_id?: number;
}

export interface ProposalResponse {
  proposal: {
    ask_price: number;
    date_expiry: number;
    date_start: number;
    display_value: string;
    id: string;
    longcode: string;
    payout: number;
    spot: number;
    spot_time: number;
  };
  req_id?: number;
  msg_type: "proposal";
  subscription?: { id: string };
}

// ── Contracts For ────────────────────────────────────────────────
export interface ContractsForRequest {
  contracts_for: string;
  currency?: string;
  landing_company?: string;
  product_type?: "basic";
  req_id?: number;
}

export interface ContractsForResponse {
  contracts_for: {
    available: Array<{
      contract_type: string;
      max_contract_duration: string;
      min_contract_duration: string;
      sentiment: string;
    }>;
    close: number;
    feed_license: string;
    hit_count: number;
    non_available: unknown[];
    open: number;
    spot: number;
  };
  req_id?: number;
  msg_type: "contracts_for";
}

// ── Buy ─────────────────────────────────────────────────────────
export interface BuyRequest {
  buy: string;
  price: number;
  req_id?: number;
}

export interface BuyResponse {
  buy: {
    balance_after: number;
    buy_price: number;
    contract_id: number;
    longcode: string;
    payout: number;
    purchase_time: number;
    shortcode: string;
    start_time: number;
    transaction_id: number;
  };
  req_id?: number;
  msg_type: "buy";
}

// ── Portfolio ────────────────────────────────────────────────────
export interface PortfolioRequest {
  portfolio: 1;
  contract_type?: ContractType[];
  req_id?: number;
}

export interface PortfolioContract {
  app_id: number;
  buy_price: number;
  contract_id: number;
  contract_type: string;
  currency: string;
  date_start: number;
  expiry_time: number;
  longcode: string;
  payout: number;
  purchase_time: number;
  shortcode: string;
  symbol: string;
  transaction_id: number;
}

export interface PortfolioResponse {
  portfolio: { contracts: PortfolioContract[] };
  req_id?: number;
  msg_type: "portfolio";
}

// ── Proposal Open Contract ────────────────────────────────────────
export interface ProposalOpenContractRequest {
  proposal_open_contract: 1;
  contract_id?: number;
  subscribe?: 1;
  req_id?: number;
}

export interface ProposalOpenContractResponse {
  proposal_open_contract: {
    barrier?: string;
    buy_price: number;
    contract_id: number;
    contract_type: string;
    currency: string;
    current_spot: number;
    current_spot_time: number;
    date_expiry: number;
    date_settlement?: number;
    date_start: number;
    display_name: string;
    entry_spot?: number;
    entry_spot_display_value?: string;
    entry_tick: number;
    entry_tick_time: number;
    exit_tick?: number;
    exit_tick_time?: number;
    expiry_time: number;
    id: string;
    is_expired: number;
    is_forward_starting: number;
    is_intraday: number;
    is_path_dependent: number;
    is_settleable: number;
    is_sold: number;
    is_valid_to_cancel: number;
    is_valid_to_sell: number;
    longcode: string;
    payout: number;
    profit: number;
    profit_percentage: number;
    purchase_time: number;
    sell_price?: number;
    sell_spot?: number;
    sell_spot_time?: number;
    sell_time?: number;
    shortcode: string;
    status: "open" | "won" | "lost" | "sold" | "cancelled";
    symbol: string;
    transaction_id: number;
    underlying: string;
  };
  req_id?: number;
  msg_type: "proposal_open_contract";
  subscription?: { id: string };
}

// ── Transaction ──────────────────────────────────────────────────
export interface TransactionRequest {
  transaction: 1;
  subscribe?: 1;
  req_id?: number;
}

export interface TransactionResponse {
  transaction: {
    action: "buy" | "sell" | "deposit" | "withdrawal" | "transfer" | "adjustment";
    amount: number;
    balance: number;
    contract_id?: number;
    currency: string;
    date_expiry?: number;
    display_name?: string;
    id: string;
    longcode?: string;
    purchase_time?: number;
    symbol?: string;
    transaction_id: number;
    transaction_time: number;
  };
  req_id?: number;
  msg_type: "transaction";
  subscription?: { id: string };
}

// ── Statement ────────────────────────────────────────────────────
export interface StatementRequest {
  statement: 1;
  action_type?: "buy" | "sell" | "deposit" | "withdrawal";
  date_from?: number;
  date_to?: number;
  description?: 1;
  limit?: number;
  offset?: number;
  req_id?: number;
}

export interface StatementResponse {
  statement: {
    count: number;
    transactions: Array<{
      action_type: string;
      amount: number;
      app_id: number;
      balance_after: number;
      contract_id?: number;
      longcode?: string;
      payout?: number;
      purchase_time?: number;
      reference_id: number;
      shortcode?: string;
      transaction_id: number;
      transaction_time: number;
    }>;
  };
  req_id?: number;
  msg_type: "statement";
}

// ── Profit Table ─────────────────────────────────────────────────
export interface ProfitTableRequest {
  profit_table: 1;
  contract_type?: ContractType[];
  date_from?: number;
  date_to?: number;
  description?: 1;
  limit?: number;
  offset?: number;
  sort?: "ASC" | "DESC";
  req_id?: number;
}

export interface ProfitTableResponse {
  profit_table: {
    count: number;
    transactions: Array<{
      app_id: number;
      buy_price: number;
      contract_id: number;
      contract_type: string;
      duration_type: string;
      longcode: string;
      payout: number;
      purchase_time: number;
      sell_price: number;
      sell_time: number;
      shortcode: string;
      transaction_id: number;
    }>;
  };
  req_id?: number;
  msg_type: "profit_table";
}

// ── Trading Times ─────────────────────────────────────────────────
export interface TradingTimesRequest {
  trading_times: string;
  req_id?: number;
}

export interface TradingTimesResponse {
  trading_times: {
    markets: Array<{
      name: string;
      submarkets: Array<{
        name: string;
        symbols: Array<{
          name: string;
          symbol: string;
          times: { close: string[]; open: string[]; settlement: string };
          trading_days: string[];
        }>;
      }>;
    }>;
  };
  req_id?: number;
  msg_type: "trading_times";
}

// ── Forget ────────────────────────────────────────────────────────
export interface ForgetRequest {
  forget: string;
  req_id?: number;
}

export interface ForgetAllRequest {
  forget_all: string | string[];
  req_id?: number;
}

// ── Generic response wrapper ───────────────────────────────────────
export interface DerivError {
  code: string;
  message: string;
}

export interface DerivBaseResponse {
  req_id?: number;
  msg_type: string;
  error?: DerivError;
}

export type AnyDerivRequest =
  | AuthorizeRequest
  | BalanceRequest
  | ActiveSymbolsRequest
  | TicksRequest
  | TicksHistoryRequest
  | ProposalRequest
  | ContractsForRequest
  | BuyRequest
  | PortfolioRequest
  | ProposalOpenContractRequest
  | TransactionRequest
  | StatementRequest
  | ProfitTableRequest
  | TradingTimesRequest
  | ForgetRequest
  | ForgetAllRequest;

export type AnyDerivResponse =
  | AuthorizeResponse
  | BalanceResponse
  | ActiveSymbolsResponse
  | TickResponse
  | TicksHistoryResponse
  | ProposalResponse
  | ContractsForResponse
  | BuyResponse
  | PortfolioResponse
  | ProposalOpenContractResponse
  | TransactionResponse
  | StatementResponse
  | ProfitTableResponse
  | TradingTimesResponse;
