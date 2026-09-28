import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { today } from '../dateUtils';

// Logs a past workout again on a new date. The original is never changed —
// notes are either carried over, left blank, or written fresh for the new one.
export default function DuplicateWorkoutModal({ workoutId, workoutName, exerciseCount, onClose }) {
  const navigate = useNavigate();
  const [date, setDate] = useState(today());
  const [notesMode, setNotesMode] = useState('same');
  const [notesBefore, setNotesBefore] = useState('');
  const [notesAfter, setNotesAfter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true); setError('');
    try {
      const res = await api.duplicateWorkout(workoutId, { date, notesMode, notesBefore, notesAfter });
      onClose();
      // Same landing as logging a workout: Past Workouts, with the PR popup.
      navigate('/log/history', { state: { logged: {
        name: workoutName || null,
        exerciseCount: exerciseCount ?? 0,
        photoCount: 0,
        prResults: res.prResults || [],
        photoError: null,
      } } });
    } catch (err) { setError(err.message); setSaving(false); }
  }

  const OPTIONS = [
    { key: 'same', label: 'Keep the same notes' },
    { key: 'none', label: 'No notes' },
    { key: 'new',  label: 'Write new notes' },
  ];

  return createPortal(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,.55)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:'380px',maxHeight:'85vh',overflowY:'auto',borderRadius:'16px',background:'var(--surface)',padding:'20px',boxShadow:'var(--shadow-lg)'}} onClick={e=>e.stopPropagation()}>
        <h3 style={{marginBottom:'4px'}}>Do this workout again</h3>
        {workoutName && <p className="muted" style={{fontSize:'12px',marginBottom:'14px'}}>{workoutName}</p>}

        <div className="field">
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        </div>

        <div className="field">
          <label className="label">Notes</label>
          {OPTIONS.map(o => (
            <label key={o.key} className="list-item" style={{cursor:'pointer',marginBottom:'4px'}}>
              <div style={{flex:1}}><div className="item-main">{o.label}</div></div>
              <input type="radio" name="notesMode" checked={notesMode===o.key} onChange={()=>setNotesMode(o.key)}
                style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
            </label>
          ))}
        </div>

        {notesMode === 'new' && (
          <>
            <div className="field">
              <label className="label">Before</label>
              <textarea className="input" rows={2} value={notesBefore} onChange={e=>setNotesBefore(e.target.value)} placeholder="How you're feeling going in…" />
            </div>
            <div className="field">
              <label className="label">After</label>
              <textarea className="input" rows={2} value={notesAfter} onChange={e=>setNotesAfter(e.target.value)} placeholder="How it went…" />
            </div>
          </>
        )}

        {error && <p className="form-error" style={{fontSize:'12px'}}>{error}</p>}
        <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
          <button type="button" className="btn-primary" style={{flex:1}} disabled={saving} onClick={submit}>
            {saving ? 'Creating…' : 'Create Workout'}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
