import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { today, formatDateStr } from '../dateUtils';
import TimeInput from './TimeInput';

// A generous set of common personal fitness milestones — quick-pick templates
// that fill in type/exercise/target so people don't have to configure these by hand.
const PERSONAL_TEMPLATES = [
  { title: 'Bench Press 135', type: 'reach_weight', exercise: 'Bench Press', targetValue: 135 },
  { title: 'Bench Press 225', type: 'reach_weight', exercise: 'Bench Press', targetValue: 225 },
  { title: 'Bench Press 315', type: 'reach_weight', exercise: 'Bench Press', targetValue: 315 },
  { title: 'Squat 225', type: 'reach_weight', exercise: 'Squat', targetValue: 225 },
  { title: 'Squat 315', type: 'reach_weight', exercise: 'Squat', targetValue: 315 },
  { title: 'Squat 405', type: 'reach_weight', exercise: 'Squat', targetValue: 405 },
  { title: 'Deadlift 315', type: 'reach_weight', exercise: 'Deadlift', targetValue: 315 },
  { title: 'Deadlift 405', type: 'reach_weight', exercise: 'Deadlift', targetValue: 405 },
  { title: 'Deadlift 500', type: 'reach_weight', exercise: 'Deadlift', targetValue: 500 },
  { title: 'Overhead Press 135', type: 'reach_weight', exercise: 'Overhead Press', targetValue: 135 },
  { title: '1 Pull-Up', type: 'reach_reps', exercise: 'Pull-Up', targetValue: 1 },
  { title: '10 Pull-Ups', type: 'reach_reps', exercise: 'Pull-Up', targetValue: 10 },
  { title: '20 Pull-Ups', type: 'reach_reps', exercise: 'Pull-Up', targetValue: 20 },
  { title: '50 Push-Ups', type: 'reach_reps', exercise: 'Push-Up', targetValue: 50 },
  { title: '100 Push-Ups', type: 'reach_reps', exercise: 'Push-Up', targetValue: 100 },
  { title: '6 Minute Mile', type: 'reach_pace', exercise: 'Running', targetValue: 360 },
  { title: '7 Minute Mile', type: 'reach_pace', exercise: 'Running', targetValue: 420 },
  { title: '8 Minute Mile', type: 'reach_pace', exercise: 'Running', targetValue: 480 },
  { title: 'Run a 5K (3.1 mi)', type: 'reach_distance', exercise: 'Running', targetValue: 3.1 },
  { title: 'Run a 10K (6.2 mi)', type: 'reach_distance', exercise: 'Running', targetValue: 6.2 },
  { title: 'Run a Half Marathon', type: 'reach_distance', exercise: 'Running', targetValue: 13.1 },
  { title: 'Bike 25 Miles', type: 'reach_distance', exercise: 'Biking', targetValue: 25 },
  { title: 'Bike 50 Miles', type: 'reach_distance', exercise: 'Biking', targetValue: 50 },
  { title: 'Bike Century Ride (100 mi)', type: 'reach_distance', exercise: 'Biking', targetValue: 100 },
];

