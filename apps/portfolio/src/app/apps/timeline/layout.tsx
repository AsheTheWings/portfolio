import { TimelineNav } from '@portfolio/timeline/components/TimelineNav';

export default function TimelineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TimelineNav />
      {children}
    </>
  );
}
