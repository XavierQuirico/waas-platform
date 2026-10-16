interface FeedbackHistoryItem {
  id: string;
  submittedAt: Date;
  allApproved: boolean | null;
  itemCount: number;
}

interface StagingFeedbackHistoryProps {
  items: FeedbackHistoryItem[];
}

export function StagingFeedbackHistory({ items }: StagingFeedbackHistoryProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-white/30">
        Historial de revisiones
      </h2>
      <div className="space-y-1.5">
        {items.map((item, index) => {
          const roundNumber = items.length - index;
          const isApproved = item.allApproved === true;
          const label = isApproved ? 'Aprobado' : 'Cambios solicitados';
          const labelStyle = isApproved ? 'text-green-400' : 'text-amber-400';
          const date = item.submittedAt.toLocaleDateString('es-DO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/25">Ronda #{roundNumber}</span>
                <span className={`text-xs font-medium ${labelStyle}`}>{label}</span>
              </div>
              <span className="text-xs text-white/25">{date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
