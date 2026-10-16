// E13 — Notificación a Xavier: cliente tiene cambios en staging

import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface FeedbackItem {
  section: string;
  status: 'approved' | 'changes';
  comment?: string;
}

interface E13Props {
  clientName: string;
  businessName: string;
  feedback: FeedbackItem[];
  reviewUrl: string;
}

export default function E13RevisionRequestedAdmin({
  clientName, businessName, feedback, reviewUrl,
}: E13Props) {
  const changesItems = feedback.filter((f) => f.status === 'changes');
  const approvedItems = feedback.filter((f) => f.status === 'approved');

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '40px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Feedback de staging — {clientName.split(' ')[0]} ({businessName})
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: '14px' }}>
            {approvedItems.length}/{feedback.length} secciones aprobadas ·{' '}
            <strong>{changesItems.length} cambios solicitados</strong>
          </Text>

          {changesItems.length > 0 && (
            <Section style={{ backgroundColor: '#fff7ed', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #fed7aa' }}>
              {changesItems.map((item, i) => (
                <div key={i} style={{ marginBottom: i < changesItems.length - 1 ? '12px' : 0 }}>
                  <Text style={{ fontWeight: '600', color: '#92400e', fontSize: '13px', marginBottom: '4px' }}>
                    {item.section}
                  </Text>
                  <Text style={{ color: '#78350f', fontSize: '13px', margin: 0 }}>
                    {item.comment}
                  </Text>
                </div>
              ))}
            </Section>
          )}

          <Button
            href={reviewUrl}
            style={{
              backgroundColor: '#111827', color: '#fff', borderRadius: '8px',
              padding: '12px 24px', fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Ver proyecto →
          </Button>

          <Hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            WaaS Admin — Notificación automática de feedback de cliente
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
