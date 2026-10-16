// E04 — Follow-up propuesta día 3 (Inngest scheduled)

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E04Props {
  clientName: string;
  businessName: string;
  paypalLink?: string;
  expiresAt: string;
}

export default function E04ProposalFollowupD3({ clientName, businessName, paypalLink, expiresAt }: E04Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            ¿Pudiste revisar la propuesta, {clientName.split(' ')[0]}?
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Te envié la propuesta para <strong>{businessName}</strong> hace unos días.
            ¿Tienes alguna pregunta antes de avanzar?
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            La propuesta vence el <strong>{expiresAt}</strong>. Si necesitas algo,
            responde este email directamente.
          </Text>
          {paypalLink && (
            <Button
              href={paypalLink}
              style={{
                backgroundColor: '#0070ba', color: '#fff', borderRadius: '8px',
                padding: '12px 24px', fontSize: '14px', fontWeight: '600',
                textDecoration: 'none', display: 'inline-block', marginTop: '16px',
              }}
            >
              Ver propuesta y pagar →
            </Button>
          )}
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>Xavier — WaaS</Text>
        </Container>
      </Body>
    </Html>
  );
}
