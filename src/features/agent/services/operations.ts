/**
 * Agent Persistence Service (Event-Sourcing)
 * Handles database operations for agent sessions and events
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SessionMetadata,
  SessionEvent,
} from '../types';

// Database row interfaces
interface DBSession {
  id: string;
  userId: string;
  title?: string;
  title_locked: boolean;
  agent_name: string;
  root_session_id?: string | null;  // For branch tree tracking
  is_head?: boolean;                 // True for active tip of branch tree
  event_count: number;
  turns_count: number;
  createdAt: string;
  updatedAt: string;
}

interface DBSessionEvent {
  id: string;
  session_id: string;
  component_id: string;
  turn_id: string | null;
  sequence: number;
  event_type: string;
  role: 'user' | 'agent' | 'system';
  data: unknown;
  createdAt: string;
}

/**
 * Session operations (metadata only)
 */
export class SessionOperations {
  /**
   * Create new session
   */
  static async createSession(
    supabase: SupabaseClient,
    userId: string,
    session: SessionMetadata
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const dbSession: DBSession = {
      id: session.sessionId!,
      userId: userId,
      title: session.title,
      title_locked: false,
      agent_name: session.agentName,
      root_session_id: session.rootSessionId || null,
      is_head: true,  // New sessions are always head
      event_count: 0,
      turns_count: 0,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase
      .from('agent_sessions')
      .insert(dbSession);

    if (error) throw error;
  }

  /**
   * Update session metadata
   */
  static async updateSessionMetadata(
    supabase: SupabaseClient,
    sessionId: string,
    updates: Partial<Pick<DBSession, 'title' | 'title_locked' | 'agent_name' | 'event_count'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('agent_sessions')
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * List all sessions for a user with optional filters
   * Shows only head sessions (latest active in each branch tree)
   */
  static async listSessions(
    supabase: SupabaseClient,
    userId: string,
    filters?: {
      search?: string;
    }
  ): Promise<DBSession[]> {
    let query = supabase
      .from('agent_sessions')
      .select('*')
      .eq('userId', userId)
      .eq('is_head', true)
      .gt('event_count', 0)
      .order('updatedAt', { ascending: false });
    
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to list sessions:', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Load session metadata only
   */
  static async getSession(
    supabase: SupabaseClient,
    sessionId: string
  ): Promise<DBSession | null> {
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data;
  }
}

/**
 * Event operations (event-sourcing)
 */
export class EventOperations {
  /**
   * Store a single event (upsert with last-write-wins)
   */
  static async storeEvent(
    supabase: SupabaseClient,
    sessionId: string,
    componentId: string,
    event: SessionEvent
  ): Promise<void> {
    const persistableEvent = event;

    const DBSessionEvent: Omit<DBSessionEvent, 'createdAt'> = {
      id: persistableEvent.eventId,
      session_id: sessionId,
      component_id: componentId,
      turn_id: persistableEvent.turnId || null,
      sequence: persistableEvent.sequence,
      event_type: persistableEvent.type,
      role: persistableEvent.role,
      data: persistableEvent.data,
    };

    const { error } = await supabase
      .from('agent_session_events')
      .upsert(DBSessionEvent, {
        onConflict: 'id',
        ignoreDuplicates: false,  // Last-write-wins: ensure DB matches this state
      });

    if (error) throw error;
  }

  /**
   * Store multiple events (batch upsert with last-write-wins)
   * Syncs entire event array to database - idempotent and crash-safe
   */
  static async storeEvents(
    supabase: SupabaseClient,
    sessionId: string,
    events: Array<{ componentId: string; event: SessionEvent }>
  ): Promise<void> {
    if (!events.length) return;

    const DBSessionEvents: Omit<DBSessionEvent, 'createdAt'>[] = events.map(({ componentId, event }) => ({
      id: event.eventId,
      session_id: sessionId,
      component_id: componentId,
      turn_id: event.turnId || null,
      sequence: event.sequence,
      event_type: event.type,
      role: event.role,
      data: event.data,
    }));

    // UPSERT: Last-write-wins semantics
    // - Idempotent: Safe to call repeatedly with same data
    // - Crash-safe: Partial progress is saved on each call
    // - Retry-safe: Network failures automatically recovered on next sync
    const { error } = await supabase
      .from('agent_session_events')
      .upsert(DBSessionEvents, {
        onConflict: 'id',
        ignoreDuplicates: false,  // Update to ensure DB matches in-memory state
      });

    if (error) throw error;
  }

  /**
   * Load all events for a session
   */
  static async loadSessionEvents(
    supabase: SupabaseClient,
    sessionId: string
  ): Promise<SessionEvent[]> {
    const { data, error } = await supabase
      .from('agent_session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence', { ascending: true });

    if (error) {
      console.error('Failed to load events:', error);
      throw error;
    }

    return (data || []).map(convertRowToEvent);
  }

  /**
   * Load events for a specific component
   */
  static async loadComponentEvents(
    supabase: SupabaseClient,
    componentId: string
  ): Promise<SessionEvent[]> {
    const { data, error } = await supabase
      .from('agent_session_events')
      .select('*')
      .eq('component_id', componentId)
      .order('sequence', { ascending: true });

    if (error) {
      console.error('Failed to load component events:', error);
      throw error;
    }

    return (data || []).map(convertRowToEvent);
  }

  /**
   * Load events by type across ALL user sessions (unified API)
   * Returns raw SessionEvent[] - consumer handles extraction
   */
  static async loadEventsByType(
    supabase: SupabaseClient,
    userId: string,
    options: {
      type: 'tool-result' | 'tool-effects';
      server?: string;
      limit?: number;
    }
  ): Promise<SessionEvent[]> {
    const { type, server, limit = 1000 } = options;

    // Build query for events across ALL user sessions
    let query = supabase
      .from('agent_session_events')
      .select(`
        id,
        session_id,
        component_id,
        turn_id,
        sequence,
        event_type,
        role,
        data,
        createdAt,
        agent_sessions!inner(userId)
      `)
      .eq('agent_sessions.userId', userId)
      .eq('event_type', type)
      .order('createdAt', { ascending: false })
      .limit(limit);

    // Filter by server if specified
    if (server) {
      query = query.eq('data->>server', server);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Failed to load ${type} events:`, error);
      throw error;
    }

    // Return raw SessionEvent format
    return (data || []).map(row => ({
      type: row.event_type,
      eventId: row.id,
      componentId: row.component_id,
      turnId: row.turn_id || '',
      role: row.role,
      sequence: row.sequence,
      timestamp: new Date(row.createdAt),
      data: row.data,
    } as SessionEvent));
  }
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Convert database row to SessionEvent
 */
function convertRowToEvent(row: DBSessionEvent): SessionEvent {
  return {
    type: row.event_type,
    eventId: row.id,
    componentId: row.component_id,
    turnId: row.turn_id || '',
    role: row.role,
    sequence: row.sequence,
    timestamp: new Date(row.createdAt),
    data: row.data,
  } as SessionEvent;
}
