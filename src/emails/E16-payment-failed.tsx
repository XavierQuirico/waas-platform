// E16 — Pago fallido: 3 días de gracia para actualizar

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E16Props {
  clientName: string;
  businessName: string;
  gracePeriodEndsAt: string;
  updatePaymentUrl: string;
}

export default function E16PaymentFailed({
  clientName, businessName, gracePeriodEndsAt, updatePaymentUrl,
}: E16Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Hubo un problema con tu pago, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            No pudimos procesar el pago mensual de tu suscripción para{' '}
            <strong>{businessName}</strong>. Tu sitio permanecerá activo
            hasta el <strong>{gracePeriodEndsAt}</strong> (3 días de gracia).
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Si actualizas tu método de pago antes de esa fecha, no habrá interrupción del servicio.
          </Text>
          <Button
            href={updatePaymentUrl}
            style={{
              backgroundColor: '#0070ba', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '16px',
            }}
          >
            Actualizar método de pago →
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Si crees que esto es un error, responde este email. Xavier lo revisará de inmediato.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
