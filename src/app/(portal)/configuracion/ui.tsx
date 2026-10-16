import * as React from 'react';
import { Lock, Eye, PencilLine } from 'lucide-react';
import type { ConfigDisplayRow } from '@/lib/portal/configuration-view-model';
import styles from './configuracion.module.css';

export type SectionStatusKind = 'editable' | 'managed' | 'readonly';

/** Indicador sobrio de jerarquía: qué puede editar el cliente y qué no. */
export function SectionStatusChip({ kind }: { kind: SectionStatusKind }) {
  if (kind === 'editable') {
    return (
      <span className={`${styles.chip} ${styles.chipEditable}`}>
        <PencilLine size={11} aria-hidden="true" />
        Editable por ti
      </span>
    );
  }
  if (kind === 'managed') {
    return (
      <span className={`${styles.chip} ${styles.chipManaged}`}>
        <Lock size={11} aria-hidden="true" />
        Gestionado
      </span>
    );
  }
  return (
    <span className={`${styles.chip} ${styles.chipReadonly}`}>
      <Eye size={11} aria-hidden="true" />
      Solo lectura
    </span>
  );
}

/** Badge mínimo para marcar filas-excepción gestionadas dentro de una sección editable. */
export function MiniBadge() {
  return <span className={styles.miniBadge}>Gestionado</span>;
}

/**
 * Leyenda de jerarquía de información: comunica de un vistazo qué significan los
 * tres estados de un dato (editable / gestionado / solo lectura) antes de que el
 * cliente lea las secciones. Sobria, no decorativa.
 */
export function ClassificationLegend() {
  return (
    <ul className={styles.legend} aria-label="Qué puedes editar">
      <li className={`${styles.legendItem} ${styles.chip} ${styles.chipEditable}`}>
        <PencilLine size={11} aria-hidden="true" />
        Editable
      </li>
      <li className={`${styles.legendItem} ${styles.chip} ${styles.chipManaged}`}>
        <Lock size={11} aria-hidden="true" />
        Gestionado
      </li>
      <li className={`${styles.legendItem} ${styles.chip} ${styles.chipReadonly}`}>
        <Eye size={11} aria-hidden="true" />
        Solo lectura
      </li>
    </ul>
  );
}

export function ReadonlyRow({
  row,
  hideBadge,
}: {
  row: ConfigDisplayRow;
  hideBadge?: boolean;
}) {
  return (
    <div>
      <div className={styles.rowHead}>
        <span className={styles.rowLabel}>{row.label}</span>
        {row.managed && !hideBadge && <MiniBadge />}
      </div>
      <div className={styles.rowValue}>{row.value}</div>
      {row.hint && <div className={styles.rowHint}>{row.hint}</div>}
    </div>
  );
}
