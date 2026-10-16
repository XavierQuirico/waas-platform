// E01 — Pago confirmado + instrucciones de materiales
// Se envía inmediatamente al confirmar el PayPal order/subscription

import {
  Html, Head, Body, Container, Heading, Text, Button, Hr, Section
} from '@react-email/components';

interface E01Props {
  clientName: string;
  businessName: string;
  plan: string;
  portalUrl: string;
}

export default function E01WelcomePayment({ clientName, businessName, plan, portalUrl }: E01Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            ¡Pago confirmado, {clientName.split(' ')[0]}!
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px' }}>
            Recibimos tu pago para el plan <strong>{plan}</strong> de{' '}
            <strong>{businessName}</strong>. Ya puedes empezar a compartir tus materiales.
          </Text>

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />

          <Section>
            <Text style={{ fontWeight: '600', color: '#111827', fontSize: '15px', marginBottom: '8px' }}>
              ¿Qué sigue?
            </Text>
            <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
              Para que Xavier pueda construir tu sitio, necesita tu logo, fotos del negocio y los textos que irán en el sitio.
              Mientras antes lo compartas, antes empieza el contador de 72 horas.
            </Text>
            <Text style={{ color: '#6b7280', fontSize: '14px', marginTop: '12px', lineHeight: '1.6' }}>
              El trabajo <strong>no puede iniciar</strong> hasta que todos los materiales estén validados —
              esto es para que tu sitio quede con tu imagen real desde el primer día.
            </Text>
          </Section>

          <Button
            href={portalUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '24px',
            }}
          >
            Subir materiales →
          </Button>

          <Hr style={{ margin: '32px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Xavier revisará todo en menos de 24 horas hábiles y te avisará si necesita algo.
            ¿Dudas? Escríbele por WhatsApp.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
