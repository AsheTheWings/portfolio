'use client';

/**
 * InteractionArea Component
 * Self-contained interaction handler
 * - Displays MessageInput and FeedbackPanel
 * - Delegates business logic to useUserInput hook
 * - GSAP-driven morph animation for the input container
 */

import { MessageInput, MessageInputRef } from './MessageInput';
import { FeedbackPanel } from './FeedbackPanel';
import { forwardRef, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAgent } from '../hooks/useAgent';
import { useUserInput } from '../hooks/useUserInput';

gsap.registerPlugin(useGSAP);

type InteractionAreaProps = object;

export const InteractionArea = forwardRef<MessageInputRef, InteractionAreaProps>(
  ({}, ref) => {
    // Get state from store
    const { activeFeedbackRequest, submitTrigger, userMessagesHistory, stopAgent, resumeAgent, conversationStatus } = useAgent();
    
    // Collapsed state: auto-collapse when healthy, expand on user interaction
    const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
    const isCollapsed = conversationStatus === 'healthy' && !isManuallyExpanded;
    
    // Auto-collapse when returning to healthy
    useEffect(() => {
      if (conversationStatus === 'healthy') {
        setIsManuallyExpanded(false);
      }
    }, [conversationStatus]);
    
    // Escape key collapses (via agent:collapseAll event) — discard input
    useEffect(() => {
      const onCollapseAll = () => {
        if (conversationStatus === 'healthy') {
          setIsManuallyExpanded(false);
          // Clear input text on collapse
          if (ref && typeof ref !== 'function' && ref.current) {
            ref.current.setValue('');
          }
        }
      };
      window.addEventListener('agent:collapseAll', onCollapseAll);
      return () => window.removeEventListener('agent:collapseAll', onCollapseAll);
    }, [conversationStatus, ref]);
    
    // Derive processing states from conversationStatus
    const isProcessing = conversationStatus === 'processing' || conversationStatus === 'thinking' || conversationStatus === 'toolCalling' || conversationStatus === 'responding';
    const isThinking = conversationStatus === 'thinking';
    const isToolCalling = conversationStatus === 'toolCalling';
    const isResponding = conversationStatus === 'responding';
    
    // Disable input if processing or hanging input (user message pending)
    const isInputDisabled = isProcessing || conversationStatus === 'interrupted';
    
    // Use consolidated user input handler
    const { submitUserInput, submitAction, isFeedbackMode } = useUserInput();

    const lastSubmitTriggerRef = useRef(0);
    
    // History navigation state
    const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means not navigating
    const [draftMessage, setDraftMessage] = useState<string>(''); // Save current input when starting navigation
    const [isMentionOpen, setIsMentionOpen] = useState(false);

    /**
     * Watch submit trigger and focus input (from global keyboard shortcuts)
     * Also expand collapsed input
     */
    useEffect(() => {
      if (submitTrigger && submitTrigger !== lastSubmitTriggerRef.current) {
        lastSubmitTriggerRef.current = submitTrigger;
        setIsManuallyExpanded(true);
        // Focus the input to allow user to type (delayed to allow render)
        requestAnimationFrame(() => {
          if (ref && typeof ref !== 'function' && ref.current) {
            ref.current.focus();
          }
        });
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

    // Auto-expand and focus when user starts typing while collapsed
    // The textarea is always in the DOM (sr-only when collapsed),
    // so we detect the first keystroke, expand, and inject the character.
    useEffect(() => {
      if (!isCollapsed) return;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Escape' || e.key === 'Tab') return;
        
        // Any printable key or Enter: expand and focus the (already-rendered) textarea
        if (e.key.length === 1 || (e.key === 'Enter' && !e.shiftKey)) {
          if (e.key === 'Enter') e.preventDefault();
          
          // Capture the character — it won't reach the textarea natively
          // because keydown was dispatched to window, not the textarea
          const char = e.key.length === 1 ? e.key : '';
          
          setIsManuallyExpanded(true);
          
          // Inject character and focus after React re-renders the visible textarea
          requestAnimationFrame(() => {
            if (ref && typeof ref !== 'function' && ref.current) {
              if (char) ref.current.setValue(char);
              ref.current.focus();
            }
          });
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCollapsed, ref]);

    const expandInput = () => {
      setIsManuallyExpanded(true);
      requestAnimationFrame(() => {
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.focus();
        }
      });
    };

    // GSAP morph animation for the input container
    const morphRef = useRef<HTMLDivElement>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const ANIM_DURATION = 0.4;
    // Active states (processing/interrupted) get narrow width; normal expanded gets 50%
    const isActiveState = isProcessing || conversationStatus === 'interrupted';
    const expandedWidth = isActiveState ? '25%' : '50%';
    const expandedMarginRight = isActiveState ? '6rem' : '25%';

    // Set initial GSAP state on mount (no React style prop to avoid conflicts)
    useGSAP(() => {
      if (!morphRef.current) return;
      gsap.set(morphRef.current, { width: '142px', marginRight: '6rem' });
    }, { dependencies: [] });

    useGSAP(() => {
      if (!morphRef.current) return;
      setIsAnimating(true);

      gsap.to(morphRef.current, {
        width: isCollapsed ? '142px' : expandedWidth,
        minWidth: isCollapsed ? '0px' : '320px',
        marginRight: isCollapsed ? '6rem' : expandedMarginRight,
        duration: ANIM_DURATION,
        ease: 'power2.inOut',
        onComplete: () => {
          setIsAnimating(false);
        },
      });
    }, { dependencies: [isCollapsed, isActiveState, conversationStatus] });

    return (
      <div className="w-full min-h-[72px] overflow-hidden flex items-center">
        {/* Feedback panels - fills available space left of input */}
        <div className="flex-1 flex justify-center items-endgap-4  pointer-events-auto min-w-0">
          <AnimatePresence mode="wait">
          {(isFeedbackMode && activeFeedbackRequest) ? (
            (() => {
              const [prompt, actions] = Object.entries(activeFeedbackRequest.userActions)[0] || ['', []];
              return (
                <motion.div
                  key="feedback"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex justify-center items-center overflow-hidden whitespace-nowrap"
                >
                  <FeedbackPanel
                    prompt={prompt}
                    actions={actions}
                    layout="horizontal"
                    onAction={submitAction}
                    disabled={isProcessing}
                  />
                </motion.div>
              );
            })()
          ) : conversationStatus === 'interrupted' ? (
            <motion.div
              key="interrupted"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex justify-center items-center overflow-hidden whitespace-nowrap"
            >
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
            </motion.div>
          ) : null}
          </AnimatePresence>
        </div>

        {/* Morphing container: GSAP-driven width + marginRight animation */}
        <div
          ref={morphRef}
          className="pointer-events-auto flex-shrink-0"
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
            collapsed={isCollapsed}
            onExpand={expandInput}
            isAnimating={isAnimating}
          />
        </div>
      </div>
    );
  }
);

InteractionArea.displayName = 'InteractionArea';
