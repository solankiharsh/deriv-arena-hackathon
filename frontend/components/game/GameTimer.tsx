'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { sfx } from '@/lib/sounds';

interface GameTimerProps {
  endsAt: string | null;
  status: string;
  onTimeUp?: () => void;
}

export default function GameTimer({ endsAt, status, onTimeUp }: GameTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!endsAt || status !== 'live') return;

    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
      if (diff <= 0) onTimeUp?.();
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt, status, onTimeUp]);

  const isUrgent = status === 'live' && remaining < 60_000;

  useEffect(() => {
    if (isUrgent && remaining > 0 && !warnedRef.current) {
      warnedRef.current = true;
      sfx.play('timer_warning');
    }
  }, [isUrgent, remaining]);

  if (status === 'waiting') {
    return (
      <div className="flex items-center gap-2 text-warning">
        <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
        <span className="text-sm font-mono font-bold uppercase">Waiting to Start</span>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <Timer className="w-4 h-4" />
        <span className="text-sm font-mono font-bold uppercase">Finished</span>
      </div>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'text-error' : 'text-success'}`}>
      <div className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-error animate-pulse' : 'bg-success'}`} />
      <span className="text-sm font-mono font-bold tabular-nums">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
