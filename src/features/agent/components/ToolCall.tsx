'use client';

/**
 * ToolCall Component
 * Displays tool call execution with declaration and result
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import { MarkdownContent } from './MarkdownContent';
import { ThreeDotsScaleMiddleIcon } from '@/features/shared/icons/ThreeDotsScaleMiddleIcon';
import { useChatClickAway } from '../hooks/useChatClickAway';
import { useAgentSessionComponent } from '../contexts/AgentSessionComponentContext';
import { BorderBeam } from '@/features/shared/components/shadcn/border-beam';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';


hljs.registerLanguage('json', json);

export function ToolCall() {
  // Get all data from context
  const {
    data,
    isEditMode,
    editingData,
    onUpdateEditingData,
    onSubmitEdit,
    onValidationChange,
  } = useAgentSessionComponent();
  
  const server = data.server as string | undefined;
  const tool = data.tool as string | undefined;
  const toolCall = data.arguments;
  const toolResult = data.result;
  
  // Check if tool supports actions (action is in arguments)
  const action = (toolCall as { action?: string })?.action;
  const toolDisplayName = action ? `${server}/${tool}/${action}` : `${server}/${tool}`;
  
  // Error is now in result: { status: 'error', message: '...' }
  const errorResult = toolResult as { status?: string; message?: string } | undefined;
  const error = errorResult?.status === 'error' ? errorResult.message : undefined;
  
  // Derived: executing if we have tool call but no result yet
  const isExecuting = Boolean(server && toolResult === undefined);
  
  const isBackground = !!(data as { isBackground?: boolean }).isBackground;
  const [isExpanded, setIsExpanded] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep raw string for editing, separate from parsed object
  const [editingArgumentsString, setEditingArgumentsString] = useState(() => {
    if (editingData?.arguments) {
      return typeof editingData.arguments === 'string'
        ? editingData.arguments
        : JSON.stringify(editingData.arguments, null, 2);
    }
    return '';
  });

  const editingArguments = editingArgumentsString;
  const editingResult = editingData?.result !== undefined 
    ? (typeof editingData.result === 'string' ? editingData.result : JSON.stringify(editingData.result, null, 2))
    : '';

  // BorderBeam will compute duration from container perimeter using pixelsPerSecond

  // Real-time validation for arguments
  const validateArgumentsJson = (value: string) => {
    if (!value?.trim()) {
      setJsonError('Arguments cannot be empty');
      return false;
    }
    try {
      JSON.parse(value);
      setJsonError(null);
      return true;
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  // Check if current state is valid for submission
  const isValidForSubmit = () => {
    const argsValid = editingArguments ? validateArgumentsJson(editingArguments) : true;
    return argsValid && !jsonError;
  };

  // Communicate validation state changes to parent
  useEffect(() => {
    if (isEditMode && onValidationChange) {
      const isValid = isValidForSubmit();
      onValidationChange(isValid);
    }
  }, [isEditMode, jsonError, editingArguments, onValidationChange]);


  const handleSubmit = () => {
    if (isValidForSubmit()) {
      onSubmitEdit?.();
    }
  };

  // Determine status
  const hasResult = toolResult !== undefined;
  // Check both explicit error prop and MCP isError field
  const mcpIsError = toolResult && typeof toolResult === 'object' && (toolResult as { isError?: boolean }).isError === true;
  const hasFailed = !!error || mcpIsError;
  const isComplete = !isExecuting && (hasResult || hasFailed);

  // Extract and format tool result content according to MCP spec
  // MCP format: { content: [{ type: "text", text: "..." }], isError?: boolean }
  const getResultContent = (): { content: string; isString: boolean } => {
    if (!toolResult) return { content: '', isString: false };
    
    const resultObj = toolResult as Record<string, unknown>;
    
    // MCP format: Check for content array
    if (Array.isArray(resultObj.content) && resultObj.content.length > 0) {
      // Extract all text content blocks
      const textBlocks = resultObj.content
        .filter((block: { type?: string }) => block.type === 'text')
        .map((block: { text?: string }) => block.text)
        .filter(Boolean);
      
      if (textBlocks.length > 0) {
        // Check if text block is JSON
        const combinedText = textBlocks.join('\n\n');
        if (isJsonString(combinedText)) {
          return { content: prettyJson(combinedText), isString: false };
        }
        return { content: combinedText, isString: true };
      }
      
      // If no text blocks, show structured content or full object
      if (resultObj.structuredContent) {
        return { content: JSON.stringify(resultObj.structuredContent, null, 2), isString: false };
      }
    }
    
    // Legacy format: Direct string
    if (typeof toolResult === 'string') {
      // Check if string is JSON
      if (isJsonString(toolResult)) {
        return { content: prettyJson(toolResult), isString: false };
      }
      return { content: toolResult, isString: true };
    }
    
    // Legacy format: { result: "..." } or { content: "..." }
    if (resultObj.result) {
      // Check if result is JSON string
      if (typeof resultObj.result === 'string') {
        if (isJsonString(resultObj.result)) {
          return { content: prettyJson(resultObj.result), isString: false };
        }
        return { content: resultObj.result, isString: true };
      }
      // If result is object, stringify it
      return { content: JSON.stringify(resultObj.result, null, 2), isString: false };
    }
    
    if (resultObj.content && typeof resultObj.content === 'string') {
      if (isJsonString(resultObj.content)) {
        return { content: prettyJson(resultObj.content), isString: false };
      }
      return { content: resultObj.content, isString: true };
    }
    
    // Fallback: stringify the whole object
    return { content: JSON.stringify(toolResult, null, 2), isString: false };
  };
  
  // Helper to check if a string is valid JSON
  const isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  // Pretty-print a JSON string with indentation
  const prettyJson = (str: string): string => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };
  
  const { content: resultContent, isString: isStringResult } = getResultContent();

  // Highlighted JSON for tool call declaration
  const highlightedToolCall = useMemo(() => {
    const jsonString = JSON.stringify(toolCall, null, 2);
    return hljs.highlight(jsonString, { language: 'json' }).value;
  }, [toolCall]);

  // Highlighted JSON for tool result (if not string)
  const highlightedResult = useMemo(() => {
    if (isStringResult || !resultContent) return null;
    return hljs.highlight(resultContent, { language: 'json' }).value;
  }, [resultContent, isStringResult]);

  // Click outside to collapse (allow clicks on all session components and control buttons)
  // Disabled in background mode - tool calls stay expanded for monitoring
  useChatClickAway(containerRef, {
    mode: 'expansion',
    enabled: isExpanded,
    disabled: isBackground,
    onClickAway: () => {
      setIsExpanded(false);
    },
    additionalAllowedSelectors: ['[data-edit-allowed]'], // Allow clicks on edit/submit buttons
  });

  // Sync local string state when editingData.arguments changes (from store updates)
  useEffect(() => {
    if (isEditMode && editingData?.arguments) {
      const newString = typeof editingData.arguments === 'string'
        ? editingData.arguments
        : JSON.stringify(editingData.arguments, null, 2);
      setEditingArgumentsString(newString);
    }
  }, [isEditMode, editingData?.arguments]);

  // Global collapse listener (Escape)
  useEffect(() => {
    const onCollapseAll = (_e: Event) => setIsExpanded(false);
    window.addEventListener('agent:collapseAll', onCollapseAll);
    return () => window.removeEventListener('agent:collapseAll', onCollapseAll);
  }, []);

  // Unified UI structure - single return with conditional rendering
  return (
    <div ref={containerRef} className="session-component relative">
      {isEditMode && <BorderBeam colorFrom="#06b6d4" colorTo="#22d3ee" borderWidth={2} pixelsPerSecond={500} />}
      
      {/* Unified Header - Works for both edit and view modes */}
      <button
        onClick={() => !isEditMode && setIsExpanded(!isExpanded)}
        disabled={isEditMode}
        className={`flex items-center gap-2 text-xs ${isEditMode ? 'text-muted-foreground cursor-default' : 'text-muted-foreground hover:text-foreground cursor-pointer'} transition-colors`}
        aria-expanded={isExpanded}
        aria-label={isEditMode ? `Editing ${toolDisplayName}` : (isExpanded ? 'Hide tool call details' : 'Show tool call details')}
      >
        {/* Tool Name */}
        <span className="font-medium">{toolDisplayName}</span>
        
        {/* Status Icon - always visible */}
        <>
          {isExecuting && <ThreeDotsScaleMiddleIcon size={14} className="text-cyan-500" />}
          {isComplete && !hasFailed && <Check size={14} className="text-cyan-500" />}
          {isComplete && hasFailed && <X size={14} className="text-red-500" />}
        </>

        {/* Expand Arrow - always visible when not executing */}
        {!isExecuting && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            {/* Right arrow when collapsed, down when expanded (via rotation) */}
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Expanded Content - Edit or View mode */}
      {(isExpanded || isEditMode) && (
        <div className={`flex flex-col mt-4 mb-2 overflow-y-auto scrollbar-inner overflow-x-hidden lg:flex-row gap-3 ${isEditMode ? 'h-[400px]' : 'max-h-[400px]'}`}>
          {/* Left Panel - Shared structure, swappable content */}
          <div className="lg:w-[40%] min-w-0 min-h-0 flex flex-col">
            <div className="flex items-start justify-between mb-2 px-1 gap-2">
              <div className="text-sm font-medium text-foreground flex-shrink-0 whitespace-nowrap">
                {isEditMode ? 'Tool Arguments' : 'Tool Declaration'}
              </div>
              {isEditMode && jsonError && (
                <div className="text-xs text-red-500">
                  {jsonError}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {isEditMode ? (
                // Edit mode: editable arguments
                <div 
                  className="json-highlight border border-input rounded-md overflow-hidden h-full code-editor-container transition-colors focus-within:border-cyan-500 focus-within:shadow-[0_0_0_1px_rgba(6,182,212,0.5)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      // Enter: sync to store then submit (blur won't fire before submit)
                      e.preventDefault();
                      if (validateArgumentsJson(editingArguments)) {
                        try {
                          const parsed = JSON.parse(editingArguments);
                          onUpdateEditingData({ arguments: parsed });
                        } catch { /* validated above */ }
                      }
                      handleSubmit();
                    }
                    // Shift+Enter: allow default behavior (new line)
                  }}
                >
                  <Editor
                    value={editingArguments}
                    onValueChange={(code) => {
                      // Update local string state immediately to allow typing
                      setEditingArgumentsString(code);
                    }}
                    onBlur={() => {
                      // Validate and parse on blur
                      if (validateArgumentsJson(editingArguments)) {
                        try {
                          const parsed = JSON.parse(editingArguments);
                          onUpdateEditingData({ arguments: parsed });
                        } catch {
                          // Should not happen if validation passed
                        }
                      }
                    }}
                    highlight={(code) => hljs.highlight(code, { language: 'json' }).value}
                    padding={12}
                    style={{
                      fontFamily: '"Fira Code", "Fira Mono", Consolas, monospace',
                      fontSize: 12,
                      backgroundColor: 'transparent',
                      height: '100%',
                    }}
                  />
                </div>
              ) : (
                // View mode: read-only tool declaration
                <div className="json-highlight overflow-y-auto overflow-x-hidden scrollbar-inner h-full">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    <code
                      className="hljs language-json"
                      style={{ background: 'transparent' }}
                      dangerouslySetInnerHTML={{ __html: highlightedToolCall }}
                    />
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Shared structure, swappable content */}
          <div className="lg:w-[60%] min-w-0 min-h-0 flex flex-col">
            <div className="text-sm font-medium text-foreground mb-2 px-1">
              Tool Result
            </div>
            <div className="flex-1 overflow-hidden">
              {isEditMode ? (
                // Edit mode: editable result (plain text)
                <div className="border border-input rounded-md overflow-hidden h-full transition-colors focus-within:border-cyan-500 focus-within:shadow-[0_0_0_1px_rgba(6,182,212,0.5)]">
                  <textarea
                    value={editingResult}
                    onChange={(e) => onUpdateEditingData({ result: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        // Enter: sync args to store then submit
                        e.preventDefault();
                        if (editingArguments && validateArgumentsJson(editingArguments)) {
                          try {
                            const parsed = JSON.parse(editingArguments);
                            onUpdateEditingData({ arguments: parsed });
                          } catch { /* validated above */ }
                        }
                        handleSubmit();
                      }
                      // Shift+Enter: allow default behavior (new line)
                    }}
                    className="w-full h-full p-3 bg-transparent border-none outline-none resize-none text-xs font-mono"
                    placeholder="Enter result text..."
                  />
                </div>
              ) : (
                // View mode: read-only result display
                <div className="overflow-y-auto scrollbar-inner h-full">
                  {isExecuting && (
                    <div className="flex items-center justify-center h-full w-full">
                      <ThreeDotsScaleMiddleIcon size={26} className="text-cyan-500" />
                    </div>
                  )}
                  
                  {!isExecuting && Boolean(hasFailed) && (
                    <div className="space-y-2">
                      <div className="text-sm text-red-500 font-medium">Error</div>
                      <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                        {error || resultContent || 'Tool execution failed'}
                      </pre>
                    </div>
                  )}
                  
                  {!isExecuting && !hasFailed && toolResult !== undefined && (
                    <>
                      {isStringResult ? (
                        // Plain text result
                        <div className="text-sm whitespace-pre-wrap break-words">
                          <MarkdownContent content={resultContent} />
                        </div>
                      ) : (
                        // JSON result with syntax highlighting
                        <pre className="json-highlight text-xs font-mono whitespace-pre-wrap break-words">
                          <code
                            className="hljs language-json"
                            style={{ background: 'transparent' }}
                            dangerouslySetInnerHTML={{ __html: highlightedResult || '' }}
                          />
                        </pre>
                      )}
                    </>
                  )}
                  
                  {!isExecuting && !hasFailed && toolResult === undefined && (
                    <div className="text-sm text-muted-foreground italic">
                      No result available
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
