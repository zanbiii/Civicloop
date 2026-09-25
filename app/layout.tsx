import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Civicloop — Self-Healing Civic Complaint Network',
  description:
    'Agentic AI for smart cities: multimodal civic intake, 75-metre deduplication, self-healing routing, SLA escalation and photo-verified closure.',
  applicationName: 'Civicloop',
};

export const viewport: Viewport = {
  themeColor: '#f4f7f6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
