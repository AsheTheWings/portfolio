'use client';

/**
 * History Panel - Browse and load past agent sessions
 * Displays agent_sessions table with search/filter capabilities
 * Self-contained: handles session loading and close behavior
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  Label,
  Input,
  ScrollArea,
  Calendar,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from '@/features/shared/components/shadcn';
import { CalendarIcon } from 'lucide-react';
import { ThreeDotsScaleMiddleIcon } from '@/features/shared/icons/ThreeDotsScaleMiddleIcon';
import { useAgentSessionHistory } from '../hooks/useAgentSessionHistory';
import { useAgent } from '../hooks/useAgent';

interface AgentSessionRow {
  id: string;
  title?: string;
  agentName: string;
  eventCount: number;
  turnsCount: number;
  createdAt: string;
  updatedAt: string;
}

export function HistoryPanel() {
  const { loadAgentSession, removeComponent, currentSessionId, uiMode } = useAgent();
  const [loadingAgentSessionId, setLoadingAgentSessionId] = useState<string | null>(null);

  // Chat mode = standalone (centered card), side-by-side = inline
  const isStandalone = uiMode === 'chat';

  const handleClose = () => {
    removeComponent('history-panel');
  };

  const handleAgentSessionSelect = async (sessionId: string) => {
    try {
      setLoadingAgentSessionId(sessionId);
      await loadAgentSession(sessionId);
      removeComponent('history-panel');
    } catch (error) {
      console.error('Failed to resume session:', error);
    } finally {
      setLoadingAgentSessionId(null);
    }
  };
  // Fetch last 100 sessions with SWR (cached + auto-refresh)
  const { sessions: allAgentSessions, isLoading, isError, error } = useAgentSessionHistory(100);
  
  // Filters (client-side)
  const [searchQuery, setSearchQuery] = useState('');
  const [agentNameFilter, setAgentNameFilter] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Apply filters client-side (fast on 100 items)
  const filteredAgentSessions = useMemo(() => {
    let filtered = allAgentSessions;

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((session) =>
        session.title?.toLowerCase().includes(query)
      );
    }

    // Agent name filter
    if (agentNameFilter.trim()) {
      filtered = filtered.filter(
        (session) => session.agentName === agentNameFilter.trim()
      );
    }

    // Date range filters
    if (startDate) {
      filtered = filtered.filter(
        (session) => new Date(session.createdAt) >= startDate
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1); // Include entire end date
      filtered = filtered.filter(
        (session) => new Date(session.createdAt) < end
      );
    }

    return filtered;
  }, [allAgentSessions, searchQuery, agentNameFilter, startDate, endDate]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const content = (
    <div className={`h-full flex flex-col ${isStandalone ? 'lg:flex-row gap-6' : ''}`}>
      {/* Column 1: Search and Filters */}
      <div className="w-[340px]">
        {/* Title Search */}
        <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-2">
          <Label htmlFor="searchQuery">Search Title</Label>
          <Input
            id="searchQuery"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Agent Name Filter */}
        <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-2">
          <Label htmlFor="agentName">Agent Name</Label>
          <Input
            id="agentName"
            placeholder="Filter by agent name..."
            value={agentNameFilter}
            onChange={(e) => setAgentNameFilter(e.target.value)}
          />
        </div>

        {/* Date Range Filters */}
        <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-2">
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-xs h-8"
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {startDate ? startDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Start'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-xs h-8"
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {endDate ? endDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'End'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchQuery || agentNameFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setAgentNameFilter('');
              setStartDate(undefined);
              setEndDate(undefined);
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Column 2: Sessions List */}
      <div className="flex-1 overflow-y-auto lg:break-inside-avoid-column flex flex-col gap-3">
        <Label>Recent Sessions</Label>
        
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <ThreeDotsScaleMiddleIcon size={32} className="text-muted-foreground" />
          </div>
        ) : (isError) && (
          <div className="flex-1 flex justify-center items-center text-center text-xs text-red-500">
            {error?.message || 'Failed to load sessions'}
          </div>
        )}

        {!isLoading && !isError && filteredAgentSessions.length === 0 && (
          <div className="flex-1 flex justify-center items-center text-center text-xs text-muted-foreground">
            No sessions found
          </div>
        )}

        {!isLoading && !isError && filteredAgentSessions.length > 0 && (
          <ScrollArea className={isStandalone ? "max-h-[400px]" : "" }>
            <div className="flex flex-col gap-2">
              {filteredAgentSessions.map((session) => {
                const isActive = currentSessionId ? session.id === currentSessionId : false;
                const isAgentSessionLoading = loadingAgentSessionId === session.id;
                return (
              <button
                key={session.id}
                onClick={() => !isActive && !isAgentSessionLoading && handleAgentSessionSelect(session.id)}
                disabled={isActive || isAgentSessionLoading}
                className={`
                  w-full text-left p-4 rounded-lg
                  border-2 transition-colors duration-150
                  ${
                    isActive
                      ? 'border-green-700 bg-surface-2/50 !cursor-default'
                      : 'border-border-subtle bg-surface-1 hover:bg-surface-2 cursor-pointer group'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <div className={`text-sm truncate transition-colors ${
                      isActive
                        ? 'text-muted-foreground'
                        : 'text-foreground group-hover:text-primary'
                    }`}>
                      {session.title || 'Untitled Session'}
                      {isActive && <span className="ml-2 text-xs text-primary">(Active)</span>}
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[0.65rem] text-muted-foreground leading-tight">
                      <span className="truncate max-w-[80px]">{session.agentName}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{session.turnsCount} {session.turnsCount === 1 ? 'turn' : 'turns'}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap" title={`Created: ${formatDate(session.createdAt)}`}>
                        Created {formatRelativeTime(session.createdAt)}
                      </span>
                      <span>•</span>
                      <span className="whitespace-nowrap" title={`Updated: ${formatDate(session.updatedAt)}`}>
                        Updated {formatRelativeTime(session.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Arrow Icon or Spinner */}
                  {!isActive && (
                  <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                    {isAgentSessionLoading ? (
                      <ThreeDotsScaleMiddleIcon size={20} className="text-primary" />
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                  )}
                </div>
              </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );

  return (
    <Card className={isStandalone ? "w-md min-w-[320px] lg:h-[78vh] lg:w-full" : "w-full border-none shadow-none bg-transparent"}>
      <CardHeader>
        <CardTitle>Session History</CardTitle>
        <CardDescription>Browse and resume your past conversations</CardDescription>
        <CardAction>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </CardAction>
      </CardHeader>

      <CardContent className={`h-full`}>
        {content}
      </CardContent>
    </Card>
  );
}
