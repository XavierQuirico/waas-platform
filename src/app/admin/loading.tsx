import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function AdminLoading() {
  return (
    <RouteSkeletonGate>
      <div className="flex h-full flex-col p-8">
      <div className="mb-5 flex items-center gap-4">
        <div>
          <Skeleton className="mb-2 h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="ml-auto h-9 w-32 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <Skeleton className="mb-4 h-3 w-20" />
            <Skeleton className="mb-3 h-9 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <Skeleton className="mb-4 h-3 w-28" />
          <div className="flex h-16 items-end gap-2">
            {[28, 42, 34, 58, 48, 62].map((height, index) => (
              <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height }} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid flex-1 min-h-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 xl:col-span-2">
          <Skeleton className="mb-5 h-4 w-40" />
          <div className="flex h-56 items-end gap-3">
            {[70, 96, 82, 132, 116, 150, 126, 168].map((height, index) => (
              <Skeleton key={index} className="flex-1 rounded-t-lg" style={{ height }} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {[1, 2].map((section) => (
            <div key={section} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Skeleton className="mb-4 h-4 w-36" />
              {[1, 2, 3].map((row) => (
                <div key={row} className="mb-4 flex items-center gap-3 last:mb-0">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((card) => (
          <div key={card} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <Skeleton className="mb-4 h-4 w-32" />
            <Skeleton className="mb-3 h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
