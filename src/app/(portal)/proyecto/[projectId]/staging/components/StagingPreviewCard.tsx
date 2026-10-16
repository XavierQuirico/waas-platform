import { ExternalLink } from 'lucide-react';
import { toExternalUrl } from '@/lib/portal/url';

interface StagingPreviewCardProps {
  stagingUrl: string | null;
}

export function StagingPreviewCard({ stagingUrl }: StagingPreviewCardProps) {
  const externalUrl = toExternalUrl(stagingUrl);
  const displayUrl = externalUrl?.replace(/^https?:\/\//, '').slice(0, 60);

  if (!externalUrl) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <p className="text-sm text-white/40">El preview aún no tiene URL disponible.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="truncate text-xs text-white/30">{displayUrl}</p>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/85 transition-colors hover:border-[rgba(255,140,0,0.4)] hover:bg-[rgba(255,140,0,0.06)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,140,0,0.5)] sm:w-auto"
        >
          Abrir preview
          <ExternalLink size={14} aria-hidden="true" strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}
