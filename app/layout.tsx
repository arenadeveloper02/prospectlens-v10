import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import './chat-polish.css';
import './console-polish.css';
import './history-polish.css';
import './button-theme.css';
import './agent-ui.css';
import { ArenaEmailProvider } from '@/components/arena-email-provider';
import { AppShell } from '@/components/AppShell';
import { getArenaEmailId } from '@/lib/arena-email';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Prospect Lens',
  description:
    'Find leadership contacts, then enrich verified emails for the people you choose.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const emailId = await getArenaEmailId();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ArenaEmailProvider emailId={emailId}>
          {emailId ? (
            <div className="console-shell">
              <AppShell>{children}</AppShell>
            </div>
          ) : (
            children
          )}
        </ArenaEmailProvider>
      </body>
    </html>
  );
}
