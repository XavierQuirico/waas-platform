import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function DashboardLoading() {
  return (
    <RouteSkeletonGate>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="mb-3 h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 md:col-span-2 lg:col-span-3">
          <Skeleton className="mb-5 h-4 w-32" />
          <div className="flex h-32 items-end gap-3">
            {[60, 90, 48, 104, 72, 118, 86].map((height, index) => (
              <Skeleton key={index} className="flex-1 rounded-t-lg" style={{ height }} />
            ))}
          </div>
        </div>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
