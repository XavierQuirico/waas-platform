// E03 — Propuesta lista para revisar
// Se envía cuando Xavier hace clic en "Enviar propuesta" (DRAFT → PROPOSAL_SENT)

import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface E03Props {
  clientName: string;
  businessName: string;
  plan: string;
  monthlyPrice: number;
  setupFee: number;
  personalNote?: string;
  proposalExpiresAt: string; // Fecha localizada
  paypalLink?: string;
}

export default function E03ProposalSent({
  clientName, businessName, plan, monthlyPrice, setupFee,
  personalNote, proposalExpiresAt, paypalLink,
}: E03Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Tu propuesta está lista, {clientName.split(' ')[0]}
          </Heading>

          {personalNote && (
            <Section style={{ backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <Text style={{ color: '#374151', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>
                &quot;{personalNote}&quot;
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>— Xavier</Text>
            </Section>
          )}

          <Section style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <Text style={{ fontWeight: '600', color: '#111827', fontSize: '14px', marginBottom: '8px' }}>
              {businessName} — Plan {plan}
            </Text>
            <Text style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
              Setup: <strong>${setupFee} USD</strong> (único)
            </Text>
            <Text style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
              Mensual: <strong>${monthlyPrice} USD/mes</strong>
            </Text>
          </Section>

          {paypalLink && (
            <Button
              href={paypalLink}
              style={{
                backgroundColor: '#0070ba', color: '#fff', borderRadius: '8px',
                padding: '12px 24px', fontSize: '14px', fontWeight: '600',
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              Pagar con PayPal →
            </Button>
          )}

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Esta propuesta es válida hasta el <strong>{proposalExpiresAt}</strong>.
            ¿Preguntas? Responde este email o escríbele a Xavier por WhatsApp.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
