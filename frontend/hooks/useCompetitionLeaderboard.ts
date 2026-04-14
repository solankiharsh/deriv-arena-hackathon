'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLeaderboard, leaderboardStreamUrl, type LeaderboardEntry } from '@/lib/derivarena-api';

type Status = 'idle' | 'loading' | 'streaming' | 'error';

export function useCompetitionLeaderboardStream(competitionId: string | undefined) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const closeStream = useCallback(() => {
    clearRetryTimer();
    if (esRef.current) {
      // Detach handlers before close(); otherwise some browsers fire `error`
      // after intentional shutdown — that used to schedule reconnect loops
      // (especially visible under React Strict Mode double-mount).
      const es = esRef.current;
      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;
      es.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (id: string) => {
      closeStream();
      setStatus('loading');
      setError(null);

      const url = leaderboardStreamUrl(id);
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
        setStatus('streaming');
      };

      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data as string) as LeaderboardEntry[];
          setEntries(Array.isArray(data) ? data : []);
          setStatus('streaming');
        } catch {
          // malformed SSE frame — ignore
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (retryCountRef.current >= MAX_RETRIES) {
          setStatus('error');
          setError('Lost connection to leaderboard stream.');
          return;
        }

        // Exponential back-off: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 16_000);
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => connect(id), delay);
      };
    },
    [closeStream],
  );

  useEffect(() => {
    if (!competitionId) return;

    // Fetch initial snapshot immediately (avoids blank screen until first SSE frame)
    getLeaderboard(competitionId)
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => {/* swallow — SSE will provide data */});

    connect(competitionId);

    return () => {
      closeStream();
    };
  }, [competitionId, connect, closeStream]);

  return { entries, status, error };
}
