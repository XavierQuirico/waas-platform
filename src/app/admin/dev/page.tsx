// Panel de testing — SOLO en NODE_ENV=development
// Permite simular cualquier escenario como admin o cliente

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DevTools } from './components/DevTools';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID!;

export default async function DevPanelPage() {
  // Guard: solo en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Panel de desarrollo no disponible en producción.</p>
      </div>
    );
  }

  const { userId } = await auth();
  if (!userId || userId !== ADMIN_CLERK_USER_ID) redirect('/acceder?context=admin&redirect_url=/dev');

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Panel de Testing</h1>
        <span className="rounded-full bg-yellow-100 px-3 py-0.5 text-xs font-medium text-yellow-800">
          Solo desarrollo
        </span>
      </div>
      <DevTools />
    </div>
  );
}
