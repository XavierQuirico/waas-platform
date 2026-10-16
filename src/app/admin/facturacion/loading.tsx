import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function FacturacionLoading() {
  return (
    <RouteSkeletonGate>
      <div className="flex h-full flex-col">
      <div className="shrink-0 px-8 pt-7">
        <div className="mb-5 flex items-center gap-4">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="ml-auto h-9 w-44 rounded-full" />
        </div>
        <div className="flex gap-1">
          {[88, 138, 124, 158].map((width) => (
            <Skeleton key={width} className="h-9 rounded-lg" style={{ width }} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-8 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 md:col-span-2">
            <Skeleton className="mb-4 h-3 w-28" />
            <div className="mb-5 flex items-end justify-between gap-6">
              <div>
                <Skeleton className="mb-3 h-11 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div>
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-7 w-28" />
              </div>
            </div>
            <Skeleton className="mb-4 h-16 w-full" />
            <div className="flex h-20 items-end gap-2">
              {[34, 52, 44, 68, 58, 76].map((height, index) => (
                <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height }} />
              ))}
            </div>
          </div>

          {[1, 2].map((card) => (
            <div key={card} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Skeleton className="mb-4 h-3 w-28" />
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="mb-3 last:mb-0">
                  <div className="mb-2 flex justify-between gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((card) => (
            <div key={card} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Skeleton className="mb-3 h-3 w-28" />
              <Skeleton className="mb-2 h-8 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
