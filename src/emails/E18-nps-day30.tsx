// E18 — NPS día 30 post-lanzamiento

import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

interface E18Props {
  clientName: string;
  businessName: string;
  siteUrl: string;
  reviewFormUrl?: string;
}

export default function E18NpsDay30({ clientName, businessName, reviewFormUrl }: E18Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Un mes con tu sitio en vivo 🎯
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            {clientName.split(' ')[0]}, ya pasó un mes desde que <strong>{businessName}</strong>{' '}
            salió en vivo. Esperamos que el sitio te esté generando resultados.
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            ¿Nos dejarías una reseña rápida? Tu opinión ayuda a que otros negocios
            como el tuyo conozcan WaaS y tomen una decisión informada.
          </Text>

          {reviewFormUrl && (
            <Button
              href={reviewFormUrl}
              style={{
                backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
                padding: '12px 24px', fontSize: '14px', fontWeight: '600',
                textDecoration: 'none', display: 'inline-block', marginTop: '16px',
              }}
            >
              Dejar reseña (2 min) →
            </Button>
          )}

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Xavier — WaaS · ¿Necesitas actualizar algo del sitio o agregar funcionalidades?
            Escríbeme directamente.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
