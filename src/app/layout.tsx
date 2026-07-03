import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vibe | Elite Vision Engine',
  description: 'High-performance gesture-driven AR interaction system powered by MediaPipe and Next.js.',
  keywords: ['AI', 'Computer Vision', 'AR', 'Hand Tracking', 'Edge Compute'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#020408] text-[#f4f7fb] overflow-hidden antialiased" suppressHydrationWarning>
        <div className="grain-overlay" />
        <div className="mesh-grid" />
        {children}
      </body>
    </html>
  );
}
