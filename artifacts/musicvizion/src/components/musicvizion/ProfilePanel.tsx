import { useState } from 'react';

export type Profile = { id: string; name: string; notes: string[] };

export interface ProfilePanelProps {
  profiles: Profile[];
  activeId: string;
  onChange: (profiles: Profile[], activeId: string) => void;
}

const MAX_PROFILES = 8;
const MAX_NOTES = 24;
const MAX_NOTE_LEN = 120;
const MAX_NAME_LEN = 40;

function clean(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function newId(): string {
  const c = globalThis.crypto;
  return c && 'randomUUID' in c ? c.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProfilePanel({ profiles, activeId, onChange }: ProfilePanelProps) {
  const active = profiles.find(p => p.id === activeId) ?? profiles[0];
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteVal, setNoteVal] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [error, setError] = useState('');

  if (!active) return null;

  const nameTaken = (name: string, exceptId?: string) =>
    profiles.some(p => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());

  function validateName(raw: string, exceptId?: string): string | null {
    const n = clean(raw);
    if (!n) { setError('Name cannot be empty.'); return null; }
    if (n.length > MAX_NAME_LEN) { setError(`Name must be ${MAX_NAME_LEN} characters or fewer.`); return null; }
    if (nameTaken(n, exceptId)) { setError('A profile with that name already exists.'); return null; }
    setError('');
    return n;
  }

  function validateNote(raw: string, skip?: number): string | null {
    const n = clean(raw);
    if (!n) { setError('Note cannot be empty.'); return null; }
    if (n.length > MAX_NOTE_LEN) { setError(`Note must be ${MAX_NOTE_LEN} characters or fewer.`); return null; }
    if (active.notes.some((x, i) => i !== skip && x.toLowerCase() === n.toLowerCase())) { setError('That note already exists.'); return null; }
    setError('');
    return n;
  }

  const updateActive = (notes: string[]) =>
    onChange(profiles.map(p => (p.id === active.id ? { ...p, notes } : p)), active.id);

  function create() {
    if (profiles.length >= MAX_PROFILES) { setError(`Maximum of ${MAX_PROFILES} profiles.`); return; }
    const n = validateName(newName);
    if (!n) return;
    const p: Profile = { id: newId(), name: n, notes: [] };
    setNewName(''); setRenaming(false); setConfirmDelete(false); setEditIdx(null);
    onChange([...profiles, p], p.id);
  }

  function rename() {
    const n = validateName(renameVal, active.id);
    if (!n) return;
    setRenaming(false);
    onChange(profiles.map(p => (p.id === active.id ? { ...p, name: n } : p)), active.id);
  }

  function remove() {
    if (profiles.length <= 1) { setError('At least one profile must remain.'); setConfirmDelete(false); return; }
    const rest = profiles.filter(p => p.id !== active.id);
    setConfirmDelete(false); setError('');
    onChange(rest, rest[0].id);
  }

  function addNote() {
    if (active.notes.length >= MAX_NOTES) { setError(`Maximum of ${MAX_NOTES} notes per profile.`); return; }
    const n = validateNote(noteVal);
    if (!n) return;
    setNoteVal('');
    updateActive([...active.notes, n]);
  }

  function saveEdit() {
    if (editIdx === null) return;
    const n = validateNote(editVal, editIdx);
    if (!n) return;
    updateActive(active.notes.map((x, i) => (i === editIdx ? n : x)));
    setEditIdx(null);
  }

  function select(id: string) {
    setError(''); setRenaming(false); setConfirmDelete(false); setEditIdx(null);
    onChange(profiles, id);
  }

  return (
    <section className="mvp-panel" aria-label="Listening profiles" data-testid="panel-profiles">
      <div className="mvp-kicker">PROFILES · {profiles.length}/{MAX_PROFILES}</div>
      <h3 className="mvp-title">Listening profile</h3>

      <div className="mvp-tabs" role="group" aria-label="Switch profile">
        {profiles.map(p => (
          <button key={p.id} type="button" className="mvp-tab" aria-pressed={p.id === active.id} onClick={() => select(p.id)} data-testid={`button-profile-${p.id}`}>
            {p.name}
          </button>
        ))}
      </div>

      {renaming ? (
        <form className="mvp-row" onSubmit={e => { e.preventDefault(); rename(); }}>
          <input className="mvp-input" value={renameVal} maxLength={MAX_NAME_LEN} onChange={e => setRenameVal(e.target.value)} aria-label="New profile name" autoFocus data-testid="input-rename-profile" />
          <button type="submit" className="mvp-btn primary" data-testid="button-save-rename">Save name</button>
          <button type="button" className="mvp-btn" onClick={() => { setRenaming(false); setError(''); }} data-testid="button-cancel-rename">Cancel</button>
        </form>
      ) : (
        <div className="mvp-row">
          <button type="button" className="mvp-btn" onClick={() => { setRenameVal(active.name); setRenaming(true); setConfirmDelete(false); setError(''); }} data-testid="button-rename-profile">Rename</button>
          <button type="button" className="mvp-btn danger" disabled={profiles.length <= 1} onClick={() => setConfirmDelete(true)} data-testid="button-delete-profile">Delete profile</button>
        </div>
      )}

      {confirmDelete && (
        <div className="mvp-confirm" role="alertdialog" aria-label="Confirm profile deletion" data-testid="confirm-delete-profile">
          Delete “{active.name}” and its {active.notes.length} note{active.notes.length === 1 ? '' : 's'} from this device?
          <div className="mvp-row">
            <button type="button" className="mvp-btn danger" onClick={remove} autoFocus data-testid="button-confirm-delete-profile">Delete</button>
            <button type="button" className="mvp-btn" onClick={() => setConfirmDelete(false)} data-testid="button-cancel-delete-profile">Keep</button>
          </div>
        </div>
      )}

      <form className="mvp-row" onSubmit={e => { e.preventDefault(); create(); }}>
        <input className="mvp-input" value={newName} maxLength={MAX_NAME_LEN} onChange={e => setNewName(e.target.value)} placeholder="New profile name" aria-label="New profile name" disabled={profiles.length >= MAX_PROFILES} data-testid="input-new-profile" />
        <button type="submit" className="mvp-btn primary" disabled={profiles.length >= MAX_PROFILES} data-testid="button-create-profile">Create</button>
      </form>

      <div className="mvp-kicker" style={{ marginTop: 18 }}>NOTES · {active.notes.length}/{MAX_NOTES}</div>
      <form className="mvp-row" onSubmit={e => { e.preventDefault(); addNote(); }}>
        <input className="mvp-input" value={noteVal} maxLength={MAX_NOTE_LEN} onChange={e => setNoteVal(e.target.value)} placeholder="A listening note" aria-label="Add a listening note" disabled={active.notes.length >= MAX_NOTES} data-testid="input-new-note" />
        <button type="submit" className="mvp-btn primary" disabled={active.notes.length >= MAX_NOTES} data-testid="button-add-note">Add note</button>
      </form>
      <div className="mvp-hint">{noteVal.length}/{MAX_NOTE_LEN} characters</div>

      {error && <p className="mvp-error" role="alert" data-testid="status-profile-error">{error}</p>}

      {active.notes.length === 0 ? (
        <p className="mvp-empty" data-testid="text-empty-notes">No notes in this profile yet.</p>
      ) : (
        <ul className="mvp-notes">
          {active.notes.map((note, i) => (
            <li className="mvp-note" key={`${i}-${note}`} data-testid={`note-${i}`}>
              {editIdx === i ? (
                <>
                  <input className="mvp-input" value={editVal} maxLength={MAX_NOTE_LEN} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditIdx(null); setError(''); } }} aria-label={`Edit note ${i + 1}`} autoFocus data-testid={`input-edit-note-${i}`} />
                  <button type="button" className="mvp-btn primary" onClick={saveEdit} data-testid={`button-save-note-${i}`}>Save</button>
                  <button type="button" className="mvp-btn" onClick={() => { setEditIdx(null); setError(''); }} data-testid={`button-cancel-note-${i}`}>Cancel</button>
                </>
              ) : (
                <>
                  <span>{note}</span>
                  <button type="button" className="mvp-btn" onClick={() => { setEditIdx(i); setEditVal(note); setError(''); }} aria-label={`Edit note ${i + 1}`} data-testid={`button-edit-note-${i}`}>Edit</button>
                  <button type="button" className="mvp-btn danger" onClick={() => {
                    if (window.confirm(`Delete this note from "${active.name}" on this device? There is no cloud backup.\n\n${note}`)) updateActive(active.notes.filter((_, k) => k !== i));
                  }} aria-label={`Delete note ${i + 1}`} data-testid={`button-delete-note-${i}`}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mvp-limits" data-testid="text-storage-limits">
        Profiles and notes are kept in this browser on this device. They do not sync and can be lost if you clear site data or use private browsing. Opening Grok cost review sends the displayed text and feature summary to this app's server; sharing with a paid provider is disabled. These are plain text preferences, not evidence of AI consciousness.
      </p>
    </section>
  );
}

export default ProfilePanel;
