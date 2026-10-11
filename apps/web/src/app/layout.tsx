import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NET/SLET | Platform Foundation',
  description: 'Development foundation for a national NET and regional SET/SLET preparation platform. Not affiliated with exam authorities.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
