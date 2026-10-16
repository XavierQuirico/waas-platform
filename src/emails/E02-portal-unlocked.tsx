// E02 — Portal desbloqueado (Inngest +30min post E01)
// Enviado automáticamente 30 minutos después del pago, con link al portal

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E02Props {
  clientName: string;
  portalUrl: string;
}

export default function E02PortalUnlocked({ clientName, portalUrl }: E02Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Tu portal está listo, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Ya puedes acceder a tu portal personal para subir tus materiales.
            El proceso es sencillo: logo, fotos y textos. Xavier hace el resto.
          </Text>
          <Button
            href={portalUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '24px',
            }}
          >
            Ir al portal →
          </Button>
          <Hr style={{ margin: '32px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            El acceso es con tu correo electrónico. Si necesitas ayuda para ingresar, responde este email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
