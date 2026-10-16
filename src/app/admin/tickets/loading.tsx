import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function TicketsLoading() {
  return (
    <RouteSkeletonGate>
      <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="ml-auto h-9 w-36 rounded-full" />
      </div>

      <div className="mb-5 flex gap-2">
        {[96, 118, 126, 104].map((width) => (
          <Skeleton key={width} className="h-9 rounded-lg" style={{ width }} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((card) => (
          <div key={card} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mb-3 h-3 w-full" />
            <Skeleton className="mb-5 h-3 w-4/5" />
            <div className="flex justify-between gap-3">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
