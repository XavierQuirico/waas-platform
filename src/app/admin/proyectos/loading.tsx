import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function ProyectosLoading() {
  return (
    <RouteSkeletonGate>
      <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <Skeleton className="mb-2 h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="ml-auto h-9 w-40 rounded-full" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div key={row} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-white/[0.06] p-4 last:border-b-0">
            <div>
              <Skeleton className="mb-2 h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
