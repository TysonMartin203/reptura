import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import WorkoutPlanIcon from '../components/WorkoutPlanIcons';
import { IconSparkle, IconEdit, IconStar, IconSleep } from '../components/Icons';
import { formatDuration } from '../format';
import ProfileGateModal from '../components/ProfileGateModal';

const GOALS = ['Cut (Lose Fat)', 'Bulk (Gain Muscle)', 'Maintain', 'Recomp'];

function toFormExercise(ex) {
  if (ex.category === 'cardio') {
    return {
      category: 'cardio', exerciseName: ex.exerciseName, notes: ex.notes || '',
      durationMinutes: ex.durationMinutes || '', distance: '', distanceUnit: 'mi',
      calories: '', avgHeartRate: '', pace: '',
    };
  }
  return {
    category: 'lifting', exerciseName: ex.exerciseName,
    notes: '',
    sets: ex.sets || '', reps: '', weight: '', perSetWeights: false, setsData: [],
  };
}

const infoCache = {}; // exerciseName -> fetched description, shared across rows for this session

function ExerciseRow({ ex, planId, dayIdx, exIdx, onSwap }) {
  const [showPanel, setShowPanel] = useState(false);
  const [detail, setDetail] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [info, setInfo] = useState(infoCache[ex.exerciseName] || null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(ex.exerciseName);
  const [editSets, setEditSets] = useState(ex.sets || '');
  const [editReps, setEditReps] = useState(ex.reps || '');
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveEdit() {
    setSavingEdit(true);
    try {
      const res = await api.editPlanExercise({
        exerciseName: editName.trim(), sets: editSets, reps: editReps, category: ex.category,
        planId, dayIdx, exIdx,
      });
      onSwap(res.exercise);
      setShowEdit(false);
    } catch { /* leave panel open so they can retry */ }
    finally { setSavingEdit(false); }
  }

  async function doSwap(reason, val) {
    setSwapping(true);
    try {
      const res = await api.swapPlanExercise({
        exerciseName: ex.exerciseName, category: ex.category, sets: ex.sets, reps: ex.reps, reason, detail: val,
        planId, dayIdx, exIdx,
      });
      onSwap(res.exercise);
      setShowPanel(false); setDetail(''); setInfo(null); setShowInfo(false);
    } catch { /* leave panel open so they can retry */ }
    finally { setSwapping(false); }
  }

  async function toggleInfo() {
    const next = !showInfo;
    setShowInfo(next);
    if (next && !info) {
      setLoadingInfo(true);
      try {
        const res = await api.exerciseInfo({ exerciseName: ex.exerciseName, category: ex.category });
        infoCache[ex.exerciseName] = res.info;
        setInfo(res.info);
      } catch { setInfo('Could not load details right now.'); }
      finally { setLoadingInfo(false); }
    }
  }

  return (
    <div className="list-item" style={{flexDirection:'column',alignItems:'stretch',gap:'6px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
        <div style={{flex:1,cursor:'pointer'}} onClick={toggleInfo}>
          <div className="item-main">{ex.exerciseName}</div>
          <div className="item-meta">
            {ex.category === 'cardio' ? (ex.durationMinutes ? formatDuration(ex.durationMinutes) : 'Cardio') : `${ex.sets} sets × ${ex.reps}`}
          </div>
        </div>
        <button className="btn-ghost-sm" disabled={savingEdit} onClick={()=>{setShowEdit(s=>!s); setShowPanel(false);}}>Edit</button>
        <button className="btn-ghost-sm" disabled={swapping} onClick={()=>{setShowPanel(s=>!s); setShowEdit(false);}}>{swapping?'…':'↔ Swap'}</button>
      </div>
      {showInfo && (
        <p className="muted" style={{fontSize:'13px',padding:'2px 2px 4px'}}>
          {loadingInfo ? 'Loading…' : info}
        </p>
      )}
      {showEdit && (
        <div style={{background:'var(--surface-tint)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px'}}>
          <div className="field" style={{marginBottom:'8px'}}>
            <label className="label">Exercise Name</label>
            <input className="input" value={editName} onChange={e=>setEditName(e.target.value)} style={{fontSize:'13px',padding:'9px 12px'}}/>
          </div>
          {ex.category === 'lifting' && (
            <div className="input-row" style={{marginBottom:'8px'}}>
              <div className="input-group">
                <label className="label">Sets</label>
                <input className="input" type="number" min="1" value={editSets} onChange={e=>setEditSets(e.target.value)} style={{fontSize:'13px',padding:'9px 12px'}}/>
              </div>
              <div className="input-group">
                <label className="label">Reps</label>
                <input className="input" placeholder="e.g. 10 or 8-12" value={editReps} onChange={e=>setEditReps(e.target.value)} style={{fontSize:'13px',padding:'9px 12px'}}/>
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn-accent-sm" style={{flex:1}} disabled={!editName.trim() || savingEdit} onClick={saveEdit}>{savingEdit?'Saving…':'Save'}</button>
            <button className="btn-ghost-sm" onClick={()=>setShowEdit(false)}>Cancel</button>
          </div>
        </div>
      )}
      {showPanel && (
        <div style={{background:'var(--surface-tint)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px'}}>
          <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
            <button className="btn-ghost-sm" style={{flex:1}} onClick={()=>doSwap('dislike',null)}>Don't want it</button>
            <button className="btn-ghost-sm" style={{flex:1}} onClick={()=>document.getElementById(`ex-detail-${ex.exerciseName}`)?.focus()}>Can't do it</button>
          </div>
          <input id={`ex-detail-${ex.exerciseName}`} className="input" placeholder="e.g. bad knee, no barbell available"
            value={detail} onChange={e=>setDetail(e.target.value)} style={{marginBottom:'8px',fontSize:'13px',padding:'9px 12px'}} />
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn-accent-sm" style={{flex:1}} disabled={!detail.trim()} onClick={()=>doSwap('restriction',detail.trim())}>Swap without it</button>
            <button className="btn-ghost-sm" onClick={()=>setShowPanel(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan detail ──
function PlanDetail({ planId, onBack, onUpdate }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dayIdx, setDayIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [friends, setFriends] = useState([]);
  const [shareMsg, setShareMsg] = useState('');
  const [showRegen, setShowRegen] = useState(false);
  const [regenProfile, setRegenProfile] = useState({ weight:'', goalWeight:'', goal:GOALS[2], timeline:'', notes:'' });
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');

  useEffect(() => {
    api.getWorkoutPlan(planId).then(d => { setData(d); setNameVal(d.name); }).finally(()=>setLoading(false));
  }, [planId]);

  function updateExerciseAt(dIdx, exIdx, newEx) {
    setData(d => {
      const plan = { ...d.plan };
      if (plan.days) {
        const days = plan.days.map((day, i) => i !== dIdx ? day : { ...day, exercises: day.exercises.map((e,ei)=> ei!==exIdx ? e : newEx) });
        return { ...d, plan: { ...plan, days } };
      }
      const exercises = plan.exercises.map((e,ei)=> ei!==exIdx ? e : newEx);
      return { ...d, plan: { ...plan, exercises } };
    });
  }

  async function saveName() {
    if (!nameVal.trim()) return;
    await api.renameWorkoutPlan(planId, { name: nameVal.trim() });
    setData(d => ({...d, name: nameVal.trim()}));
    setEditing(false);
    onUpdate?.();
  }

  function logThisWorkout(exercises, dayLabel) {
    navigate('/log/new', { state: { initialExercises: exercises.map(toFormExercise), planLabel: dayLabel } });
  }

  async function openShare() {
    if (friends.length === 0) {
      try { setFriends((await api.getFriends()).filter(f => f.status === 'accepted')); } catch {}
    }
    setShowShare(s => !s);
  }
  async function shareWith(friendId) {
    setShareMsg('');
    try {
      await api.shareWorkoutPlan(planId, { friendId });
      setShareMsg('Shared!');
      setTimeout(() => { setShowShare(false); setShareMsg(''); }, 1200);
    } catch (err) { setShareMsg(err.message); }
  }

  async function openRegenerate() {
    if (!showRegen) {
      try {
        const d = await api.getProfile();
        if (d.profile) setRegenProfile(p => ({ ...p, ...d.profile }));
      } catch {}
    }
    setShowRegen(s => !s);
  }

  async function doRegenerate(e) {
    e.preventDefault();
    setRegenerating(true); setRegenError('');
    try {
      await api.regenerateWorkoutPlan(planId, regenProfile);
      api.saveProfile(regenProfile).catch(()=>{});
      setShowRegen(false);
      const refreshed = await api.getWorkoutPlan(planId);
      setData(refreshed);
    } catch (err) { setRegenError(err.message); }
    finally { setRegenerating(false); }
  }

  if (loading) return <div className="page"><div className="spinner"/></div>;
  if (!data) return null;
  const plan = data.plan;
  const isWeek = Array.isArray(plan.days);

  return (
    <div className="page">
      <button className="btn-ghost" onClick={onBack} style={{marginBottom:'12px'}}>← All Plans</button>

      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom: showShare ? '10px' : '8px'}}>
        {editing ? (
          <>
            <input className="input" value={nameVal} onChange={e=>setNameVal(e.target.value)} style={{flex:1,fontSize:'20px'}} autoFocus/>
            <button className="btn-accent-sm" onClick={saveName}>Save</button>
            <button className="btn-ghost-sm" onClick={()=>setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <h2 className="page-title" style={{marginBottom:0,flex:1}}>{data.name}</h2>
            <button className="btn-ghost-sm" onClick={openRegenerate}>Regenerate</button>
            <button className="btn-ghost-sm" onClick={openShare}>Share</button>
            <button onClick={()=>setEditing(true)} style={{color:'var(--muted)',background:'none',border:'none',cursor:'pointer'}}><IconEdit style={{width:'16px',height:'16px'}}/></button>
          </>
        )}
      </div>
      {data.shared_from_username && <p className="muted" style={{fontSize:'12px',marginBottom:'16px'}}>Shared by {data.shared_from_username}</p>}

      {showRegen && (
        <form onSubmit={doRegenerate} className="card-form" style={{marginBottom:'20px'}}>
          <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'10px'}}>Rebuild this plan with updated info</div>
          <div className="form-stack">
            <div className="input-row">
              <div className="input-group"><label className="label">Current Weight</label><input className="input" type="number" value={regenProfile.weight} onChange={e=>setRegenProfile(p=>({...p,weight:e.target.value}))}/></div>
              <div className="input-group"><label className="label">Goal Weight</label><input className="input" type="number" value={regenProfile.goalWeight} onChange={e=>setRegenProfile(p=>({...p,goalWeight:e.target.value}))}/></div>
            </div>
            <div className="input-row">
              <div className="input-group">
                <label className="label">Goal</label>
                <select className="input" value={regenProfile.goal} onChange={e=>setRegenProfile(p=>({...p,goal:e.target.value}))}>
                  {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="input-group"><label className="label">Timeline (weeks)</label><input className="input" type="number" value={regenProfile.timeline} onChange={e=>setRegenProfile(p=>({...p,timeline:e.target.value}))}/></div>
            </div>
            <div className="field">
              <label className="label">Notes for the AI</label>
              <textarea className="input" rows={2} value={regenProfile.notes} onChange={e=>setRegenProfile(p=>({...p,notes:e.target.value}))} />
            </div>
            {regenError && <p className="form-error">{regenError}</p>}
            <button className="btn-primary" type="submit" disabled={regenerating}>{regenerating ? 'Rebuilding…' : 'Rebuild Plan'}</button>
          </div>
        </form>
      )}

      {showShare && (
        <div className="glass-card" style={{marginBottom:'20px'}}>
          <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'8px'}}>Send this plan to a friend</div>
          {friends.length === 0
            ? <p className="muted" style={{fontSize:'13px'}}>Add a friend first to share plans.</p>
            : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{friends.map(f => <button key={f.id} className="btn-ghost-sm" onClick={()=>shareWith(f.id)}>{f.username}</button>)}</div>
          }
          {shareMsg && <p style={{fontSize:'12px',color:'var(--teal)',marginTop:'8px'}}>{shareMsg}</p>}
        </div>
      )}

      {isWeek ? (
        <>
          <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>{plan.split_type} · {plan.days_per_week} days/week</p>
          <div className="tab-row" style={{marginBottom:'16px',flexWrap:'wrap'}}>
            {plan.days.map((d,i) => (
              <button key={i} className={dayIdx===i?'tab active':'tab'} onClick={()=>setDayIdx(i)}>{d.day.slice(0,3)}</button>
            ))}
          </div>
          {plan.days[dayIdx].type === 'rest' ? (
            <div className="glass-card" style={{textAlign:'center',padding:'30px'}}>
              <div style={{marginBottom:'8px',display:'flex',justifyContent:'center',color:'var(--muted)'}}><IconSleep style={{width:'28px',height:'28px'}}/></div>
              <div style={{fontWeight:'700'}}>Rest Day</div>
              <p className="muted" style={{fontSize:'13px',marginTop:'4px'}}>Recovery is part of the program.</p>
            </div>
          ) : (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <span style={{fontWeight:'700',fontSize:'15px'}}>{plan.days[dayIdx].focus}</span>
                <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:'13px'}} onClick={()=>logThisWorkout(plan.days[dayIdx].exercises, `${plan.days[dayIdx].day} — ${plan.days[dayIdx].focus} (${data.name})`)}>Log this workout</button>
              </div>
              {plan.days[dayIdx].exercises.map((ex,i) => (
                <ExerciseRow key={i} ex={ex} planId={planId} dayIdx={dayIdx} exIdx={i} onSwap={(newEx)=>updateExerciseAt(dayIdx,i,newEx)} />
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <span style={{fontWeight:'700',fontSize:'15px'}}>{plan.focus}</span>
            <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:'13px'}} onClick={()=>logThisWorkout(plan.exercises, `${plan.focus} (${data.name})`)}>Log this workout</button>
          </div>
          {plan.exercises.map((ex,i) => (
            <ExerciseRow key={i} ex={ex} planId={planId} dayIdx={null} exIdx={i} onSwap={(newEx)=>updateExerciseAt(null,i,newEx)} />
          ))}
        </>
      )}
    </div>
  );
}

// ── List / generator view ──
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function CustomWorkoutPlanBuilder({ onBack, onCreated }) {
  const [format, setFormat] = useState('week'); // 'week' | 'single'
  const [planName, setPlanName] = useState('My Custom Plan');
  const [dayIdx, setDayIdx] = useState(0);
  const [days, setDays] = useState(DAY_NAMES.map(d => ({ day: d, type: 'rest', focus: '', exercises: [] })));
  const [singleExercises, setSingleExercises] = useState([]);
  const [singleFocus, setSingleFocus] = useState('');
  const [form, setForm] = useState({ category:'lifting', exerciseName:'', sets:'3', reps:'8-10', durationMinutes:'' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function addExercise() {
    if (!form.exerciseName.trim()) { setError('Exercise name required'); return; }
    setError('');
    const ex = form.category === 'lifting'
      ? { category:'lifting', exerciseName: form.exerciseName.trim(), sets: Number(form.sets)||3, reps: form.reps || '8-10', notes: '' }
      : { category:'cardio', exerciseName: form.exerciseName.trim(), durationMinutes: Number(form.durationMinutes)||undefined, notes: '' };

    if (format === 'week') {
      setDays(ds => ds.map((d,i) => i!==dayIdx ? d : { ...d, type:'workout', exercises:[...d.exercises, ex] }));
    } else {
      setSingleExercises(es => [...es, ex]);
    }
    setForm(f => ({ ...f, exerciseName:'' }));
  }
  function removeExercise(ei) {
    if (format === 'week') {
      setDays(ds => ds.map((d,i) => i!==dayIdx ? d : { ...d, exercises: d.exercises.filter((_,j)=>j!==ei) }));
    } else {
      setSingleExercises(es => es.filter((_,j)=>j!==ei));
    }
  }
  function toggleRestDay() {
    setDays(ds => ds.map((d,i) => i!==dayIdx ? d : (d.type === 'rest' ? { ...d, type:'workout' } : { ...d, type:'rest', exercises:[] })));
  }

  async function save() {
    if (!planName.trim()) { setError('Plan name required'); return; }
    let plan;
    if (format === 'week') {
      if (!days.some(d => d.type === 'workout' && d.exercises.length)) { setError('Add at least one exercise to at least one day'); return; }
      plan = { format:'week', split_type:'Custom', days_per_week: days.filter(d=>d.type==='workout').length, days };
    } else {
      if (singleExercises.length === 0) { setError('Add at least one exercise'); return; }
      plan = { format:'single', focus: singleFocus || planName, exercises: singleExercises };
    }
    setSaving(true); setError('');
    try {
      const data = await api.createCustomWorkoutPlan({ name: planName.trim(), plan });
      onCreated(data.planId);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const currentExercises = format === 'week' ? days[dayIdx].exercises : singleExercises;

  return (
    <div className="page">
      <button className="btn-ghost" onClick={onBack} style={{marginBottom:'16px'}}>← Back</button>
      <h2 className="page-title">Build Your Own Plan</h2>

      <div className="card-form" style={{marginBottom:'16px'}}>
        <div className="field" style={{marginBottom:'12px'}}>
          <label className="label">Plan Name</label>
          <input className="input" value={planName} onChange={e=>setPlanName(e.target.value)} />
        </div>
        <div className="tab-row">
          <button type="button" className={format==='week'?'tab active':'tab'} onClick={()=>setFormat('week')}>Full Week</button>
          <button type="button" className={format==='single'?'tab active':'tab'} onClick={()=>setFormat('single')}>Single Workout</button>
        </div>
      </div>

      {format === 'week' ? (
        <>
          <div className="tab-row" style={{marginBottom:'12px',flexWrap:'wrap'}}>
            {days.map((d,i) => (
              <button key={i} className={dayIdx===i?'tab active':'tab'} onClick={()=>setDayIdx(i)}>
                {d.day.slice(0,3)}{d.type==='workout' && d.exercises.length>0 ? ` (${d.exercises.length})` : ''}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost-sm" style={{marginBottom:'12px'}} onClick={toggleRestDay}>
            {days[dayIdx].type === 'rest' ? '+ Make this a training day' : 'Mark as Rest Day'}
          </button>
        </>
      ) : (
        <div className="card-form" style={{marginBottom:'16px'}}>
          <div className="field">
            <label className="label">Session Focus (optional)</label>
            <input className="input" placeholder="e.g. Push Day" value={singleFocus} onChange={e=>setSingleFocus(e.target.value)} />
          </div>
        </div>
      )}

      {(format === 'single' || days[dayIdx].type === 'workout') && (
        <>
          {currentExercises.map((ex,i) => (
            <div key={i} className="list-item">
              <div style={{flex:1}}>
                <div className="item-main">{ex.exerciseName}</div>
                <div className="item-meta">{ex.category==='cardio' ? (ex.durationMinutes?formatDuration(ex.durationMinutes):'Cardio') : `${ex.sets} sets × ${ex.reps}`}</div>
              </div>
              <button className="btn-ghost-sm" onClick={()=>removeExercise(i)}>Remove</button>
            </div>
          ))}
          {currentExercises.length === 0 && <p className="muted" style={{marginBottom:'12px'}}>No exercises added yet.</p>}

          <div className="card-form" style={{marginTop:'12px'}}>
            <div className="form-stack">
              <div className="tab-row">
                <button type="button" className={form.category==='lifting'?'tab active':'tab'} onClick={()=>setForm(f=>({...f,category:'lifting'}))}>Lifting</button>
                <button type="button" className={form.category==='cardio'?'tab active':'tab'} onClick={()=>setForm(f=>({...f,category:'cardio'}))}>Cardio</button>
              </div>
              <div className="field">
                <label className="label">Exercise Name</label>
                <input className="input" placeholder="e.g. Bench Press" value={form.exerciseName} onChange={e=>setForm(f=>({...f,exerciseName:e.target.value}))} />
              </div>
              {form.category === 'lifting' ? (
                <div className="input-row">
                  <div className="input-group"><label className="label">Sets</label><input className="input" type="number" value={form.sets} onChange={e=>setForm(f=>({...f,sets:e.target.value}))} /></div>
                  <div className="input-group"><label className="label">Reps</label><input className="input" placeholder="8-10" value={form.reps} onChange={e=>setForm(f=>({...f,reps:e.target.value}))} /></div>
                </div>
              ) : (
                <div className="field">
                  <label className="label">Duration (min, optional)</label>
                  <input className="input" type="number" value={form.durationMinutes} onChange={e=>setForm(f=>({...f,durationMinutes:e.target.value}))} />
                </div>
              )}
              <button type="button" className="btn-secondary" onClick={addExercise}>+ Add Exercise</button>
            </div>
          </div>
        </>
      )}

      {error && <p className="form-error" style={{marginTop:'12px'}}>{error}</p>}
      <button className="btn-primary" style={{marginTop:'16px'}} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Plan'}
      </button>
    </div>
  );
}

export default function WorkoutPlans() {
  const [view, setView] = useState('list');
  const [showGate, setShowGate] = useState(false);
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('week');
  const [dayResult, setDayResult] = useState(null);
  const [profile, setProfile] = useState({ weight:'', goalWeight:'', goal:GOALS[2], timeline:'', notes:'', planName:'My Workout Plan' });

  useEffect(() => {
    loadPlans();
    api.getWorkoutPlanTemplates().then(setTemplates).catch(()=>{});
    api.getProfile().then(d => { if (d.profile) setProfile(p => ({...p, ...d.profile, planName: p.planName})); }).catch(()=>{});
  }, []);

  function loadPlans() {
    api.getWorkoutPlans().then(setPlans).catch(()=>{}).finally(()=>setLoading(false));
  }

  async function generate(e) {
    e.preventDefault();
    setError(''); setGenerating(true); setDayResult(null);
    try {
      const { planName, ...profileToSave } = profile;
      api.saveProfile(profileToSave).catch(()=>{});
      if (scope === 'day') {
        const data = await api.generateWorkoutPlan({ ...profile, scope: 'day' });
        setDayResult(data.workout);
      } else {
        const data = await api.generateWorkoutPlan(profile);
        loadPlans();
        setActivePlan(data.planId);
        setView('detail');
      }
    } catch (err) { setError(err.message || 'Failed to generate plan.'); }
    finally { setGenerating(false); }
  }

  function logDayResult() {
    navigate('/log/new', { state: { initialExercises: dayResult.exercises.map(toFormExercise), planLabel: dayResult.focus || 'AI Workout' } });
  }

  async function useTemplate(id, name) {
    try {
      const data = await api.useWorkoutPlanTemplate(id, { name });
      setPlans(ps => [{ id: data.planId, name: data.planName, is_favorite: 0, created_at: new Date().toISOString() }, ...ps]);
      setActivePlan(data.planId);
      setView('detail');
    } catch { setError('Could not load template'); }
  }

  async function toggleFav(e, id) {
    e.stopPropagation();
    const data = await api.favoriteWorkoutPlan(id);
    setPlans(ps => ps.map(p => p.id===id ? {...p, is_favorite: data.is_favorite?1:0} : p).sort((a,b)=>b.is_favorite-a.is_favorite||(new Date(b.created_at)-new Date(a.created_at))));
  }

  async function deletePlan(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this plan?')) return;
    await api.deleteWorkoutPlan(id);
    setPlans(ps => ps.filter(p => p.id !== id));
  }

  if (loading) return <div className="page"><div className="spinner"/></div>;

  if (view === 'detail' && activePlan) {
    return <PlanDetail planId={activePlan} onBack={()=>{loadPlans();setView('list');}} onUpdate={loadPlans}/>;
  }

  if (view === 'custom') {
    return <CustomWorkoutPlanBuilder onBack={()=>setView('list')} onCreated={(id)=>{loadPlans();setActivePlan(id);setView('detail');}} />;
  }

  if (view === 'new') {
    return (
      <div className="page">
        <button className="btn-ghost" onClick={()=>setView('list')} style={{marginBottom:'16px'}}>← Back</button>
        <h2 className="page-title">AI Workout Plan</h2>
        {error && <p className="form-error" style={{marginBottom:'16px'}}>{error}</p>}
        <form onSubmit={generate} className="form-stack">
          <div className="card-form">
            <div className="field" style={{marginBottom:'12px'}}>
              <label className="label">Plan Length</label>
              <div className="tab-row">
                <button type="button" className={scope==='week'?'tab active':'tab'} onClick={()=>setScope('week')}>Weekly Plan</button>
                <button type="button" className={scope==='day'?'tab active':'tab'} onClick={()=>setScope('day')}>Individual Workout</button>
              </div>
            </div>
            {scope === 'week' && (
              <div className="field" style={{marginBottom:'12px'}}>
                <label className="label">Plan Name</label>
                <input className="input" placeholder="e.g. Summer Strength Block" value={profile.planName} onChange={e=>setProfile(p=>({...p,planName:e.target.value}))} required/>
              </div>
            )}
            <div className="input-row">
              <div className="input-group"><label className="label">Current Weight (lbs)</label><input className="input" type="number" placeholder="185" value={profile.weight} onChange={e=>setProfile(p=>({...p,weight:e.target.value}))}/></div>
              <div className="input-group"><label className="label">Goal Weight (lbs)</label><input className="input" type="number" placeholder="175" value={profile.goalWeight} onChange={e=>setProfile(p=>({...p,goalWeight:e.target.value}))}/></div>
            </div>
            <div className="input-row" style={{marginTop:'12px'}}>
              <div className="input-group">
                <label className="label">Goal</label>
                <select className="input" value={profile.goal} onChange={e=>setProfile(p=>({...p,goal:e.target.value}))}>
                  {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {scope === 'week' && (
                <div className="input-group"><label className="label">Timeline (weeks)</label><input className="input" type="number" placeholder="12" value={profile.timeline} onChange={e=>setProfile(p=>({...p,timeline:e.target.value}))}/></div>
              )}
            </div>
            <div className="field" style={{marginTop:'12px'}}>
              <label className="label">Notes for the AI (goals, injuries, preferences{scope==='day' ? ', what you want today' : ''})</label>
              <textarea className="input" rows={3} placeholder={scope==='day' ? "e.g. leg day, bad left knee so avoid heavy squats, prefer dumbbells" : "e.g. training for a half marathon, bad left knee so avoid heavy squats, prefer dumbbells over barbells"}
                value={profile.notes} onChange={e=>setProfile(p=>({...p,notes:e.target.value}))} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={generating}>
            {generating ? 'Building your workout…' : <><IconSparkle style={{width:'16px',height:'16px',marginRight:'6px'}}/>{scope==='day' ? 'Generate Workout' : 'Generate Plan'}</>}
          </button>
        </form>
        {dayResult && (
          <div className="glass-card" style={{marginTop:'16px'}}>
            <div style={{fontWeight:'700',fontSize:'16px',marginBottom:'10px'}}>{dayResult.focus || 'Today\'s Workout'}</div>
            {dayResult.exercises.map((ex, i) => (
              <div key={i} className="item-meta" style={{fontSize:'13px',marginBottom:'4px'}}>
                {ex.exerciseName} — {ex.sets} × {ex.reps}
              </div>
            ))}
            <button className="btn-primary" style={{marginTop:'12px'}} onClick={logDayResult}>Log This Workout</button>
          </div>
        )}
      </div>
    );
  }

  const weekTemplates = templates.filter(t => t.format === 'week');
  const singleTemplates = templates.filter(t => t.format === 'single');

  return (
    <div className="page">
      <h2 className="page-title">Workout Plans</h2>

      <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
        <button className="btn-ghost-sm" onClick={()=>setView('custom')}>
          + Build Your Own
        </button>
        <button className="btn-primary" onClick={()=>setShowGate(true)}>
          <IconSparkle style={{width:'16px',height:'16px',marginRight:'6px'}}/>Generate an AI Plan
        </button>
      </div>

      {plans.length > 0 && (
        <section className="section">
          <div className="section-header"><span className="section-title">Your Plans</span></div>
          {plans.map(p => (
            <div key={p.id} className="list-item clickable" onClick={()=>{setActivePlan(p.id);setView('detail');}}>
              <div style={{flex:1}}>
                <div className="item-main">{p.name}</div>
                {p.shared_from_username && <div className="item-meta">Shared by {p.shared_from_username}</div>}
              </div>
              <button onClick={(e)=>toggleFav(e,p.id)} style={{background:'none',border:'none',marginRight:'8px',color:p.is_favorite?'var(--accent)':'var(--muted)'}}><IconStar filled={p.is_favorite} style={{width:'16px',height:'16px'}}/></button>
              <button className="btn-ghost-sm" onClick={(e)=>deletePlan(e,p.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <div className="section-header"><span className="section-title">Weekly Programs</span></div>
        <p className="muted" style={{fontSize:'12px',marginTop:'-6px',marginBottom:'12px'}}>Full weekly splits, rest days included.</p>
        {weekTemplates.map(t => (
          <div key={t.id} className="list-item clickable" onClick={()=>useTemplate(t.id, t.name)}>
            <div style={{width:'44px',height:'44px',borderRadius:'12px',flexShrink:0,background:'var(--surface-tint)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--teal)',marginRight:'12px'}}>
              <WorkoutPlanIcon id={t.icon} size={22} />
            </div>
            <div style={{flex:1}}>
              <div className="item-main">{t.name}</div>
              <div className="item-meta">{t.description}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-header"><span className="section-title">Individual Workouts</span></div>
        <p className="muted" style={{fontSize:'12px',marginTop:'-6px',marginBottom:'12px'}}>Single sessions you can log right now.</p>
        {singleTemplates.map(t => (
          <div key={t.id} className="list-item clickable" onClick={()=>useTemplate(t.id, t.name)}>
            <div style={{width:'44px',height:'44px',borderRadius:'12px',flexShrink:0,background:'var(--surface-tint)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--teal)',marginRight:'12px'}}>
              <WorkoutPlanIcon id={t.icon} size={22} />
            </div>
            <div style={{flex:1}}>
              <div className="item-main">{t.name}</div>
              <div className="item-meta">{t.description}</div>
            </div>
          </div>
        ))}
      </section>

      {showGate && (
        <ProfileGateModal
          onClose={()=>setShowGate(false)}
          onProceed={(p)=>{ setProfile(prev=>({...prev,...p})); setShowGate(false); setView('new'); }}
        />
      )}
    </div>
  );
}
