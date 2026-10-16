// E14 — Sitio en vivo: confirmación + instrucciones de DNS

import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface E14Props {
  clientName: string;
  businessName: string;
  productionUrl: string;
  domainTarget?: string;
}

export default function E14LiveConfirmation({
  clientName, businessName, productionUrl, domainTarget,
}: E14Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            🎉 ¡{businessName} está en vivo!
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Felicidades, {clientName.split(' ')[0]}. Tu sitio ya está publicado y funcionando.
          </Text>

          <Button
            href={productionUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '15px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block', marginTop: '8px',
            }}
          >
            Ver tu sitio en vivo →
          </Button>

          {domainTarget && (
            <Section style={{ backgroundColor: '#f0f9ff', borderRadius: '8px', padding: '16px', margin: '24px 0', border: '1px solid #bae6fd' }}>
              <Text style={{ fontWeight: '600', color: '#0369a1', fontSize: '14px', marginBottom: '8px' }}>
                Configuración de dominio
              </Text>
              <Text style={{ color: '#0c4a6e', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                Si tienes el dominio <strong>{domainTarget}</strong>, Xavier te enviará
                las instrucciones de DNS para apuntarlo a tu sitio.
                El cambio puede tardar hasta 48 horas en propagarse.
              </Text>
            </Section>
          )}

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Tu suscripción mensual está activa. Si necesitas cambios o tienes alguna pregunta,
            escríbele a Xavier. Gracias por confiar en WaaS.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
