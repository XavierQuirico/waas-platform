import type { StagingFeedbackItem } from '@/db/schema';

export function validateStagingChangesFeedback(items: StagingFeedbackItem[]): void {
  const hasChangeItem = items.some((item) => item.status === 'changes');

  if (!hasChangeItem) {
    throw new Error('Incluye al menos un cambio para solicitar revisión.');
  }

  const invalidItem = items.find(
    (item) => item.status === 'changes' && !item.comment?.trim(),
  );

  if (invalidItem) {
    throw new Error(
      `La sección "${invalidItem.section}" necesita descripción del cambio.`,
    );
  }
}
