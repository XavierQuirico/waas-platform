import * as React from 'react';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import type { ConfigurationViewModel } from '@/lib/portal/configuration-view-model';
import { EditableSection } from './EditableSection';
import { ReadonlyRow, SectionStatusChip, ClassificationLegend } from './ui';
import styles from './configuracion.module.css';

interface Props {
  viewModel: ConfigurationViewModel;
}

export function ConfiguracionView({ viewModel }: Props) {
  const editableSections = viewModel.sections.filter((s) => s.kind === 'editable');
  const sideSections = viewModel.sections.filter(
    (s) => s.kind === 'readonly' || s.kind === 'managed',
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>
          Revisa los datos vinculados a tu cuenta. Puedes editar algunos datos; los datos
          protegidos los gestiona Xavier para evitar cambios accidentales.
        </p>
        <ClassificationLegend />
      </header>

      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Datos que puedes editar</h2>
              <SectionStatusChip kind="editable" />
            </div>
            {editableSections.map((section) =>
              section.kind === 'editable' ? (
                <EditableSection key={section.id} section={section} />
              ) : null,
            )}
          </div>
        </div>

        <div className={styles.col}>
          {sideSections.map((section) => {
            if (section.kind === 'readonly') {
              return (
                <section
                  key={section.id}
                  aria-label={section.title}
                  className={styles.card}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeadText}>
                      <div className={styles.cardTitleRow}>
                        <h2 className={styles.cardTitle}>{section.title}</h2>
                        <SectionStatusChip kind="readonly" />
                      </div>
                      <p className={styles.cardDesc}>{section.description}</p>
                    </div>
                  </div>
                  <div className={styles.rows}>
                    {section.rows.map((row) => (
                      <ReadonlyRow key={row.id} row={row} hideBadge />
                    ))}
                  </div>
                </section>
              );
            }

            // managed
            return (
              <section
                key={section.id}
                aria-label={section.title}
                className={`${styles.card} ${styles.cardManaged}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeadText}>
                    <div className={styles.cardTitleRow}>
                      <h2 className={styles.cardTitle}>{section.title}</h2>
                      <SectionStatusChip kind="managed" />
                    </div>
                    <p className={styles.cardDesc}>{section.description}</p>
                  </div>
                </div>
                <div className={styles.rows} style={{ marginBottom: 18 }}>
                  {section.rows.map((row) => (
                    <ReadonlyRow key={row.id} row={row} hideBadge />
                  ))}
                </div>
                <Link href={section.cta.href} className={styles.btnRequest}>
                  <LifeBuoy size={14} aria-hidden="true" />
                  {section.cta.label}
                </Link>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
