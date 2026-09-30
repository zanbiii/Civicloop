import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import { AppLanguageProvider } from '@/components/AppLanguageProvider';
import TiltEffect from '@/components/TiltEffect';
import RevealOnScroll from '@/components/RevealOnScroll';
import { AppThemeProvider } from '@/components/AppThemeProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Civicloop — Self-Healing Civic Complaint Network',
  description:
    'Agentic AI for smart cities: multimodal civic intake, 75-metre deduplication, self-healing routing, SLA escalation and photo-verified closure.',
  applicationName: 'Civicloop',
};

export const viewport: Viewport = {
  themeColor: '#ece8dc',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('civicloop.theme')==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}",
          }}
        />
        {/*
          Leaflet's stylesheet is loaded from the CDN rather than imported, so the
          map component can stay `ssr: false` without dragging CSS into the server
          bundle. Integrity hash pinned to leaflet 1.9.4.
        */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="scroll-progress" aria-hidden="true" />
        <TiltEffect />
        <RevealOnScroll />
        <AppThemeProvider>
          <AppLanguageProvider>{children}</AppLanguageProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