function formatPaceSec(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function PersonalGoals() {
  const [goals, setGoals] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title:'', type:'reach_weight', exercise:'', targetValue:'', startDate: today(), endDate: today() });
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { reload(); }, []);

  function reload() {
    api.getChallenges().then(list => setGoals(list.filter(c => c.visibility === 'personal'))).catch(console.error);
  }

  async function createGoal(e) {
    e.preventDefault(); setError('');
    try {
      await api.createChallenge({ ...form, visibility: 'personal' });
      setShowNew(false);
      setForm({ title:'', type:'reach_weight', exercise:'', targetValue:'', startDate: today(), endDate: today() });
      reload();
    } catch (err) { setError(err.message); }
  }

  function applyTemplate(t) {
    setForm(f => ({ ...f, title: t.title, type: t.type, exercise: t.exercise, targetValue: t.targetValue }));
  }

  const [viewingGoal, setViewingGoal] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [progressError, setProgressError] = useState('');

  async function viewGoal(id) {
    setViewingGoal(id);
    setProgressData(null);
    setProgressError('');
    try {
      const data = await api.getChallengeProgress(id);
      setProgressData(data);
    } catch (err) { setProgressError(err.message); }
  }

  // Personal goals are always your own, so the delete is always available.
  async function removeGoal(id) {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    setError('');
    try {
      await api.deleteChallenge(id);
      if (viewingGoal === id) setViewingGoal(null);
      reload();
    } catch (err) { setError(err.message); }
  }

  return (
    <section className="section">
      <div className="section-header">
        <span className="section-title">Personal Goals</span>
        <button className="link-small" style={{background:'none',border:'none',cursor:'pointer'}} onClick={()=>setShowNew(s=>!s)}>{showNew ? 'Cancel' : '+ New'}</button>
      </div>

      {error && !showNew && <p className="form-error" style={{marginBottom:'10px'}}>{error}</p>}

      {viewingGoal ? (
        <div className="card-form">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <button className="btn-ghost-sm" onClick={()=>setViewingGoal(null)}>← Back to goals</button>
            <button className="btn-ghost-sm" style={{color:'var(--danger)'}} onClick={()=>removeGoal(viewingGoal)}>Delete</button>
          </div>
          {progressError ? <p className="form-error">{progressError}</p> : !progressData ? <div className="spinner"/> : (
            <>
              <div style={{fontWeight:'700',fontSize:'16px',marginBottom:'4px'}}>{progressData.title}</div>
              <p className="muted" style={{fontSize:'12px',marginBottom:'14px'}}>Goal by {formatDateStr(progressData.end_date)}</p>
              {progressData.leaderboard.map(r => (
                <div key={r.id} className="list-item" style={{marginBottom:'6px'}}>
                  <span className="item-accent">
                    {r.progress == null ? 'No attempts yet' : progressData.unit?.startsWith('sec/mi') ? `${formatPaceSec(r.progress)}/mi` : `${r.progress.toLocaleString()} ${progressData.unit}`}
                    {r.reached && <span style={{marginLeft:'6px',color:'var(--teal)'}}>✓ Reached!</span>}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <>
          {showNew && (
            <div className="card-form">
              <form onSubmit={createGoal} className="form-stack">
                <div className="field">
                  <button type="button" className="btn-secondary" onClick={()=>setShowTemplates(s=>!s)}>
                    {showTemplates ? 'Hide Quick Picks' : 'Quick Pick a Goal'}
                  </button>
                  {showTemplates && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginTop:'10px'}}>
                      {PERSONAL_TEMPLATES.map(t => (
                        <button key={t.title} type="button" className="btn-ghost-sm" onClick={()=>{applyTemplate(t); setShowTemplates(false);}} style={{fontSize:'12px'}}>
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label className="label">Title</label>
                  <input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Bench Press 225" required />
                </div>

                <div className="field">
                  <label className="label">Type</label>
                  <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,exercise:'',targetValue:''}))}>
                    <option value="reach_weight">Reach a weight on a lift</option>
                    <option value="reach_reps">Reach a rep count</option>
                    <option value="reach_pace">Reach a running pace</option>
                    <option value="reach_distance">Reach a distance in one outing</option>
                  </select>
                </div>

                {(form.type === 'reach_weight' || form.type === 'reach_reps') && (
                  <div className="field">
                    <label className="label">Exercise</label>
                    <input className="input" value={form.exercise} onChange={e=>setForm(f=>({...f,exercise:e.target.value}))} placeholder={form.type==='reach_weight' ? 'Squat' : 'Push-Up'} required />
                  </div>
                )}
                {(form.type === 'reach_distance' || form.type === 'reach_pace') && (
                  <div className="field">
                    <label className="label">Activity</label>
                    <select className="input" value={form.exercise} onChange={e=>setForm(f=>({...f,exercise:e.target.value}))} required>
                      <option value="" disabled>Choose an activity</option>
                      {['Running','Walking','Biking','Swimming','Rowing','Hiking'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}

                {(form.type === 'reach_weight' || form.type === 'reach_reps' || form.type === 'reach_distance') && (
                  <div className="field">
                    <label className="label">{form.type==='reach_weight' ? 'Target weight (lbs)' : form.type==='reach_reps' ? 'Target reps' : 'Target distance (mi)'}</label>
                    <input className="input" type="number" min="0" step={form.type==='reach_distance' ? '0.1' : '1'}
                      value={form.targetValue} onChange={e=>setForm(f=>({...f,targetValue:e.target.value}))} required />
                  </div>
                )}
                {form.type === 'reach_pace' && (
                  <div className="field">
                    <label className="label">Target pace (per mile)</label>
                    <TimeInput minutesDecimal={form.targetValue ? form.targetValue/60 : ''} onChange={mins => setForm(f=>({...f,targetValue: mins===''?'':Math.round(mins*60)}))} />
                  </div>
                )}

                <div className="field">
                  <label className="label">Goal date</label>
                  <input className="input" type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} required/>
                </div>
                {error && <p className="form-error">{error}</p>}
                <button className="btn-primary" type="submit">Create Goal</button>
              </form>
            </div>
          )}

          {goals.length === 0 && !showNew && <p className="muted" style={{fontSize:'13px'}}>No personal goals yet. Start one above.</p>}
          {goals.map(g => (
            <div key={g.id} className="glass-card clickable" style={{marginBottom:'10px',cursor:'pointer'}} onClick={()=>viewGoal(g.id)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:'700',fontSize:'14px'}}>{g.title}</div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>Goal by {formatDateStr(g.end_date)}</div>
                </div>
                <button className="btn-ghost-sm" style={{color:'var(--danger)',flexShrink:0}}
                  onClick={(e)=>{e.stopPropagation();removeGoal(g.id);}}>Delete</button>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
