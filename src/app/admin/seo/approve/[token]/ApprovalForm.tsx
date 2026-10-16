'use client';

import { useRef, useTransition } from 'react';
import { approveSeoReport } from './actions';
import type { SeoMonthlyReportData } from '@/db/schema/seo-approval-tokens';

const CRUX_LABELS: Record<string, string> = {
  FAST: 'Rápido',
  MODERATE: 'Moderado',
  SLOW: 'Lento',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#6b7280',
};

interface Props {
  token: string;
  report: SeoMonthlyReportData;
  expiresAt: string;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#6b7280';
  if (score >= 90) return '#16a34a';
  if (score >= 70) return '#d97706';
  return '#dc2626';
}

export function ApprovalForm({ token, report, expiresAt }: Props) {
  const changesRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();

  const expiresDate = new Date(expiresAt).toLocaleDateString('es-DO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const changes = changesRef.current?.value ?? '';
    const suggestions = suggestionsRef.current?.value ?? '';
    startTransition(() => approveSeoReport(token, changes, suggestions));
  }

  return (
    <div style={{ maxWidth: 620, margin: '48px auto', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
          Aprobación requerida · vence {expiresDate}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          Reporte SEO — {report.businessName}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          {report.clientName} · {report.period} · {report.productionUrl}
        </p>
      </div>

      {/* Score */}
      <div
        style={{
          backgroundColor: '#f9fafb',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 2px' }}>Lighthouse score</p>
          <p style={{ fontSize: 40, fontWeight: 800, color: scoreColor(report.currentScore), margin: 0, lineHeight: 1 }}>
            {report.currentScore ?? '—'}
          </p>
          {report.previousScore !== null && report.currentScore !== null && (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
              anterior: {report.previousScore}
            </p>
          )}
        </div>
        {report.cruxScore && (
          <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 20 }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>
              Experiencia real usuarios
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', margin: 0 }}>
              {CRUX_LABELS[report.cruxScore] ?? report.cruxScore}
            </p>
          </div>
        )}
      </div>

      {/* Issues */}
      {report.topIssues.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>
            Issues principales
          </p>
          {report.topIssues.map((issue) => (
            <div
              key={issue.id}
              style={{
                borderLeft: `3px solid ${SEVERITY_COLORS[issue.severity]}`,
                padding: '8px 12px',
                marginBottom: 6,
                backgroundColor: '#fafafa',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <span style={{ fontSize: 13, color: '#111827' }}>{issue.title}</span>
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: SEVERITY_COLORS[issue.severity],
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {issue.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de notas */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
          >
            Mejoras aplicadas este mes
            <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>(opcional)</span>
          </label>
          <textarea
            ref={changesRef}
            rows={4}
            placeholder="Ej: Se optimizaron las imágenes del hero, se eliminó CSS no utilizado..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 14,
              color: '#111827',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
          >
            Sugerencias de contenido
            <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>(opcional)</span>
          </label>
          <textarea
            ref={suggestionsRef}
            rows={3}
            placeholder="Ej: Considera añadir una sección de testimonios, agregar FAQ..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 14,
              color: '#111827',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16, lineHeight: 1.5 }}>
          Al aprobar, se enviará el email E22 a{' '}
          <strong style={{ color: '#374151' }}>{report.clientEmail}</strong> con el reporte de{' '}
          <em>Salud Técnica SEO</em> de {report.period}.
        </p>

        <button
          type="submit"
          disabled={isPending}
          style={{
            backgroundColor: isPending ? '#6b7280' : '#111827',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isPending ? 'Enviando...' : `Aprobar y enviar a ${report.clientName.split(' ')[0]} →`}
        </button>
      </form>
    </div>
  );
}
