import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function InsightsLoading() {
  return (
    <RouteSkeletonGate>
      <div className="flex h-full flex-col">
      <div className="shrink-0 px-8 pt-7">
        <Skeleton className="mb-5 h-8 w-56" />
        <div className="mb-5 flex gap-2">
          {[92, 86, 88, 92, 120].map((width) => (
            <Skeleton key={width} className="h-8 rounded-lg" style={{ width }} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-8 pb-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 md:col-span-3">
            <Skeleton className="mb-4 h-3 w-56" />
            <div className="mb-5 flex items-baseline gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mb-5 h-28 w-full" />
            <div className="grid grid-cols-9 gap-2">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="h-9 rounded-md" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <Skeleton className="mb-4 h-3 w-24" />
            <Skeleton className="mb-3 h-8 w-28" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((card) => (
            <div key={card} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 md:col-span-2">
              <Skeleton className="mb-4 h-3 w-32" />
              <Skeleton className="mb-4 h-8 w-28" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
