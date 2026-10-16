// E06 — Confirmación de recepción de assets al cliente

import { Html, Head, Body, Container, Heading, Text, Hr } from '@react-email/components';

interface E06Props {
  clientName: string;
  businessName: string;
}

export default function E06AssetsSubmittedClient({ clientName, businessName }: E06Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            ✓ Materiales recibidos, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Xavier ya recibió todos tus materiales para <strong>{businessName}</strong>.
            Los revisará en las próximas 24 horas hábiles.
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Si necesita algo adicional, te escribirá directamente.
            De lo contrario, recibirás una notificación cuando comience la producción.
          </Text>
          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            No necesitas hacer nada más por ahora. Xavier te mantiene al tanto.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
