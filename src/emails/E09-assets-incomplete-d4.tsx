// E09 — Follow-up assets incompletos día 4

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E09Props {
  clientName: string;
  portalUrl: string;
}

export default function E09AssetsIncompleteD4({ clientName, portalUrl }: E09Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            ¿Pudiste actualizar los materiales, {clientName.split(' ')[0]}?
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Hace unos días te escribí sobre algunos ajustes en tus materiales.
            ¿Tienes algún problema para subir lo que necesito?
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Si tienes dificultades técnicas o no encuentras el archivo, cuéntame
            y buscamos una solución juntos.
          </Text>
          <Button
            href={portalUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '16px',
            }}
          >
            Ir al portal →
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>Xavier — WaaS</Text>
        </Container>
      </Body>
    </Html>
  );
}
