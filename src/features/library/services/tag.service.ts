/**
 * Tag Service - Handles tag CRUD and asset tagging operations
 */

import { createClient } from '@/lib/supabase/server';
import type { Tag } from '../types';

export class TagService {
  /**
   * Get or create tags by name
   */
  static async getOrCreateTags(userId: string, tagNames: string[]): Promise<Tag[]> {
    const supabase = await createClient();
    const tags: Tag[] = [];

    for (const tagName of tagNames) {
      const normalizedTag = tagName.trim().toLowerCase();
      if (!normalizedTag) continue;

      // Try to find existing tag
      const { data: existing } = await supabase
        .from('asset_tags')
        .select()
        .eq('user_id', userId)
        .eq('tag', normalizedTag)
        .single();

      if (existing) {
        tags.push(existing);
      } else {
        // Create new tag
        const { data: newTag, error } = await supabase
          .from('asset_tags')
          .insert({ user_id: userId, tag: normalizedTag })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create tag: ${error.message}`);
        }
        tags.push(newTag);
      }
    }

    return tags;
  }

  /**
   * Set tags for an asset (replace all)
   */
  static async setAssetTags(
    userId: string,
    assetId: string,
    tagNames: string[]
  ): Promise<Tag[]> {
    const supabase = await createClient();

    // Delete existing tags
    await supabase
      .from('asset_item_tags')
      .delete()
      .eq('asset_id', assetId);

    if (tagNames.length === 0) {
      return [];
    }

    // Get or create tags
    const tags = await TagService.getOrCreateTags(userId, tagNames);

    // Link tags to asset
    const { error } = await supabase
      .from('asset_item_tags')
      .insert(tags.map(t => ({ asset_id: assetId, tag_id: t.id })));

    if (error) {
      throw new Error(`Failed to set asset tags: ${error.message}`);
    }

    return tags;
  }

  /**
   * List all tags for a user
   */
  static async listTags(userId: string): Promise<Tag[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('asset_tags')
      .select()
      .eq('user_id', userId)
      .order('tag', { ascending: true });

    if (error) {
      throw new Error(`Failed to list tags: ${error.message}`);
    }

    return data || [];
  }
}
