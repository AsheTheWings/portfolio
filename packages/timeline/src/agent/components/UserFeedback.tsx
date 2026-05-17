'use client';

/**
 * UserFeedback Component
 * Renders user feedback in a message bubble
 * Used by both SystemCall and AgentJob components
 */

interface UserFeedbackProps {
  feedback: string;
  mono?: boolean;  // Whether to use monospace font (default: false)
}

export function UserFeedback({ feedback, mono = false }: UserFeedbackProps) {
  return (
    <div className="session-component flex justify-end">
      <div className="max-w-[80%] rounded-lg p-4 bg-primary text-primary-foreground">
        <div className="text-xs font-medium mb-2 opacity-70">
          Your Feedback
        </div>
        
        <div className={`text-sm whitespace-pre-wrap break-words ${mono ? 'font-mono' : ''}`}>
          {feedback}
        </div>
      </div>
    </div>
  );
}
