import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Provenance Model Guard — Pre-submission Excel health checks',
  description:
    'Diff-aware lint for financial models. Drop a workbook to see what would break review. MCP-native.',
  openGraph: {
    title: 'Provenance Model Guard',
    description:
      'Pre-submission Excel health checks. Diff-aware. MCP-native.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-base text-text-primary">
        <div className="relative min-h-screen">
          <div className="bg-grid pointer-events-none fixed inset-0 opacity-60" />
          <div className="relative z-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
