import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-skeleton rounded-md bg-white/[0.06]',
        className
      )}
      {...props}
    />
  );
}
