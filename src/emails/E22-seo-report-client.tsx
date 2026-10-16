// E22 — Reporte "Salud Técnica SEO" para el cliente
// Enviado por Xavier desde /admin/seo/approve/[token] tras su revisión
// NUNCA enviar directamente sin pasar por la aprobación E21

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Section,
} from '@react-email/components';

interface E22Props {
  clientName: string;
  businessName: string;
  productionUrl: string;
  period: string;              // Ej: "junio 2026"
  currentScore: number | null;
  previousScore: number | null;
  cruxScore: string | null;
  topIssues: Array<{ id: string; title: string; severity: 'high' | 'medium' | 'low' }>;
  changesApplied?: string;     // Mejoras que Xavier aplicó este mes
  contentSuggestions?: string; // Sugerencias de contenido de Xavier
}

const CRUX_LABELS: Record<string, string> = {
  FAST: 'Rápido',
  MODERATE: 'Moderado',
  SLOW: 'Lento',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'Alta prioridad',
  medium: 'Prioridad media',
  low: 'Baja prioridad',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#6b7280',
};

function scoreLabel(score: number | null): string {
  if (score === null) return 'Sin datos';
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Bueno';
  if (score >= 50) return 'Necesita mejoras';
  return 'Crítico';
}

function scoreColor(score: number | null): string {
  if (score === null) return '#6b7280';
  if (score >= 90) return '#16a34a';
  if (score >= 70) return '#d97706';
  return '#dc2626';
}

function scoreDelta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  if (delta > 0) return `↑ ${delta} puntos respecto al mes anterior`;
  if (delta < 0) return `↓ ${Math.abs(delta)} puntos respecto al mes anterior`;
  return 'Sin cambios respecto al mes anterior';
}

export default function E22SeoReportClient({
  clientName,
  businessName,
  productionUrl,
  period,
  currentScore,
  previousScore,
  cruxScore,
  topIssues,
  changesApplied,
  contentSuggestions,
}: E22Props) {
  const firstName = clientName.split(' ')[0];
  const delta = scoreDelta(currentScore, previousScore);

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container
          style={{
            maxWidth: '600px',
            margin: '40px auto',
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '40px',
          }}
        >
          {/* Header */}
          <Text style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px' }}>
            {period} · {productionUrl}
          </Text>
          <Heading
            style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 6px' }}
          >
            Salud Técnica SEO — {businessName}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 28px' }}>
            Hola {firstName}, este es tu reporte mensual de salud técnica SEO.
          </Text>

          {/* Score principal */}
          <Section
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: '10px',
              padding: '20px 24px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <Text style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px' }}>
              Score de rendimiento web
            </Text>
            <Text
              style={{
                fontSize: '48px',
                fontWeight: '800',
                color: scoreColor(currentScore),
                margin: '0',
                lineHeight: '1.1',
              }}
            >
              {currentScore !== null ? currentScore : '—'}
            </Text>
            <Text
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: scoreColor(currentScore),
                margin: '4px 0 0',
              }}
            >
              {scoreLabel(currentScore)}
            </Text>
            {delta && (
              <Text style={{ color: '#6b7280', fontSize: '13px', margin: '6px 0 0' }}>
                {delta}
              </Text>
            )}
            {cruxScore && (
              <Text style={{ color: '#374151', fontSize: '13px', margin: '8px 0 0' }}>
                Velocidad percibida por usuarios reales:{' '}
                <strong>{CRUX_LABELS[cruxScore] ?? cruxScore}</strong>
              </Text>
            )}
          </Section>

          {/* Issues técnicos */}
          {topIssues.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0 0 12px',
                }}
              >
                Aspectos técnicos monitoreados
              </Text>
              {topIssues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    borderLeft: `3px solid ${SEVERITY_COLORS[issue.severity]}`,
                    padding: '10px 14px',
                    marginBottom: '8px',
                    backgroundColor: '#fafafa',
                    borderRadius: '0 8px 8px 0',
                  }}
                >
                  <Text style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    {issue.title}
                  </Text>
                  <Text style={{ margin: '2px 0 0', fontSize: '12px', color: SEVERITY_COLORS[issue.severity] }}>
                    {SEVERITY_LABELS[issue.severity]}
                  </Text>
                </div>
              ))}
              <Hr style={{ margin: '20px 0', borderColor: '#f3f4f6' }} />
            </>
          )}

          {/* Mejoras aplicadas este mes */}
          {changesApplied && (
            <>
              <Text
                style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0 0 8px',
                }}
              >
                Mejoras aplicadas este mes
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px', whiteSpace: 'pre-line' }}>
                {changesApplied}
              </Text>
            </>
          )}

          {/* Sugerencias de contenido */}
          {contentSuggestions && (
            <>
              <Text
                style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0 0 8px',
                }}
              >
                Sugerencias de contenido
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px', whiteSpace: 'pre-line' }}>
                {contentSuggestions}
              </Text>
            </>
          )}

          <Hr style={{ margin: '24px 0', borderColor: '#f3f4f6' }} />

          {/* Disclaimer */}
          <Text style={{ color: '#9ca3af', fontSize: '12px', lineHeight: '1.5' }}>
            Este reporte refleja el estado técnico de tu sitio ({productionUrl}) y está basado en datos
            de Google PageSpeed Insights. Los factores técnicos de tu sitio están correctamente
            configurados para ser indexado por los motores de búsqueda. No garantizamos posiciones
            específicas en resultados de búsqueda.
          </Text>
          <Text style={{ color: '#d1d5db', fontSize: '12px', margin: '8px 0 0' }}>
            — QUIRICO STUDIOS · {period}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
