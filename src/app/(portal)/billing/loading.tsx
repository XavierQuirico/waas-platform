import { Skeleton } from '@/components/ui/Skeleton';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

export default function BillingLoading() {
  return (
    <RouteSkeletonGate>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Skeleton className="mb-2 h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0F1014] p-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="mb-2 h-8 w-28" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-[#0F1014] p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0F1014] p-5">
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="h-10 w-52 rounded-lg" />
      </div>
    </div>
    </RouteSkeletonGate>
  );
}
