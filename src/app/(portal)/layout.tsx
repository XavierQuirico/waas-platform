import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getPortalShellData } from '@/lib/portal/context';
import { PortalClientLayout } from './components/PortalClientLayout';

export const metadata: Metadata = {
  title: 'Mi portal — Quirico Studios',
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get('qs-portal-theme')?.value;
  const theme: 'dark' | 'light' = rawTheme === 'light' ? 'light' : 'dark';

  const shellData = await getPortalShellData();
  const clientFirstName = shellData.client.fullName.split(' ')[0];
  const hasProject = shellData.project !== null;
  const projectType = shellData.project?.projectType ?? 'SUBSCRIPTION';
  const projectId = shellData.project?.id ?? null;

  return (
    <PortalClientLayout
      clientFirstName={clientFirstName}
      clientFullName={shellData.client.fullName}
      isPreviewMode={shellData.isPreviewMode}
      theme={theme}
      hasProject={hasProject}
      projectType={projectType}
      projectId={projectId}
    >
      {children}
    </PortalClientLayout>
  );
}
