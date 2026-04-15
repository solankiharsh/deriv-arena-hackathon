'use client';

import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

interface GameTimerProps {
  endsAt: string | null;
  status: string;
  onTimeUp?: () => void;
}

export default function GameTimer({ endsAt, status, onTimeUp }: GameTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);

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
  const isUrgent = remaining < 60_000;

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'text-error' : 'text-success'}`}>
      <div className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-error animate-pulse' : 'bg-success'}`} />
      <span className="text-sm font-mono font-bold tabular-nums">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
