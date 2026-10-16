// E17 — NPS check-in día 7 post-lanzamiento

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E17Props {
  clientName: string;
  businessName: string;
  siteUrl: string;
}

export default function E17NpsDay7({ clientName, businessName, siteUrl }: E17Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            ¿Cómo va todo con tu sitio, {clientName.split(' ')[0]}?
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Han pasado 7 días desde que <strong>{businessName}</strong> salió en vivo.
            ¿Cómo ha sido la experiencia hasta ahora?
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Si algo no está funcionando como esperabas, o si tienes nuevas ideas para el sitio,
            responde este email directamente.
          </Text>
          <Button
            href={siteUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '16px',
            }}
          >
            Ver tu sitio →
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Xavier — WaaS · ¿Conoces a alguien que también necesite un sitio profesional?
            Puedes referirlo directamente a hola@quiricostudios.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
