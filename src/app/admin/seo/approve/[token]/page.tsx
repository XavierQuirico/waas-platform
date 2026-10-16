import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { seoApprovalTokens } from '@/db/schema/seo-approval-tokens';
import { ApprovalForm } from './ApprovalForm';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SeoApprovalPage({ params }: Props) {
  const { token } = await params;
  const now = new Date();

  const [tokenRecord] = await db
    .select()
    .from(seoApprovalTokens)
    .where(
      and(
        eq(seoApprovalTokens.token, token),
        isNull(seoApprovalTokens.usedAt),
        gt(seoApprovalTokens.expiresAt, now)
      )
    )
    .limit(1);

  if (!tokenRecord || !tokenRecord.reportData) {
    return (
      <div style={{ maxWidth: 540, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
          QUIRICO STUDIOS · SEO
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
          Enlace no válido
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          Este enlace de aprobación expiró o ya fue usado. Si necesitas reenviar un reporte,
          espera al próximo ciclo mensual.
        </p>
      </div>
    );
  }

  return (
    <ApprovalForm
      token={token}
      report={tokenRecord.reportData}
      expiresAt={tokenRecord.expiresAt.toISOString()}
    />
  );
}
