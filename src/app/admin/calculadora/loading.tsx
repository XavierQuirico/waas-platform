import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function CalculadoraLoading() {
  return (
    <RouteSkeletonGate>
      <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <Skeleton className="mb-2 h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="ml-auto h-9 w-40 rounded-full" />
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <Skeleton className="mb-3 h-7 w-7 rounded-full" />
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <Skeleton className="mb-5 h-5 w-44" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="mb-2 h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-5 h-28 w-full rounded-lg" />
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <Skeleton className="mb-5 h-5 w-36" />
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="mb-4 flex items-center justify-between last:mb-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
          <Skeleton className="mt-6 h-10 w-full rounded-lg" />
        </section>
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
