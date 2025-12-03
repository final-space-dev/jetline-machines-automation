import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const font = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'Machine Data Loader',
  description: 'Iterate Jetline entities, capture meter data, and export results.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
