import { ClerkProvider, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AdminNavClient } from '@/components/admin/AdminNavClient';
import { AdminShell } from '@/components/admin/AdminShell';
import { FloatingActionsClient } from '@/components/admin/FloatingActionsClient';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getHostContext } from '@/lib/routing/host-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ userId }, hdrs] = await Promise.all([auth(), headers()]);
  const useCleanRoutes = getHostContext(hdrs.get('host') ?? '') === 'admin';

  // Middleware handles unauthenticated case, but this is a safety fallback
  if (!userId) {
    redirect('/acceder?context=admin');
  }

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  const isEnvAdmin = userId === process.env.ADMIN_CLERK_USER_ID;

  // Authenticated but not authorized → show access denied (don't redirect to login)
  if (!admin && !isEnvAdmin) {
    return (
      <ClerkProvider>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg, #0A0B0D)',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
            <p
              style={{
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 10,
                color: 'var(--text-3, rgba(249,249,249,0.35))',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              QUIRICO STUDIOS · PANEL INTERNO
            </p>
            <h1
              style={{
                fontFamily: "'Clash Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--text, #f9f9f9)',
                letterSpacing: '-0.02em',
                marginBottom: 12,
              }}
            >
              Acceso no disponible
            </h1>
            <p
              style={{
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: 'var(--text-2, rgba(249,249,249,0.6))',
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              Tu cuenta no tiene permisos para acceder al panel de administración.
              Contacta a Xavier si crees que esto es un error.
            </p>
            <UserButton afterSignOutUrl="/acceder?context=admin" />
          </div>
        </div>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider>
      <FloatingActionsClient unreadCount={0} />
      <AdminShell sidebar={<AdminNavClient useCleanRoutes={useCleanRoutes} />}>
        {children}
      </AdminShell>
    </ClerkProvider>
  );
}
