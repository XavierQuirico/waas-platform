// E15 — SLA warning a Xavier: 12 horas para cumplir deadline (uso interno)

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E15Props {
  clientName: string;
  businessName: string;
  deadline: string;
  hoursLeft: number;
  reviewUrl: string;
}

export default function E15SlaWarningAdmin({
  clientName, businessName, deadline, hoursLeft, reviewUrl,
}: E15Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#fef2f2', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px', border: '2px solid #fca5a5' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#991b1b', marginBottom: '8px' }}>
            ⚠ SLA en riesgo — {hoursLeft}h restantes
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            <strong>{clientName}</strong> ({businessName}) tiene un deadline el{' '}
            <strong>{deadline}</strong>.
          </Text>
          <Text style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>
            Quedan {hoursLeft} horas hábiles para entregar.
          </Text>
          <Button
            href={reviewUrl}
            style={{
              backgroundColor: '#dc2626', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '16px',
            }}
          >
            Ver proyecto ahora →
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#fca5a5' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            WaaS Admin — Alerta automática de SLA (uso interno)
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
