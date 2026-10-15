export type LocalProfile = { id: string; name: string; notes: string[] };
export const profileStorageKey = 'musicvizion.profiles.v1';
export function validateProfiles(value: unknown): { profiles: LocalProfile[]; activeId: string } {
  const data = value as { profiles?: unknown; activeId?: unknown } | null;
  const profiles: LocalProfile[] = [];
  if (Array.isArray(data?.profiles)) for (const p of data.profiles.slice(0, 8)) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !p.name.trim() || profiles.some(item => item.id === p.id)) continue;
    profiles.push({ id: p.id.slice(0, 80), name: p.name.trim().slice(0, 40), notes: Array.isArray(p.notes) ? p.notes.filter((note: unknown): note is string => typeof note === 'string' && note.trim().length > 0).slice(0, 24).map((note: string) => note.slice(0, 120)) : [] });
  }
  if (!profiles.length) profiles.push({ id: 'first-companion', name: 'My listening companion', notes: [] });
  return { profiles, activeId: profiles.some(p => p.id === data?.activeId) ? data!.activeId as string : profiles[0].id };
}
export function readProfiles() {
  try {
    const saved = localStorage.getItem(profileStorageKey);
    if (saved) return validateProfiles(JSON.parse(saved));
    const legacy = JSON.parse(localStorage.getItem('musicvizion.preferences') || '[]');
    return validateProfiles({ profiles: [{ id: 'first-companion', name: 'My listening companion', notes: legacy }] });
  } catch { return validateProfiles(null); }
}
