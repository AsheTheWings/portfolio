'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface MermaidDiagramProps {
  source: string;
  className?: string;
}

let mermaidInitialised = false;

async function getMermaid() {
  const m = await import('mermaid');
  if (!mermaidInitialised) {
    m.default.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        background: 'transparent',
        primaryColor: '#6d28d9',
        primaryTextColor: '#e4e4e7',
        primaryBorderColor: '#4c1d95',
        lineColor: '#71717a',
        secondaryColor: '#27272a',
        tertiaryColor: '#18181b',
        fontFamily: 'inherit',
        fontSize: '12px',
      },
    });
    mermaidInitialised = true;
  }
  return m.default;
}

export function MermaidDiagram({ source, className = '' }: MermaidDiagramProps) {
  const uid = useId().replace(/:/g, '');
  const containerId = `mermaid-${uid}`;
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState(false);
  const sourceRef = useRef(source);

  useEffect(() => {
    sourceRef.current = source;
    let cancelled = false;

    (async () => {
      try {
        const mermaid = await getMermaid();
        const { svg: rendered } = await mermaid.render(containerId, source);
        if (!cancelled) {
          setSvg(rendered);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [source, containerId]);

  if (error) {
    return (
      <div className={`flex items-center justify-center text-xs text-muted-foreground ${className}`}>
        diagram unavailable
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`[&_svg]:w-full [&_svg]:h-full [&_svg]:max-w-none overflow-hidden ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
