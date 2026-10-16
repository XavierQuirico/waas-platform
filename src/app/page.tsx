import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// La raíz no tiene contenido propio: dirige a cada persona a su punto de entrada.
export default async function RootPage() {
  const { userId } = await auth();
  redirect(userId ? '/dashboard' : '/empezar');
}
