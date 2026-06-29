import type { Metadata } from 'next';
import { User } from 'lucide-react';
import styles from './protos.module.css';

export const metadata: Metadata = {
  title: 'Protos',
};

/**
 * A placeholder avatar wrapped in a glass tube ring drawn entirely with SVG.
 *
 * The tube is a stroked circle shaded with a vertical gradient (bright top,
 * translucent middle, darker bottom) to read as round glass, plus two blurred
 * white specular arcs. The orbiting light is a short dashed arc on the tube's
 * centerline whose `stroke-dashoffset` is animated for a full revolution.
 *
 * @param beam - When true, render the orbiting light beam around the tube.
 * @returns The composed glass-ring avatar.
 */
function GlassAvatar({ beam }: { beam: boolean }) {
  // Unique def ids per instance so the two SVGs on the page don't collide.
  const uid = beam ? 'b' : 'p';
  const bodyId = `glassBody-${uid}`;
  const blurId = `blur-${uid}`;
  const glowId = `glow-${uid}`;

  return (
    <div className={styles.stage}>
      <svg
        className={styles.svg}
        viewBox="0 0 200 200"
        role="img"
        aria-label="Glass tube ring"
      >
        <defs>
          <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="38%" stopColor="#d7dbe3" stopOpacity="0.18" />
            <stop offset="64%" stopColor="#aab2bf" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6f7a89" stopOpacity="0.42" />
          </linearGradient>
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        {/* Glass tube: outer/inner contour lines + gradient-shaded body. */}
        <circle cx="100" cy="100" r="76" fill="none" stroke="rgba(20,24,30,0.10)" strokeWidth="1" />
        <circle cx="100" cy="100" r="64" fill="none" stroke="rgba(20,24,30,0.10)" strokeWidth="1" />
        <circle cx="100" cy="100" r="70" fill="none" stroke={`url(#${bodyId})`} strokeWidth="12" />

        {/* Specular highlights (blurred white arcs). */}
        <circle
          cx="100"
          cy="100"
          r="73"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.85"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={360}
          strokeDasharray="58 302"
          transform="rotate(-125 100 100)"
          filter={`url(#${blurId})`}
        />
        <circle
          cx="100"
          cy="100"
          r="67"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="1.6"
          strokeLinecap="round"
          pathLength={360}
          strokeDasharray="26 334"
          transform="rotate(42 100 100)"
          filter={`url(#${blurId})`}
        />

        {/* Orbiting light: wide soft glow + bright core, animated via CSS. */}
        {beam && (
          <>
            <circle
              className={styles.beamGlow}
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="#5ab0ff"
              strokeOpacity="0.55"
              strokeWidth="11"
              strokeLinecap="round"
              pathLength={360}
              strokeDasharray="26 334"
              filter={`url(#${glowId})`}
            />
            <circle
              className={styles.beam}
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="#eaf6ff"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={360}
              strokeDasharray="12 348"
              filter={`url(#${blurId})`}
            />
          </>
        )}
      </svg>

      <div
        className={styles.avatar}
        role="img"
        aria-label="Profile picture doesn't exist"
        title="Profile picture doesn't exist"
      >
        <User size="40%" strokeWidth={1.5} />
      </div>
    </div>
  );
}

/**
 * Render the Protos app route.
 *
 * Intentionally not linked from the Portfolio home launcher or any navigation,
 * so the page is reachable only via its direct URL.
 *
 * Shows two SVG glass-tube avatars side by side: one with the circulating light
 * beam and one without, for comparison.
 *
 * @returns A light page with the two glass-tube avatars centered.
 */
export default function ProtosPage() {
  return (
    <main className="flex min-h-dvh flex-wrap items-center justify-center gap-12 bg-[#f3f3f3] p-6 text-black">
      <GlassAvatar beam />
      <GlassAvatar beam={false} />
    </main>
  );
}
