'use client';

/**
 * InteractionArea Component
 * Self-contained interaction handler
 * - Displays MessageInput and FeedbackPanel
 * - Delegates business logic to useUserInput hook
 * - Animated transitions with Framer Motion
 */

import { MessageInput, MessageInputRef } from './MessageInput';
import { FeedbackPanel } from './FeedbackPanel';
import { forwardRef, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAgent } from '../contexts/AgentContext';
import { useUserInput } from '../hooks/useUserInput';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface InteractionAreaProps {}

export const InteractionArea = forwardRef<MessageInputRef, InteractionAreaProps>(
  ({}, ref) => {
    // Get state from store
    const { activeFeedbackRequest, submitTrigger, userMessagesHistory, stopAgent, resumeAgent, conversationStatus } = useAgent();
    
    // Derive processing states from conversationStatus
    const isProcessing = conversationStatus === 'processing' || conversationStatus === 'thinking' || conversationStatus === 'toolCalling' || conversationStatus === 'responding';
    const isThinking = conversationStatus === 'thinking';
    const isToolCalling = conversationStatus === 'toolCalling';
    const isResponding = conversationStatus === 'responding';
    
    // Disable input if processing or hanging input (user message pending)
    const isInputDisabled = isProcessing || conversationStatus === 'hangingInput';
    
    // Use consolidated user input handler
    const { submitUserInput, submitAction, isFeedbackMode } = useUserInput();

    const lastSubmitTriggerRef = useRef(0);
    
    // History navigation state
    const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means not navigating
    const [draftMessage, setDraftMessage] = useState<string>(''); // Save current input when starting navigation
    const [isMentionOpen, setIsMentionOpen] = useState(false);

    /**
     * Watch submit trigger and focus input (from global keyboard shortcuts)
     */
    useEffect(() => {
      if (submitTrigger && submitTrigger !== lastSubmitTriggerRef.current) {
        lastSubmitTriggerRef.current = submitTrigger;
        // Focus the input to allow user to type
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.focus();
        }
      }
    }, [submitTrigger, ref]);
    
    /**
     * History navigation with arrow keys (up/down)
     * Disabled when mention search is open
     */
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (isProcessing) return;
        
        // Disable history navigation when mention search is open
        if (isMentionOpen) return;
        
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          
          if (userMessagesHistory.length === 0) return;
          
          // First time pressing up: save current draft and start navigation
          if (historyIndex === -1) {
            const currentValue = ref && typeof ref !== 'function' && ref.current ? ref.current.getValue() : '';
            setDraftMessage(currentValue);
            setHistoryIndex(0);
            if (ref && typeof ref !== 'function' && ref.current) {
              ref.current.setValue(userMessagesHistory[0]);
            }
          }
          // Navigate further back in history
          else if (historyIndex < userMessagesHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            if (ref && typeof ref !== 'function' && ref.current) {
              ref.current.setValue(userMessagesHistory[newIndex]);
            }
          }
        }
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          
          if (historyIndex === -1) return; // Not navigating
          
          // Navigate forward in history
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            if (ref && typeof ref !== 'function' && ref.current) {
              ref.current.setValue(userMessagesHistory[newIndex]);
            }
          }
          // Reached the end: restore draft
          else {
            setHistoryIndex(-1);
            if (ref && typeof ref !== 'function' && ref.current) {
              ref.current.setValue(draftMessage);
            }
            setDraftMessage('');
          }
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyIndex, draftMessage, userMessagesHistory, isProcessing, isMentionOpen, ref]);
    
    /**
     * Reset history navigation when user starts typing or loses focus
     */
    useEffect(() => {
      const handleInput = () => {
        if (historyIndex !== -1) {
          setHistoryIndex(-1);
          setDraftMessage('');
        }
      };
      
      const handleBlur = () => {
        // Reset to start from most recent message on next focus
        setHistoryIndex(-1);
        setDraftMessage('');
      };
      
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.addEventListener('input', handleInput);
        textarea.addEventListener('blur', handleBlur);
        return () => {
          textarea.removeEventListener('input', handleInput);
          textarea.removeEventListener('blur', handleBlur);
        };
      }
    }, [historyIndex]);

    return (
      <div className="flex relative flex-col justify-center items-center w-full pt-2 px-6 overflow-visible gap-4">
        <div className="flex relative justify-center items-center w-full overflow-visible gap-4">
          {/* Feedback Panel or Resume Prompt */}
          {(isFeedbackMode && activeFeedbackRequest) ? (
            (() => {
              const [prompt, actions] = Object.entries(activeFeedbackRequest.userActions)[0] || ['', []];
              return (
                <div className="flex-1 mb-4 flex justify-center items-center">
                  <FeedbackPanel
                    prompt={prompt}
                    actions={actions}
                    layout="horizontal"
                    onAction={submitAction}
                    disabled={isProcessing}
                  />
                </div>
              );
            })()
          ) : (conversationStatus === 'interrupted' || conversationStatus === 'hangingInput') ? (
            <div className="flex-1 mb-4 flex justify-center items-center">
              <FeedbackPanel
                prompt="Agent turn was interrupted. Would you like to resume?"
                actions={[
                  { 
                    id: 'resume', 
                    label: 'Resume Turn', 
                    primary: true
                  }
                ]}
                layout="horizontal"
                onAction={(actionId) => {
                  if (actionId === 'resume') resumeAgent();
                }}
              />
            </div>
          ) : null}
        {/* MessageInput */}
        <motion.div
          animate={{
            width: isFeedbackMode || conversationStatus === 'interrupted' || conversationStatus === 'hangingInput'? '60%' : '70%',
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            duration: 1,
          }}
        >
          <MessageInput
            ref={ref}
            onSend={submitUserInput}
            onStop={stopAgent}
            isProcessing={isProcessing}
            disabled={isInputDisabled}
            isThinking={isThinking}
            isToolCalling={isToolCalling}
            isResponding={isResponding}
            placeholder={isFeedbackMode ? 'Provide feedback...' : 'Type a message...'}
            onMentionOpenChange={setIsMentionOpen}
          />
        </motion.div>
        </div>
      </div>
    );
  }
);

InteractionArea.displayName = 'InteractionArea';
