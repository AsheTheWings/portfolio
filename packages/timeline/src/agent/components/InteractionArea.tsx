'use client';

/**
 * InteractionArea Component
 * Self-contained interaction handler
 * - Hosts MessageInput; never gated by agent status
 * - Tool-triggered feedback lives inside AgentMessage; not handled here
 * - GSAP-driven morph animation for the input container (collapse when empty)
 */

import { MessageInput, MessageInputRef } from './MessageInput';
import { forwardRef, useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAgent } from '../hooks/useAgent';
import { useUserInput } from '../hooks/useUserInput';
import { useAgentStore } from '../stores/useAgentStore';
import { isWorkflowActive } from '../utils/status';

gsap.registerPlugin(useGSAP);

type InteractionAreaProps = object;

export const InteractionArea = forwardRef<MessageInputRef, InteractionAreaProps>(
  ({}, ref) => {
    // Get state from store
    const { submitTrigger, userMessagesHistory, abortWorkflow } = useAgent();

    // Workflow-scoped "is the run live?" flag. Drives the pulsing dot and
    // pause-button visibility; the input never disables.
    const workflowStatus = useAgentStore((s) => s.workflowStatus);
    const isWorkflowRunning = isWorkflowActive(workflowStatus);

    // Collapsed state: empty composer stays collapsed; content, staged developer
    // text, or user interaction expands it.
    const [isOpenWithoutContent, setIsOpenWithoutContent] = useState(false);
    const [hasInputContent, setHasInputContent] = useState(false);

    // Use consolidated user input handler
    const { submitUserInput, insertDeveloperMessage, viewMode, stagedDeveloperMessage } = useUserInput();
    const hasStagedDeveloperMessage = stagedDeveloperMessage !== null;
    const isCollapsed = !hasInputContent && !hasStagedDeveloperMessage && !isOpenWithoutContent;

    // Auto-collapse whenever the composer becomes empty and no staged
    // developer content is pending.
    useEffect(() => {
      if (!hasInputContent && !hasStagedDeveloperMessage) {
        setIsOpenWithoutContent(false);
      }
    }, [hasInputContent, hasStagedDeveloperMessage]);

    // Escape key collapses (via agent:collapseAll event), discards current input,
    // and clears any staged developer content.
    useEffect(() => {
      const onCollapseAll = () => {
        setIsOpenWithoutContent(false);
        useAgentStore.getState().setStagedDeveloperMessage(null);
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.setValue('');
        }
      };
      window.addEventListener('agent:collapseAll', onCollapseAll);
      return () => window.removeEventListener('agent:collapseAll', onCollapseAll);
    }, [ref]);

    const lastSubmitTriggerRef = useRef(0);
    
    // History navigation state
    const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means not navigating
    const [draftMessage, setDraftMessage] = useState<string>(''); // Save current input when starting navigation
    const [isMentionOpen, setIsMentionOpen] = useState(false);

    // Prevent global keyboard shortcuts from firing while another input is focused
    const isForeignInput = useCallback(() => {
      const active = document.activeElement;
      if (!active) return false;
      const composer = document.querySelector('textarea[data-message-input="composer"]');
      if (active === composer) return false;
      return (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        (active as HTMLElement).isContentEditable
      );
    }, []);

    /**
     * Watch submit trigger and focus input (from global keyboard shortcuts)
     * Also expand collapsed input
     */
    useEffect(() => {
      if (submitTrigger && submitTrigger !== lastSubmitTriggerRef.current) {
        lastSubmitTriggerRef.current = submitTrigger;
        setIsOpenWithoutContent(true);
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
        // Disable history navigation when mention search is open
        if (isMentionOpen) return;
        
        // Don't intercept when user is focused in another input field
        if (isForeignInput()) return;
        
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
    }, [historyIndex, draftMessage, userMessagesHistory, isMentionOpen, ref, isForeignInput]);
    
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
      
      const textarea = document.querySelector('textarea[data-message-input="composer"]');
      if (textarea) {
        textarea.addEventListener('input', handleInput);
        textarea.addEventListener('blur', handleBlur);
        return () => {
          textarea.removeEventListener('input', handleInput);
          textarea.removeEventListener('blur', handleBlur);
        };
      }
    }, [historyIndex]);

    // Auto-expand and focus when user starts typing while collapsed.
    // The textarea is always in the DOM (sr-only when collapsed), so we
    // detect the first keystroke, expand, and inject the character.
    useEffect(() => {
      if (!isCollapsed) return;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Escape' || e.key === 'Tab') return;
        
        // Don't intercept when user is focused in another input field
        if (isForeignInput()) return;
        
        // Any printable key or Enter: expand and focus the (already-rendered) textarea
        if (e.key.length === 1 || (e.key === 'Enter' && !e.shiftKey)) {
          if (e.key === 'Enter') e.preventDefault();
          
          // Capture the character — it won't reach the textarea natively
          // because keydown was dispatched to window, not the textarea
          const char = e.key.length === 1 ? e.key : '';
          
          setIsOpenWithoutContent(true);
          
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
    }, [isCollapsed, ref, isForeignInput]);

    const expandInput = () => {
      setIsOpenWithoutContent(true);
      requestAnimationFrame(() => {
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.focus();
        }
      });
    };

    // GSAP morph animation for the input container — collapse to a pill when
    // empty, expand to 50% when active. No status-driven width branching: the
    // input is always available regardless of whether agents are working.
    const morphRef = useRef<HTMLDivElement>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const ANIM_DURATION = 0.4;

    useGSAP(() => {
      if (!morphRef.current) return;
      gsap.set(morphRef.current, { width: '142px', marginRight: '6rem' });
    }, { dependencies: [] });

    useGSAP(() => {
      if (!morphRef.current) return;
      setIsAnimating(true);

      gsap.to(morphRef.current, {
        width: isCollapsed ? '142px' : '50%',
        minWidth: isCollapsed ? '0px' : '320px',
        marginRight: isCollapsed ? '6rem' : '25%',
        duration: ANIM_DURATION,
        ease: 'power2.inOut',
        onComplete: () => {
          setIsAnimating(false);
        },
      });
    }, { dependencies: [isCollapsed] });

    return (
      <div className="w-full min-h-[72px] overflow-hidden flex items-center">
        {/* Spacer fills available space left of the input */}
        <div className="flex-1 min-w-0" />

        {/* Morphing container: GSAP-driven width + marginRight animation */}
        <div
          ref={morphRef}
          className="pointer-events-auto flex-shrink-0"
        >
          <MessageInput
            ref={ref}
            onSend={submitUserInput}
            onInsert={insertDeveloperMessage}
            isWorkflowRunning={isWorkflowRunning}
            onAbort={abortWorkflow}
            placeholder={viewMode === 'user' ? 'Type your message...' : 'Type a message...'}
            onMentionOpenChange={setIsMentionOpen}
            collapsed={isCollapsed}
            onExpand={expandInput}
            isAnimating={isAnimating}
            viewMode={viewMode}
            hasStagedMessage={hasStagedDeveloperMessage}
            onContentChange={setHasInputContent}
          />
        </div>
      </div>
    );
  }
);

InteractionArea.displayName = 'InteractionArea';
