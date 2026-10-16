import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function SitiosLoading() {
  return (
    <RouteSkeletonGate>
      <div className="flex h-full flex-col">
      <div className="shrink-0 px-8 pt-7">
        <Skeleton className="mb-2 h-8 w-28" />
        <Skeleton className="mb-6 h-4 w-72" />
      </div>

      <div className="flex-1 overflow-hidden px-8 pb-8">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {['En vivo', 'En producción', 'Suspendidos'].map((label) => (
            <section key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-5 flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-7 w-10 rounded-full" />
              </div>
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="mb-4 rounded-lg border border-white/[0.06] p-4 last:mb-0">
                  <Skeleton className="mb-2 h-4 w-40" />
                  <Skeleton className="mb-3 h-3 w-28" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
