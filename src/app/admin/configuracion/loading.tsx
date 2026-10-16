import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function ConfiguracionLoading() {
  return (
    <RouteSkeletonGate>
      <div className="p-8">
      <Skeleton className="mb-5 h-8 w-48" />
      <div className="mb-6 flex flex-wrap gap-2">
        {[92, 82, 96, 118, 70, 126].map((width) => (
          <Skeleton key={width} className="h-9 rounded-lg" style={{ width }} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <Skeleton className="mb-5 h-5 w-40" />
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex items-center justify-between border-b border-white/[0.06] py-4 last:border-b-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44" />
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <Skeleton className="mb-5 h-5 w-32" />
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((card) => (
              <div key={card} className="rounded-lg border border-white/[0.06] p-4">
                <Skeleton className="mb-3 h-4 w-40" />
                <Skeleton className="mb-3 h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
