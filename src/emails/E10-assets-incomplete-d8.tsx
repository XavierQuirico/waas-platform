// E10 — Aviso formal día 8 — inactividad + reset de timeline

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E10Props {
  clientName: string;
  businessName: string;
  portalUrl: string;
}

export default function E10AssetsIncompleteD8({ clientName, businessName, portalUrl }: E10Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Aviso importante sobre tu proyecto, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Han pasado 8 días desde que te pedí los ajustes en los materiales de{' '}
            <strong>{businessName}</strong> y aún no los he recibido.
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Tu proyecto está en pausa. El contador de producción de 72 horas
            solo arrancará cuando tengamos los materiales completos y aprobados.
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Si tienes algún inconveniente o necesitas más tiempo, escríbeme directamente.
            Siempre hay solución cuando hay comunicación.
          </Text>
          <Button
            href={portalUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '16px',
            }}
          >
            Actualizar materiales ahora →
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Xavier — WaaS · Si no recibo respuesta en 7 días adicionales,
            el proyecto puede quedar suspendido según los términos de servicio.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
