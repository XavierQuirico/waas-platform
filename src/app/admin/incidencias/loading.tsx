import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function IncidenciasLoading() {
  return (
    <RouteSkeletonGate>
      <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <Skeleton className="mb-2 h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="ml-auto h-9 w-44 rounded-full" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((card) => (
          <div key={card} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-4 flex justify-between gap-4">
              <div>
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mb-3 h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
