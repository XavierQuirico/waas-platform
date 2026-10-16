// E21 — Reporte SEO mensual para Xavier (con magic link de aprobación)
// Trigger: Inngest cron mensual (1er lunes de cada mes, 10am AST)
// El administrador revisa, aplica los ajustes técnicos y aprueba antes de enviar al cliente

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
} from '@react-email/components';

interface E21Props {
  clientName: string;
  businessName: string;
  productionUrl: string;
  period: string;               // Ej: "junio 2026"
  currentScore: number | null;
  previousScore: number | null;
  cruxScore: string | null;     // 'FAST' | 'MODERATE' | 'SLOW' | null
  topIssues: Array<{ id: string; title: string; severity: 'high' | 'medium' | 'low' }>;
  approvalUrl: string;          // /admin/seo/approve/[token]
  expiresAt: string;            // Fecha legible de expiración del token
}

const CRUX_LABELS: Record<string, string> = {
  FAST: '🟢 Rápido',
  MODERATE: '🟡 Moderado',
  SLOW: '🔴 Lento',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

function scoreColor(score: number | null): string {
  if (score === null) return '#6b7280';
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

function scoreDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return '';
  const delta = current - previous;
  if (delta > 0) return ` (+${delta})`;
  if (delta < 0) return ` (${delta})`;
  return ' (sin cambio)';
}

export default function E21SeoReportAdmin({
  clientName,
  businessName,
  productionUrl,
  period,
  currentScore,
  previousScore,
  cruxScore,
  topIssues,
  approvalUrl,
  expiresAt,
}: E21Props) {
  const firstName = clientName.split(' ')[0];

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
          <div
            style={{
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '24px',
              display: 'inline-block',
            }}
          >
            <Text style={{ color: '#166534', fontSize: '13px', fontWeight: '600', margin: 0 }}>
              📊 Reporte SEO mensual — acción requerida
            </Text>
          </div>

          <Heading
            style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}
          >
            Salud Técnica SEO — {businessName}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>
            {firstName} · {period} · {productionUrl}
          </Text>

          {/* Scores */}
          <Section
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '16px 20px',
              marginBottom: '20px',
            }}
          >
            <Text style={{ color: '#374151', fontSize: '13px', fontWeight: '600', margin: '0 0 8px' }}>
              Score Lighthouse (laboratorio)
            </Text>
            <Text
              style={{
                fontSize: '36px',
                fontWeight: '800',
                color: scoreColor(currentScore),
                margin: '0',
                lineHeight: '1',
              }}
            >
              {currentScore !== null ? currentScore : '—'}
              <span style={{ fontSize: '14px', fontWeight: '400', color: '#6b7280' }}>
                {scoreDelta(currentScore, previousScore)}
              </span>
            </Text>
            {cruxScore && (
              <Text style={{ color: '#374151', fontSize: '13px', margin: '8px 0 0' }}>
                Velocidad real de usuarios: {CRUX_LABELS[cruxScore] ?? cruxScore}
              </Text>
            )}
          </Section>

          {/* Top Issues */}
          {topIssues.length > 0 && (
            <>
              <Text
                style={{ color: '#374151', fontSize: '14px', fontWeight: '600', margin: '0 0 8px' }}
              >
                Issues técnicos principales
              </Text>
              {topIssues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    borderLeft: `3px solid ${SEVERITY_COLORS[issue.severity]}`,
                    padding: '8px 12px',
                    marginBottom: '8px',
                    backgroundColor: '#fafafa',
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  <Text style={{ margin: 0, fontSize: '13px', color: '#111827' }}>
                    {issue.title}
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: SEVERITY_COLORS[issue.severity],
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}
                    >
                      {issue.severity}
                    </span>
                  </Text>
                </div>
              ))}
            </>
          )}

          <Hr style={{ margin: '24px 0', borderColor: '#f3f4f6' }} />

          {/* Acción */}
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>
            Aplica los ajustes técnicos y luego confirma el envío al cliente desde
            la página de aprobación. El enlace expira el <strong>{expiresAt}</strong>.
          </Text>

          <Button
            href={approvalUrl}
            style={{
              backgroundColor: '#111827',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'inline-block',
              marginTop: '4px',
            }}
          >
            Aprobar y enviar al cliente →
          </Button>

          <Hr style={{ margin: '28px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            — Sistema WaaS · Reporte generado automáticamente
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
