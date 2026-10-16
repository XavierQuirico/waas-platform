// E07 — Notificación a Xavier: assets enviados, acción requerida

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E07Props {
  clientName: string;
  businessName: string;
  plan: string;
  reviewUrl: string;
  submittedAt: string;
}

export default function E07AssetsSubmittedAdmin({
  clientName, businessName, plan, reviewUrl, submittedAt,
}: E07Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Acción requerida: nuevos assets de {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            <strong>{clientName}</strong> ({businessName}) envió sus materiales para revisión.
            <br />Plan: <strong>{plan}</strong> · Enviado: {submittedAt}
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px' }}>
            SLA: 24 horas hábiles para revisar y aprobar/rechazar.
          </Text>
          <Button
            href={reviewUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '16px',
            }}
          >
            Revisar assets →
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            WaaS Admin — Sistema de notificaciones internas
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
