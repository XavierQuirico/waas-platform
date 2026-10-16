// E11 — Producción iniciada: countdown arranca, fecha estimada

import { Html, Head, Body, Container, Heading, Text, Hr, Section } from '@react-email/components';

interface E11Props {
  clientName: string;
  businessName: string;
  deadline: string; // Fecha localizada: "jueves 26 de marzo"
}

export default function E11ProductionStarted({ clientName, businessName, deadline }: E11Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Tu sitio está en producción, {clientName.split(' ')[0]}
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
            Los materiales de <strong>{businessName}</strong> están aprobados y Xavier ya empezó a construir tu sitio.
          </Text>

          <Section style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #bbf7d0' }}>
            <Text style={{ fontWeight: '600', color: '#166534', fontSize: '15px', marginBottom: '4px' }}>
              Fecha estimada de entrega
            </Text>
            <Text style={{ color: '#15803d', fontSize: '22px', fontWeight: '700', margin: 0 }}>
              {deadline}
            </Text>
            <Text style={{ color: '#4ade80', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
              72 horas hábiles desde hoy (lun–vie, 9am–6pm RD)
            </Text>
          </Section>

          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Cuando el sitio esté listo, recibirás un link para revisarlo antes de que salga en vivo.
            No necesitas hacer nada más por ahora.
          </Text>

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            ¿Tienes alguna duda mientras tanto? Responde este email o escríbele a Xavier por WhatsApp.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
