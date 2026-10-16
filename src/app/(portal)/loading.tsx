import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function PortalLoading() {
  return (
    <RouteSkeletonGate>
      <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <Skeleton className="mb-2 h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="ml-auto h-9 w-32 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="mb-3 h-4 w-full" />
          <Skeleton className="mb-6 h-4 w-3/4" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <Skeleton className="mb-4 h-5 w-28" />
          <Skeleton className="mb-3 h-8 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
