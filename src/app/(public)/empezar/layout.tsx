import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Empieza tu sitio web — QUIRICO STUDIOS',
  description: 'Cuéntanos sobre tu negocio y recibe una propuesta personalizada.',
};

export default function EmpezarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0D0D0D] overflow-hidden">
      {/* Header mínimo con logo real */}
      <header className="relative z-10 border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo/LOGO HORIZONTAL.svg"
            alt="Quirico Studios"
            className="h-5 w-auto opacity-60"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>
      </header>

      {/* Contenedor flotante centrado */}
      <main className="relative z-10 flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-white/[0.08] bg-[#1C1C1A] px-5 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)] sm:px-8 sm:py-9">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
