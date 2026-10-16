import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function AssetsLoading() {
  return (
    <RouteSkeletonGate>
      <div className="mx-auto max-w-2xl space-y-5 p-6 lg:max-w-5xl">
        {/* Package header */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-6 w-52" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          <Skeleton className="mt-5 h-1.5 w-full rounded-full" />
        </div>

        {/* Master-detail */}
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, row) => (
              <Skeleton key={row} className="h-12 w-full rounded-lg" />
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:mt-0">
            <Skeleton className="mb-4 h-5 w-44" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </RouteSkeletonGate>
  );
}
