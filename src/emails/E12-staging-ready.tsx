// E12 — Staging listo: link + instrucciones de feedback

import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface E12Props {
  clientName: string;
  businessName: string;
  stagingUrl: string;
  feedbackUrl: string;
  reviewDeadline: string;
}

export default function E12StagingReady({
  clientName, businessName, stagingUrl, feedbackUrl, reviewDeadline,
}: E12Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Tu sitio está listo para revisión, {clientName.split(' ')[0]}!
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            <strong>{businessName}</strong> ya tiene un preview funcionando.
            Revísalo y cuéntanos lo que piensas.
          </Text>

          <Button
            href={stagingUrl}
            style={{
              backgroundColor: '#2563eb', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Ver preview del sitio →
          </Button>

          <Section style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '24px 0', border: '1px solid #e5e7eb' }}>
            <Text style={{ fontWeight: '600', color: '#374151', fontSize: '14px', marginBottom: '8px' }}>
              ¿Cómo enviar tu feedback?
            </Text>
            <Text style={{ color: '#6b7280', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
              1. Abre el preview en otra pestaña{'\n'}
              2. Revisa cada sección{'\n'}
              3. Marca ✓ lo que está bien o explica qué necesita cambio{'\n'}
              4. Envía el formulario — Xavier lo recibe en segundos
            </Text>
          </Section>

          <Button
            href={feedbackUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Enviar feedback estructurado →
          </Button>

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Tienes hasta el <strong>{reviewDeadline}</strong> (72 horas hábiles) para enviarnos tu feedback.
            Si apruebas el sitio tal como está, tu dominio quedará configurado en menos de 24 horas.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
