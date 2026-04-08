import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/features/shared";
import { AuthProvider } from "@/features/authentication";
import { QueryClientProvider } from "@/features/shared/providers/query-client";
import { Toaster } from "@/features/shared/components/shadcn/sonner";
import { TimelineNav } from "./TimelineNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Timeline",
  description: "Multi domain Web platform with agentic capabilities",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read theme from cookie at request time — no flash on SSR
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('timeline_theme')?.value as 'dark' | 'light' | 'system' | undefined;
  const ssrTheme = themeCookie === 'dark' || themeCookie === 'light' ? themeCookie : undefined;

  return (
    <html lang="en" suppressHydrationWarning className={`h-full overflow-hidden ${ssrTheme ?? ''}`}>
      <head>
        {/* Fallback: resolve theme on first visit (no cookie yet) or system preference */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var el = document.documentElement;
                  if (el.classList.contains('dark') || el.classList.contains('light')) return;
                  var c = document.cookie.match(/(?:^|;)\\s*timeline_theme=([^;]*)/);
                  var theme = (c && c[1]) || 'system';
                  var resolved = theme === 'system'
                    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                  el.classList.add(resolved);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen overflow-hidden`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <QueryClientProvider>
            <ThemeProvider>
              <TimelineNav />
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </ThemeProvider>
          </QueryClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
