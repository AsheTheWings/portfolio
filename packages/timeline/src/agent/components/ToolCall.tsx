'use client';

/**
 * ToolCall — Pure content renderer for tool call execution
 *
 * Renders tool declaration (args) and result panels. Always visible,
 * no collapse/expand behavior. Collapsibility is provided by
 * CollapsibleShip when used in FlatInterface.
 *
 * Supports edit mode (editable args + result) for AgentMessage carousel.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import { MarkdownContent } from './MarkdownContent';
import { ThreeDotsScaleMiddleIcon } from '@portfolio/ui/icons/ThreeDotsScaleMiddleIcon';
import { BorderBeam } from '@portfolio/ui/components/shadcn/border-beam';
import type { SessionComponentData, EditingData } from '../types';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

interface ToolCallProps {
  data?: SessionComponentData;
  isEditMode?: boolean;
  editingData?: EditingData | null;
  onUpdateEditingData?: (data: EditingData) => void;
  onSubmitEdit?: () => void;
  onValidationChange?: (isValid: boolean) => void;
}

export function ToolCall({
  data: propData,
  isEditMode = false,
  editingData,
  onUpdateEditingData = () => {},
  onSubmitEdit,
  onValidationChange,
}: ToolCallProps) {
  const data = propData || {};

  const server = data.server as string | undefined;
  const toolCall = data.arguments;
  const toolResult = data.result;

  // Error is now in result: { status: 'error', message: '...' }
  const errorResult = toolResult as { status?: string; message?: string } | undefined;
  const error = errorResult?.status === 'error' ? errorResult.message : undefined;

  // Derived: executing if we have tool call but no result yet
  const isExecuting = Boolean(server && toolResult === undefined);

  const [jsonError, setJsonError] = useState<string | null>(null);

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

  const isValidForSubmit = useCallback(() => {
    const argsValid = editingArguments ? validateArgumentsJson(editingArguments) : true;
    return argsValid && !jsonError;
  }, [editingArguments, jsonError]);

  useEffect(() => {
    if (isEditMode && onValidationChange) {
      onValidationChange(isValidForSubmit());
    }
  }, [isEditMode, isValidForSubmit, onValidationChange]);

  const handleSubmit = () => {
    if (isValidForSubmit()) {
      onSubmitEdit?.();
    }
  };

  // Status
  const hasResult = toolResult !== undefined;
  const mcpIsError = !!(toolResult && typeof toolResult === 'object' && (toolResult as { isError?: boolean }).isError === true);
  const hasFailed = !!error || mcpIsError;

  // Extract and format tool result content (MCP spec)
  const getResultContent = (): { content: string; isString: boolean } => {
    if (!toolResult) return { content: '', isString: false };
    const resultObj = toolResult as Record<string, unknown>;
    if (Array.isArray(resultObj.content) && resultObj.content.length > 0) {
      const textBlocks = resultObj.content
        .filter((block: { type?: string }) => block.type === 'text')
        .map((block: { text?: string }) => block.text)
        .filter(Boolean);
      if (textBlocks.length > 0) {
        const combinedText = textBlocks.join('\n\n');
        return isJsonString(combinedText)
          ? { content: prettyJson(combinedText), isString: false }
          : { content: combinedText, isString: true };
      }
      if (resultObj.structuredContent) {
        return { content: JSON.stringify(resultObj.structuredContent, null, 2), isString: false };
      }
    }
    if (typeof toolResult === 'string') {
      return isJsonString(toolResult)
        ? { content: prettyJson(toolResult), isString: false }
        : { content: toolResult, isString: true };
    }
    if (resultObj.result) {
      if (typeof resultObj.result === 'string') {
        return isJsonString(resultObj.result)
          ? { content: prettyJson(resultObj.result), isString: false }
          : { content: resultObj.result, isString: true };
      }
      return { content: JSON.stringify(resultObj.result, null, 2), isString: false };
    }
    if (resultObj.content && typeof resultObj.content === 'string') {
      return isJsonString(resultObj.content)
        ? { content: prettyJson(resultObj.content), isString: false }
        : { content: resultObj.content, isString: true };
    }
    return { content: JSON.stringify(toolResult, null, 2), isString: false };
  };

  const isJsonString = (str: string): boolean => { try { JSON.parse(str); return true; } catch { return false; } };
  const prettyJson = (str: string): string => { try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; } };

  const { content: resultContent, isString: isStringResult } = getResultContent();

  const highlightedToolCall = useMemo(() => {
    const jsonString = JSON.stringify(toolCall, null, 2);
    return hljs.highlight(jsonString, { language: 'json' }).value;
  }, [toolCall]);

  const highlightedResult = useMemo(() => {
    if (isStringResult || !resultContent) return null;
    return hljs.highlight(resultContent, { language: 'json' }).value;
  }, [resultContent, isStringResult]);

  // Sync local string state when editingData.arguments changes
  useEffect(() => {
    if (isEditMode && editingData?.arguments) {
      const newString = typeof editingData.arguments === 'string'
        ? editingData.arguments
        : JSON.stringify(editingData.arguments, null, 2);
      setEditingArgumentsString(newString);
    }
  }, [isEditMode, editingData?.arguments]);

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="session-component relative">
      {isEditMode && <BorderBeam colorFrom="#06b6d4" colorTo="#22d3ee" borderWidth={2} pixelsPerSecond={500} />}

      {/* Content panels — always visible */}
      <div className="flex flex-col overflow-x-hidden lg:flex-row gap-3">
        {/* Left Panel — Declaration / Arguments */}
        <div className="lg:w-[40%] min-w-0">
          <div className="flex items-start justify-between mb-2 px-1 gap-2">
            <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 flex-shrink-0 whitespace-nowrap">
              {isEditMode ? 'Tool Arguments' : 'Tool Declaration'}
            </div>
            {isEditMode && jsonError && (
              <div className="text-xs text-red-500">{jsonError}</div>
            )}
          </div>
          <div>
            {isEditMode ? (
              <div
                className="json-highlight border border-input rounded-md overflow-hidden min-h-[200px] code-editor-container transition-colors focus-within:border-cyan-500 focus-within:shadow-[0_0_0_1px_rgba(6,182,212,0.5)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (validateArgumentsJson(editingArguments)) {
                      try { onUpdateEditingData({ arguments: JSON.parse(editingArguments) }); } catch { /* */ }
                    }
                    handleSubmit();
                  }
                }}
              >
                <Editor
                  value={editingArguments}
                  onValueChange={(code) => setEditingArgumentsString(code)}
                  onBlur={() => {
                    if (validateArgumentsJson(editingArguments)) {
                      try { onUpdateEditingData({ arguments: JSON.parse(editingArguments) }); } catch { /* */ }
                    }
                  }}
                  highlight={(code) => hljs.highlight(code, { language: 'json' }).value}
                  padding={12}
                  style={{
                    fontFamily: '"Fira Code", "Fira Mono", Consolas, monospace',
                    fontSize: 12,
                    backgroundColor: 'transparent',
                  }}
                />
              </div>
            ) : (
              <div className="json-highlight overflow-x-hidden">
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

        {/* Right Panel — Result */}
        <div className="lg:w-[60%] min-w-0">
          <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-2 px-1">Tool Result</div>
          <div>
            {isEditMode ? (
              <div className="border border-input rounded-md overflow-hidden min-h-[200px] transition-colors focus-within:border-cyan-500 focus-within:shadow-[0_0_0_1px_rgba(6,182,212,0.5)]">
                <textarea
                  value={editingResult}
                  onChange={(e) => onUpdateEditingData({ result: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (editingArguments && validateArgumentsJson(editingArguments)) {
                        try { onUpdateEditingData({ arguments: JSON.parse(editingArguments) }); } catch { /* */ }
                      }
                      handleSubmit();
                    }
                  }}
                  className="w-full min-h-[200px] p-3 bg-transparent border-none outline-none resize-none text-xs font-mono"
                  placeholder="Enter result text..."
                />
              </div>
            ) : (
              <div>
                {isExecuting && (
                  <div className="flex items-center border-2 border-red-500 justify-center h-full w-full">
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
                {!isExecuting && !hasFailed && hasResult && (
                  <>
                    {isStringResult ? (
                      <div className="text-sm whitespace-pre-wrap break-words">
                        <MarkdownContent content={resultContent} />
                      </div>
                    ) : (
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
                {!isExecuting && !hasFailed && !hasResult && (
                  <div className="text-sm text-muted-foreground italic">No result available</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

