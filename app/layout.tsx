import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'חדר המלחמה',
  description: 'מפת מצב חיה: טיסות, חדשות, אירועים, לוויינים וספינות — המזרח התיכון',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#06080b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
