'use client';

import { useEffect, useState } from 'react';

interface TimeRemaining {
  expired: boolean;
  hours: number;
  minutes: number;
}

function getTimeRemaining(deadline: Date): TimeRemaining {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return { expired: true, hours: 0, minutes: 0 };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { expired: false, hours, minutes };
}

function getUrgencyClass(hours: number, expired: boolean): string {
  if (expired) return 'border-red-500/20 bg-red-500/10 text-red-400';
  if (hours < 4) return 'border-red-500/20 bg-red-500/10 text-red-400';
  if (hours < 24) return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
  return 'border-green-500/20 bg-green-500/10 text-green-400';
}

interface SlaCountdownProps {
  deadline: Date;
  label?: string;
  className?: string;
}

export function SlaCountdown({ deadline, label = 'Entrega en', className = '' }: SlaCountdownProps) {
  const [remaining, setRemaining] = useState<TimeRemaining>(getTimeRemaining(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(getTimeRemaining(deadline));
    }, 60_000);
    return () => clearInterval(timer);
  }, [deadline]);

  const urgency = getUrgencyClass(remaining.hours, remaining.expired);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-['Figtree'] ${urgency} ${className}`}
    >
      {remaining.expired ? (
        <span className="font-semibold">Plazo vencido</span>
      ) : (
        <>
          <span className="opacity-60">{label}</span>
          <span className="font-semibold font-['Space_Grotesk']">
            {remaining.hours}h {remaining.minutes}m
          </span>
        </>
      )}
      {!remaining.expired && remaining.hours < 4 && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      )}
    </div>
  );
}
