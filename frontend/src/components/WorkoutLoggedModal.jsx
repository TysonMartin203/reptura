import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { displayWeight, weightUnitLabel } from '../units';
import { IconTrophy, IconCheck } from './Icons';

// Shown on Past Workouts right after a workout is logged (or done again), so
// the moment of "new PR" gets its own spotlight instead of a banner at the
// bottom of a form you're about to leave.
//
// summary = { name, exerciseCount, photoCount, prResults, photoError }
export default function WorkoutLoggedModal({ summary, onClose }) {
  const { user } = useAuth();
  if (!summary) return null;

  const newPRs = (summary.prResults || []).filter(p => p.isNewPR);
  const unit = weightUnitLabel(user?.weightUnit);

  function fmt(value, prUnit) {
    if (value == null) return '';
    if (prUnit === 'lbs') return `${displayWeight(value, user?.weightUnit)} ${unit}`;
    if (prUnit === 'reps') return `${value} reps`;
    return String(value);
  }

  return createPortal(
    <div onClick={onClose}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{width:'100%',maxWidth:'380px',maxHeight:'85vh',overflowY:'auto',borderRadius:'16px',background:'var(--surface)',padding:'22px',boxShadow:'var(--shadow-lg)',textAlign:'center'}}>

        <div style={{width:'52px',height:'52px',borderRadius:'50%',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center',
          background: newPRs.length ? 'rgba(224,122,95,0.15)' : 'rgba(123,167,160,0.18)'}}>
          {newPRs.length
            ? <IconTrophy style={{width:'26px',height:'26px',color:'var(--accent)'}}/>
            : <IconCheck style={{width:'26px',height:'26px',color:'var(--teal)'}}/>}
        </div>

        <h3 style={{marginBottom:'4px'}}>
          {newPRs.length ? `${newPRs.length} new PR${newPRs.length === 1 ? '' : 's'}!` : 'Workout logged'}
        </h3>
        <p className="muted" style={{fontSize:'13px',marginBottom: newPRs.length ? '16px' : '18px'}}>
          {summary.name ? `${summary.name} · ` : ''}
          {summary.exerciseCount} exercise{summary.exerciseCount === 1 ? '' : 's'}
          {summary.photoCount > 0 ? ` · ${summary.photoCount} photo${summary.photoCount === 1 ? '' : 's'}` : ''}
        </p>

        {newPRs.length > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'18px',textAlign:'left'}}>
            {newPRs.map(p => (
              <div key={p.exercise} className="list-item" style={{margin:0,border:'1px solid rgba(224,122,95,0.3)',background:'rgba(224,122,95,0.08)'}}>
                <IconTrophy style={{width:'16px',height:'16px',color:'var(--accent)',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div className="item-main">{p.exercise}</div>
                  <div className="item-meta">
                    {p.previousMax != null ? `${fmt(p.previousMax, p.unit)} → ` : 'First record: '}
                    <strong style={{color:'var(--text)'}}>{fmt(p.newMax, p.unit)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {summary.photoError && (
          <p className="form-error" style={{fontSize:'12px',marginBottom:'14px',textAlign:'left'}}>{summary.photoError}</p>
        )}

        <button type="button" className="btn-primary" style={{width:'100%'}} onClick={onClose}>Done</button>
      </div>
    </div>,
    document.body
  );
}
