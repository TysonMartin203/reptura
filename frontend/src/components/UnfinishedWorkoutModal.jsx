import { createPortal } from 'react-dom';
import { formatDateStr } from '../dateUtils';

// Shown when opening Log Workout while an earlier workout was started but never
// logged. Deliberately has no "close" — one of the two choices has to be made,
// so a stale draft can't hang around unnoticed.
export default function UnfinishedWorkoutModal({ draft, updatedAt, startingFresh, onFinish, onDiscard, busy }) {
  const exercises = (draft?.exercises || []).filter(e => e.exerciseName || e.customName);
  const names = exercises.slice(0, 3).map(e => e.exerciseName === 'Other' ? (e.customName || 'Other') : e.exerciseName);
  const more = exercises.length - names.length;

  let when = null;
  if (updatedAt) {
    const d = new Date(String(updatedAt).replace(' ', 'T') + (String(updatedAt).endsWith('Z') ? '' : 'Z'));
    if (!Number.isNaN(d.getTime())) {
      const mins = Math.round((Date.now() - d.getTime()) / 60000);
      when = mins < 60 ? `${Math.max(1, mins)} min ago`
        : mins < 60 * 24 ? `${Math.round(mins / 60)} hr ago`
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div role="dialog" aria-modal="true"
        style={{width:'100%',maxWidth:'380px',borderRadius:'16px',background:'var(--surface)',padding:'22px',boxShadow:'var(--shadow-lg)'}}>
        <h3 style={{marginBottom:'6px'}}>You never logged your last workout</h3>
        <p className="muted" style={{fontSize:'13px',marginBottom:'14px'}}>Want to finish it now?</p>

        <div className="list-item" style={{margin:'0 0 16px',flexDirection:'column',alignItems:'flex-start',gap:'2px'}}>
          <div className="item-main">{draft?.name || 'Untitled workout'}</div>
          <div className="item-meta">
            {[
              exercises.length ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}` : null,
              draft?.date ? `for ${formatDateStr(draft.date)}` : null,
              when ? `last edited ${when}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
          {names.length > 0 && (
            <div className="item-meta" style={{marginTop:'2px'}}>{names.join(', ')}{more > 0 ? ` +${more} more` : ''}</div>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <button type="button" className="btn-primary" onClick={onFinish} disabled={busy}>Yes, finish that one</button>
          <button type="button" className="btn-ghost" onClick={onDiscard} disabled={busy} style={{color:'var(--danger)'}}>
            {busy ? 'Discarding…' : startingFresh ? 'No, discard it and start this one' : 'No, discard it'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
