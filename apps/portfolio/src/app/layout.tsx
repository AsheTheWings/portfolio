import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@portfolio/ui";
import { AuthProvider } from "@portfolio/auth";
import { verifyToken } from "@portfolio/auth/lib/cookies";
import { QueryClientProvider } from "@portfolio/ui/providers/query-client";
import { Toaster } from "@portfolio/ui/components/shadcn/sonner";
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
  title: "Portfolio",
  description: "Application launcher for Timeline, Chess, and future tools.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, payload] = await Promise.all([cookies(), verifyToken()]);
  const themeCookie = cookieStore.get('portfolio_theme')?.value as 'dark' | 'light' | 'system' | undefined;
  const ssrTheme = themeCookie === 'dark' || themeCookie === 'light' ? themeCookie : undefined;
  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  return (
    <html lang="en" suppressHydrationWarning className={`h-full overflow-hidden ${ssrTheme ?? ''}`}>
      <head>
        {/* Resolve system preference before paint when the cookie does not contain a concrete theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var el = document.documentElement;
                  el.classList.remove('dark', 'light');
                  var c = document.cookie.match(/(?:^|;)\\s*portfolio_theme=([^;]*)/);
                  var theme = c ? decodeURIComponent(c[1]) : 'system';
                  var resolved = theme === 'dark' || theme === 'light'
                    ? theme
                    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
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
        <AuthProvider initialUser={initialUser}>
          <QueryClientProvider>
            <ThemeProvider>
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </ThemeProvider>
          </QueryClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
