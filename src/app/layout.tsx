import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import './fonts.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'QUIRICO STUDIOS — Tu sitio web profesional',
  description: 'Sitios web profesionales a medida, con diseño, hosting y soporte incluidos.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        className="dark"
        style={{ colorScheme: 'dark' }}
        suppressHydrationWarning
      >
        <body suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Analytics />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
