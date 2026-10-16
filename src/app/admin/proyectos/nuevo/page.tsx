import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminHref, getHostContext } from '@/lib/routing/host-context';

export default async function NuevoProyectoPage() {
  const hdrs = await headers();
  const hostCtx = getHostContext(hdrs.get('host') ?? '');
  redirect(adminHref('/admin/proyectos', hostCtx));
}
