'use client';

/**
 * Side-by-Side UI - Carousel-based turn navigation interface
 */

import React, { useRef, useEffect, useState } from 'react';
import { useAgent } from '../hooks/useAgent';
import { resolveComponent } from './ComponentResolver';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/features/shared/components/shadcn';
import { useUserInput } from '../hooks/useUserInput';
import type { AgentSessionComponent, FeedbackAction } from '../types';

interface TurnPair {
  userMessage: AgentSessionComponent;
  agentThoughts?: AgentSessionComponent;
  agentMessage?: AgentSessionComponent;
  turnIndex: number;
}

interface SideBySideInterfaceProps {
  onInputChange?: (value: string) => void;
  initialSlideIndex?: number | null;
  onSlideIndexChange?: (index: number) => void;
}

export function SideBySideInterface({ 
  onInputChange,
  initialSlideIndex,
  onSlideIndexChange
}: SideBySideInterfaceProps) {
  const { sessionComponents, conversationStatus, submitMessage, currentSessionId, ephemeral, removeComponentsByRole, submitTrigger, agentConfig, activeFeedbackRequest } = useAgent();
  const isProcessing = conversationStatus === 'processing' || conversationStatus === 'thinking' || conversationStatus === 'toolCalling' || conversationStatus === 'responding';
  const { submitAction, isFeedbackMode } = useUserInput();
  const [inputValue, setInputValue] = useState('');
  const [lastSubmitTrigger, setLastSubmitTrigger] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasInitializedPosition = useRef(false);

  // Extract conversation turn pairs (user + agent responses)
  // Memoized to prevent recalculation on every render
  const turnPairs = React.useMemo(() => {
    const pairs: TurnPair[] = [];
    const conversationMessages = sessionComponents.filter((msg: AgentSessionComponent) => msg.role !== 'system');
    
    for (let i = 0; i < conversationMessages.length; i++) {
      const msg = conversationMessages[i];
      if (msg.role === 'user' && msg.type === 'message') {
        // Collect all subsequent agent components until next user message
        let agentThoughts: AgentSessionComponent | undefined;
        let agentMessage: AgentSessionComponent | undefined;
        let j = i + 1;
        
        while (j < conversationMessages.length && conversationMessages[j].role === 'agent') {
          const agentComponent = conversationMessages[j];
          if (agentComponent.type === 'agent-thoughts') {
            agentThoughts = agentComponent;
          } else if (agentComponent.type === 'message') {
            agentMessage = agentComponent;
          }
          j++;
        }
        
        pairs.push({
          userMessage: msg,
          agentThoughts,
          agentMessage,
          turnIndex: pairs.length,
        });
        
        i = j - 1; // Skip all paired agent components
      }
    }
    
    return pairs;
  }, [sessionComponents]);
  
  // Get system messages (for panels/components)
  // Show the latest (most recently added) system panel
  const latestSystemMessage = React.useMemo(() => {
    const systemMessages = sessionComponents.filter((msg: AgentSessionComponent) => msg.role === 'system');
    return systemMessages[systemMessages.length - 1];
  }, [sessionComponents]);
  
  // Create slides: all completed turns + one empty slide for new input
  const slides = [...turnPairs, null]; // null represents the new input slide
  
  // Check if we're at the latest turn (empty slide for new input)
  const isAtLatestTurn = currentTurnIndex === slides.length - 1;
  
  // Get current slide (turn or null for new input)
  const currentSlide = slides[currentTurnIndex];
  
  // Input disabled when viewing past turns or processing
  const isInputDisabled = !isAtLatestTurn || isProcessing;

  // Sync carousel API state and notify parent of changes
  useEffect(() => {
    if (!carouselApi) return;
    
    const onSelect = () => {
      const index = carouselApi.selectedScrollSnap();
      setCurrentTurnIndex(index);
      onSlideIndexChange?.(index);
    };
    
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi, onSlideIndexChange]);

  // Set initial carousel position on mount
  useEffect(() => {
    if (!carouselApi || hasInitializedPosition.current) return;
    
    const latestSlideIndex = slides.length - 1;
    
    // If we have a saved position, use it (instant, no animation)
    if (initialSlideIndex !== null && initialSlideIndex !== undefined) {
      carouselApi.scrollTo(initialSlideIndex, true);
    } 
    // Otherwise, on first visit, go to last completed turn (not input slide)
    else if (latestSlideIndex > 0) {
      carouselApi.scrollTo(latestSlideIndex - 1, true);
    }
    
    hasInitializedPosition.current = true;
  }, [carouselApi, slides.length, initialSlideIndex]);
  
  // Navigate to latest turn when opening system messages
  useEffect(() => {
    if (carouselApi && latestSystemMessage) {
      carouselApi.scrollTo(slides.length - 1, true); // true = instant
    }
  }, [carouselApi, latestSystemMessage, slides.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Watch for submit trigger from AgentPlayground (global Enter key)
  useEffect(() => {
    if (submitTrigger && submitTrigger !== lastSubmitTrigger) {
      setLastSubmitTrigger(submitTrigger);
      // Focus the input to allow user to type
      inputRef.current?.focus();
    }
  }, [submitTrigger, lastSubmitTrigger]);

  // Notify parent of input changes
  useEffect(() => {
    onInputChange?.(inputValue);
  }, [inputValue, onInputChange]);

  // Handle manual send (Ctrl/Cmd + Enter)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing || !isAtLatestTurn) return;

    const message = inputValue;
    setInputValue('');

    try {
      // submitMessage handles session creation if no currentSessionId
      await submitMessage(message);
      
      // Carousel will auto-navigate via useEffect when slides array updates
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };


  return (
    <div className="h-full overflow-hidden flex items-center justify-center bg-background">
      <div className="h-full w-[90vw] flex flex-col border border-primary border-t-0">
        {/* Carousel wrapping both containers */}
        <Carousel
          opts={{ 
            watchDrag: false, 
            align: 'start',
            loop: false,
            skipSnaps: false,
            duration: 20
          }}
          setApi={setCarouselApi}
          className="flex-1 overflow-hidden"
        >
          <CarouselContent className="h-full">
            {/* Render all slides: completed turns + new input slide */}
            {slides.map((slide, index) => {
              const isNewInputSlide = slide === null;
              
              return (
                <CarouselItem key={isNewInputSlide ? 'new-input' : slide.turnIndex} className="h-full flex">
                  {/* Agent Container (Left Side) */}
                  <div 
                    className="h-full w-1/2 interface-scroll-container overflow-y-auto scrollbar-inner border-r border-primary"
                  >
                    {/* Historical turn: show agent response */}
                    {!isNewInputSlide && (slide.agentThoughts || slide.agentMessage) && (
                      <div className="p-6 space-y-4">
                        {/* Render thoughts if present */}
                        {slide.agentThoughts && resolveComponent(slide.agentThoughts, {
                          mode: 'sideBySide',
                          includeThoughtsInResponse: agentConfig?.includeThoughtsInResponse ?? true,
                        })}
                        {/* Render message if present */}
                        {slide.agentMessage && resolveComponent(slide.agentMessage, {
                          mode: 'sideBySide',
                          includeThoughtsInResponse: agentConfig?.includeThoughtsInResponse ?? true,
                        })}
                      </div>
                    )}
                    
                    {/* Historical turn: agent still thinking */}
                    {!isNewInputSlide && !slide.agentThoughts && !slide.agentMessage && (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-muted-foreground italic">Agent is thinking...</p>
                      </div>
                    )}
                    
                    {/* New input slide: show system messages or placeholder */}
                    {isNewInputSlide && (
                      <>
                        {/* System Message - resolved via ComponentResolver */}
                        {latestSystemMessage ? (
                          <div className="h-full w-full">
                            {resolveComponent(latestSystemMessage, {
                              mode: 'sideBySide',
                              includeThoughtsInResponse: agentConfig?.includeThoughtsInResponse ?? true,
                            })}
                          </div>
                        ) : (
                          /* Placeholder Message (when no system message) */
                          <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-muted-foreground italic">
                              {sessionComponents.length === 0 && !ephemeral && !currentSessionId
                                ? 'Send a message to start a conversation' 
                                : 'Waiting for your prompt...'}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* User Container (Right Side) */}
                  <div className="w-1/2 overflow-y-auto scrollbar-inner">
                    {/* Historical turn: show readonly user prompt */}
                    {!isNewInputSlide && (
                      <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground p-6 bg-transparent">
                        {slide.userMessage.data.message}
                      </pre>
                    )}
                    
                    {/* New input slide: show live textarea */}
                    {isNewInputSlide && (
                      <form onSubmit={handleSubmit} className="flex flex-col h-full">
                        <textarea
                          ref={inputRef}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          disabled={isInputDisabled}
                          placeholder={isInputDisabled ? (isProcessing ? 'Agent is thinking...' : 'Navigate to latest turn to type') : 'Type your prompt...'}
                          className="
                            flex-1 w-full p-6
                            text-foreground
                            text-[15px] leading-relaxed
                            placeholder:text-slate-400 dark:placeholder:text-slate-600
                            focus:outline-none
                            disabled:cursor-not-allowed
                            resize-none
                            transition-all duration-200
                          "
                          style={{ backgroundColor: isInputDisabled ? 'transparent' : 'var(--surface-1)' }}
                          onKeyDown={(e) => {
                            // Submit on Enter (unless Shift is held for new line)
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmit(e);
                            }
                            // Allow Shift+Enter for new lines (default textarea behavior)
                          }}
                        />
                      </form>
                    )}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        <div className="w-full h-16 flex">
          {/* Agent Header - Shows feedback mode when active */}
          <div className="w-1/2 flex items-center border-t border-r border-primary bg-surface-3 px-4">
            {isFeedbackMode && activeFeedbackRequest ? (
              /* Feedback Mode: Show query and action buttons in same row */
              <div className="flex items-center gap-4 w-full">
                <span className="text-sm font-medium text-foreground shrink-0">
                  Agent: {activeFeedbackRequest.userActions ? Object.keys(activeFeedbackRequest.userActions)[0] || 'Waiting for feedback' : 'Waiting for feedback'}
                </span>
                <div className="flex-1 flex items-center justify-center gap-2">
                  {Object.entries(activeFeedbackRequest.userActions || {}).flatMap(([, actions]) => actions).map((action: FeedbackAction) => (
                    <button
                      key={action.id}
                      onClick={() => submitAction(action.id)}
                      disabled={isProcessing}
                      className={`
                        px-3 py-1.5 rounded text-xs font-medium
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${action.primary 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Normal Mode: Just show "Agent" label */
              <span className="text-sm font-medium text-foreground w-full text-center">Agent</span>
            )}
          </div>

          {/* User Header */}
          <div className="w-1/2 flex items-center justify-between px-4 border-t border-primary bg-surface-3">
            {/* Previous Prompt Button */}
            <button
              onClick={() => carouselApi?.scrollPrev()}
              disabled={!carouselApi?.canScrollPrev()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous prompt"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Previous Prompt
            </button>
            <span className="text-sm font-medium text-foreground">User</span>
            {/* Next Prompt Button */}
            <button
              onClick={() => carouselApi?.scrollNext()}
              disabled={!carouselApi?.canScrollNext()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next prompt"
            >
              Next Prompt
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
