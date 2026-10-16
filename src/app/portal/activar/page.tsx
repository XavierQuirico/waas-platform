import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { whatsappUrl } from '@/lib/config/contact';

export default async function PortalActivarPage() {
  const { userId } = await auth();
  if (!userId) redirect('/acceder?redirect_url=%2Fdashboard');

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/30 mb-3">
            QUIRICO STUDIOS
          </p>
          <h1 className="text-2xl font-semibold text-white font-headline">
            No encontramos tu portal todavía
          </h1>
          <p className="mt-3 text-sm text-white/50 font-body leading-relaxed">
            Tu cuenta está activa, pero aún no está vinculada a un cliente de QUIRICO STUDIOS.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1014] p-5 space-y-3">
          <p className="text-sm text-white/60 font-body leading-relaxed">
            Si ya eres cliente, podemos ayudarte a vincular tu acceso.
            Si estás empezando ahora, completa tu perfil para crear tu espacio.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/empezar"
            className="flex w-full items-center justify-center rounded-lg bg-[#d5ff02] px-6 py-3 text-sm font-medium text-black font-headline transition-opacity hover:opacity-90"
          >
            Completar perfil →
          </Link>
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/70 font-headline transition-colors hover:border-white/20 hover:bg-white/[0.07]"
          >
            Contactar a Xavier
          </a>
        </div>

        <p className="text-center text-xs text-white/20 font-body">
          ¿Problema con tu acceso?{' '}
          <a href="mailto:hola@quiricostudios.com" className="underline underline-offset-2 hover:text-white/40">
            Escríbenos
          </a>
        </p>
      </div>
    </div>
  );
}
