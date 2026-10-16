// E08 — Assets incompletos: qué falta + link al portal (Día 1)

import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface E08Props {
  clientName: string;
  rejectedAssets: { label: string; comment: string }[];
  portalUrl: string;
}

export default function E08AssetsIncomplete({ clientName, rejectedAssets, portalUrl }: E08Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Necesito un ajuste en tus materiales, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Revisé tus materiales y necesito que actualices lo siguiente antes de continuar:
          </Text>

          <Section style={{ backgroundColor: '#fff7ed', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #fed7aa' }}>
            {rejectedAssets.map((a, i) => (
              <div key={i} style={{ marginBottom: i < rejectedAssets.length - 1 ? '12px' : 0 }}>
                <Text style={{ fontWeight: '600', color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>
                  {a.label}
                </Text>
                <Text style={{ color: '#78350f', fontSize: '13px', margin: 0 }}>{a.comment}</Text>
              </div>
            ))}
          </Section>

          <Button
            href={portalUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Actualizar materiales →
          </Button>

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            Una vez que actualices estos materiales, Xavier los revisará en menos de 24 horas.
            ¿Tienes dudas? Responde este email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
