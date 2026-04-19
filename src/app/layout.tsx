import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'H1 Connect',
  description: 'Health1 CRM Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
