import type { Metadata } from 'next';
import './globals.css';
import './observatory.css';

export const metadata: Metadata = {
  title: 'Workspace Observatory',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
