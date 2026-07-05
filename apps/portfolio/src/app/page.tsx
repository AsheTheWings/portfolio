import Link from 'next/link';
import { Crown, Cpu } from 'lucide-react';
import IconAiLab02 from '@portfolio/ui/icons/IconAiLab';

const apps = [
  {
    href: '/apps/timeline',
    title: 'Timeline',
    description: 'Agent workspace with sessions, tools, workflows, and library context.',
    icon: <IconAiLab02 size="28" />,
  },
  {
    href: '/apps/chess',
    title: 'Chess',
    description: 'Full-screen chess board and Stockfish-backed analysis surface.',
    icon: <Crown size="28" />,
  },
  {
    href: '/apps/n8n',
    title: 'n8n Automation',
    description: 'Automate tasks, connect external triggers, and run workflows on Timeline sessions.',
    icon: <Cpu size="28" />,
  },
];

/**
 * Render the Portfolio app launcher.
 *
 * @returns Minimal landing page that links to hosted applications.
 */
export default function PortfolioHome() {
  return (
    <main className="min-h-dvh overflow-auto bg-background p-6 text-foreground lg:p-10">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl flex-col justify-center">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">Portfolio</p>
          <h1 className="text-4xl font-semibold tracking-tight lg:text-6xl">Choose an app.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A single shell for Timeline, Chess, and future tools.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-depth-sm transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-border hover:shadow-depth-lg"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-foreground transition-transform group-hover:scale-105">
                {app.icon}
              </div>
              <h2 className="text-xl font-semibold">{app.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{app.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
