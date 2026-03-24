'use client';

/**
 * SystemCall Component
 * Renders system tool proposals (state updates, etc.)
 * User feedback is handled by dedicated user-feedback component
 */

interface SystemCallProps {
  data: {
    arguments?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export function SystemCall({ data }: SystemCallProps) {
  const args = data.arguments as Record<string, any> | undefined;
  
  // Extract state key and value from tool arguments
  const stateKey = args ? Object.keys(args)[0] || '' : '';
  const content = args ? String(args[stateKey] || '') : '';
  
  return (
    <div className="session-component flex justify-start">
      <div className="max-w-[80%] rounded-lg p-4 bg-muted border border-border text-foreground">
        {/* Header */}
        <div className="text-xs font-medium mb-2 opacity-70">
          {stateKey} Proposal
        </div>
        
        {/* Content */}
        <div className="text-sm whitespace-pre-wrap break-words font-mono">
          {content}
        </div>
      </div>
    </div>
  );
}

export default SystemCall;
