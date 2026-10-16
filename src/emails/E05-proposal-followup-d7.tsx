// E05 — Follow-up propuesta día 7, último aviso antes de vencer

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E05Props {
  clientName: string;
  paypalLink?: string;
  expiresAt: string;
}

export default function E05ProposalFollowupD7({ clientName, paypalLink, expiresAt }: E05Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            La propuesta vence mañana, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            La propuesta personalizada que preparé para ti vence el <strong>{expiresAt}</strong>.
            Después de esa fecha, el precio y los términos quedarán sujetos a revisión.
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Si tienes alguna duda, responde este email o escríbeme por WhatsApp.
            Estoy disponible para aclarar cualquier cosa antes de que tomes una decisión.
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
              Confirmar propuesta →
            </Button>
          )}
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>Xavier — WaaS</Text>
        </Container>
      </Body>
    </Html>
  );
}
