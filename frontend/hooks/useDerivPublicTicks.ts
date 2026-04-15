'use strict';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDerivPublicTickFeed, type DerivFeedStatus } from '@/lib/deriv/publicTickFeed';

const MAX_RETURNS = 160;

/**
 * Live synthetic ticks from Deriv public WS for a single `symbol` (e.g. 1HZ100V, R_75).
 */
export function useDerivPublicTicks(symbol: string | null, enabled: boolean) {
  const [quote, setQuote] = useState<number | null>(null);
  const [returns, setReturns] = useState<number[]>([]);
  const [status, setStatus] = useState<DerivFeedStatus>('idle');
  const [detail, setDetail] = useState<string | undefined>();
  const lastQuoteRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    lastQuoteRef.current = null;
    setQuote(null);
    setReturns([]);
    setStatus('idle');
    setDetail(undefined);
  }, []);

  useEffect(() => {
    if (!enabled || !symbol) {
      reset();
      return;
    }

    setStatus('connecting');
    const { dispose } = createDerivPublicTickFeed({
      symbol,
      historyCount: 50,
      onHistoryReturns: (rs, lastQ) => {
        lastQuoteRef.current = lastQ;
        setReturns(rs.slice(-MAX_RETURNS));
        setQuote(lastQ);
      },
      onTick: ({ quote: q }) => {
        setQuote(q);
        setReturns((prev) => {
          const last = lastQuoteRef.current;
          if (last != null && last > 0 && Number.isFinite(q)) {
            const r = (q - last) / last;
            lastQuoteRef.current = q;
            return [...prev, r].slice(-MAX_RETURNS);
          }
          lastQuoteRef.current = q;
          return prev;
        });
      },
      onStatus: (s, err) => {
        setStatus(s);
        setDetail(err);
      },
    });

    return () => {
      dispose();
      lastQuoteRef.current = null;
    };
  }, [enabled, symbol, reset]);

  return { quote, returns, status, detail, reset };
}
