import 'server-only';
import { db } from './server';
import { sharedToTemplate, templateBySlug, type SharedIdea, type TripTemplate } from '@/data/templates';

/** A trip idea by slug: one of the ready-made ones, or "g-<id>" for one a group shared. */
export async function ideaBySlug(slug: string): Promise<TripTemplate | null> {
  if (!slug.startsWith('g-')) return templateBySlug(slug);
  const id = slug.slice(2);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from('trip_ideas').select('id,data').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return sharedToTemplate(data.id, data.data as SharedIdea);
}

/** The most recent trips groups shared. */
export async function sharedIdeas(limit = 30): Promise<TripTemplate[]> {
  const { data, error } = await db().from('trip_ideas').select('id,data').order('created_at', { ascending: false }).limit(limit);
  if (error) return [];
  return (data || []).map((r) => sharedToTemplate(r.id, r.data as SharedIdea));
}
