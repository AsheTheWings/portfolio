/**
 * Server-side productivity handlers
 * Contains the actual implementation called by API routes
 */

import { createClient } from '@/lib/supabase/server';
import type { Slot } from '../core/types';

interface Workload {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateWorkloadRequest {
  name: string;
  description?: string;
}

interface StartSlotRequest {
  workload_name: string;
}

interface SlotStarted {
  id: string;
  workload_id: string;
  workload_name: string;
  start_time: string;
}

interface SlotStopped {
  id: string;
  end_time: string;
  duration: number;
}

interface SlotRow {
  id: string;
  workload_id: string;
  start_time: string;
  end_time?: string | null;
  workloads?: { name: string } | { name: string }[];
}

function toSlotDto(row: SlotRow): Slot {
  const endTime: string | null = row.end_time ?? null;
  const startTime: string = row.start_time;

  const duration = endTime
    ? Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
    : null;

  return {
    id: row.id,
    workload_id: row.workload_id,
    workload_name: Array.isArray(row.workloads) ? (row.workloads[0]?.name ?? 'Unknown') : (row.workloads?.name ?? 'Unknown'),
    start_time: startTime,
    end_time: endTime,
    duration,
    is_active: endTime === null,
  };
}

export class ProductivityHandlers {
  /**
   * List all workloads for a user
   */
  static async listWorkloads(userId: string): Promise<Workload[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workloads')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Create a new workload
   */
  static async createWorkload(
    userId: string,
    request: CreateWorkloadRequest
  ): Promise<Workload> {
    const { name, description } = request;

    if (!name || name.trim().length === 0) {
      throw new Error('Workload name is required');
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workloads')
      .insert([
        {
          userId: userId,
          name: name.trim(),
          description: description || null,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Workload "${name}" already exists`);
      }
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * List all slots for a user, optionally filtered by workload
   */
  static async listSlots(userId: string, workloadId: string | null): Promise<Slot[]> {
    const supabase = await createClient();

    let query = supabase
      .from('slots')
      .select('id, workload_id, userId, start_time, end_time, last_heartbeat, workloads(name)')
      .eq('userId', userId);

    if (workloadId) {
      query = query.eq('workload_id', workloadId);
    }

    const { data, error } = await query.order('start_time', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(toSlotDto);
  }

  /**
   * Get all active slots for a user
   */
  static async getActiveSlots(userId: string): Promise<Slot[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('slots')
      .select('id, workload_id, userId, start_time, end_time, last_heartbeat, workloads(name)')
      .eq('userId', userId)
      .is('end_time', null)
      .order('start_time', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(toSlotDto);
  }

  /**
   * Start a new slot for a workload
   */
  static async startSlot(userId: string, request: StartSlotRequest): Promise<SlotStarted> {
    const { workload_name } = request;

    if (!workload_name || workload_name.trim().length === 0) {
      throw new Error('Workload name is required');
    }

    const supabase = await createClient();

    // Find the workload by name
    const { data: workload, error: workloadError } = await supabase
      .from('workloads')
      .select('id, name')
      .eq('userId', userId)
      .ilike('name', workload_name.trim())
      .single();

    if (workloadError || !workload) {
      throw new Error(`No workload found with name "${workload_name}"`);
    }

    // Check if there's already an active slot for this workload
    const { data: activeSlot, error: activeSlotError } = await supabase
      .from('slots')
      .select('id')
      .eq('userId', userId)
      .eq('workload_id', workload.id)
      .is('end_time', null)
      .maybeSingle();

    if (activeSlotError) {
      throw new Error(activeSlotError.message);
    }

    if (activeSlot) {
      throw new Error(`Workload "${workload_name}" already has an active slot`);
    }

    // Create the new slot
    const now = new Date().toISOString();

    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .insert([
        {
          userId: userId,
          workload_id: workload.id,
          start_time: now,
          last_heartbeat: now,
        },
      ])
      .select()
      .single();

    if (slotError) {
      throw new Error(slotError.message);
    }

    return {
      id: slot.id,
      workload_id: slot.workload_id,
      workload_name: slot.workload_name,
      start_time: slot.start_time,
    };
  }

  /**
   * Stop a slot
   */
  static async stopSlot(userId: string, slotId: string): Promise<SlotStopped> {
    const supabase = await createClient();

    const now = new Date().toISOString();

    const { data: slot, error: fetchError } = await supabase
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .eq('userId', userId)
      .single();

    if (fetchError || !slot) {
      throw new Error('Slot not found');
    }

    if (slot.end_time) {
      throw new Error('Slot is already stopped');
    }

    const startTime = new Date(slot.start_time).getTime();
    const endTime = new Date(now).getTime();
    const duration = Math.floor((endTime - startTime) / 1000);

    const { data: updated, error: updateError } = await supabase
      .from('slots')
      .update({
        end_time: now,
      })
      .eq('id', slotId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      id: updated.id,
      end_time: updated.end_time,
      duration,
    };
  }

  /**
   * Stop all active slots for a user
   */
  static async stopAllSlots(userId: string): Promise<SlotStopped[]> {
    const supabase = await createClient();

    const { data: activeSlots, error: fetchError } = await supabase
      .from('slots')
      .select('*')
      .eq('userId', userId)
      .is('end_time', null);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!activeSlots || activeSlots.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const results: SlotStopped[] = [];

    for (const slot of activeSlots) {
      const startTime = new Date(slot.start_time).getTime();
      const endTime = new Date(now).getTime();
      const duration = Math.floor((endTime - startTime) / 1000);

      const { data: updated, error: updateError } = await supabase
        .from('slots')
        .update({
          end_time: now,
        })
        .eq('id', slot.id)
        .select()
        .single();

      if (!updateError && updated) {
        results.push({
          id: updated.id,
          end_time: updated.end_time,
          duration,
        });
      }
    }

    return results;
  }
}
