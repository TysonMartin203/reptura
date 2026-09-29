import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import WorkoutForm from '../components/WorkoutForm';
import UnfinishedWorkoutModal from '../components/UnfinishedWorkoutModal';

// Anything worth coming back to? A form with only the default blank row isn't.
function hasContent(d) {
  if (!d) return false;
  return !!(d.name || d.notesBefore || d.notesAfter || (d.exercises || []).some(e =>
    e.exerciseName || e.customName || e.sets || e.reps || e.weight || e.durationMinutes || e.distance || e.notes
  ));
}

export default function LogWorkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state; // { initialExercises, planLabel, initialName } when arriving from a plan

  const fromPlan = prefill?.initialExercises || prefill?.initialName
    ? { exercises: prefill.initialExercises || [], name: prefill.initialName || '' }
    : undefined;

  // checking → (prompt) → ready. The form only mounts at "ready", because its
  // starting values depend on whether an old workout is being finished.
  const [phase, setPhase] = useState('checking');
  const [saved, setSaved] = useState(null);      // { draft, updatedAt } from the server
  const [initial, setInitial] = useState(undefined);
  const [discarding, setDiscarding] = useState(false);
  const [resumed, setResumed] = useState(false); // true when finishing an old workout

  // Draft saving: debounced, strictly in order, and switched off for good once
  // the workout is logged so a late save can't bring the draft back.
  const timer = useRef(null);
  const queue = useRef(Promise.resolve());
  const latest = useRef(null);
  const finished = useRef(false);

  function persist(snapshot) {
    const call = hasContent(snapshot) ? () => api.saveWorkoutDraft(snapshot) : () => api.clearWorkoutDraft();
    queue.current = queue.current.catch(() => {}).then(call).catch(() => {});
    return queue.current;
  }

  useEffect(() => {
    // The old draft system kept its copy in this browser; it's gone now.
    try { localStorage.removeItem('reptura_workout_draft'); } catch { /* ignore */ }

    let cancelled = false;
    api.getWorkoutDraft()
      .then(res => {
        if (cancelled) return;
        if (res?.draft && hasContent(res.draft)) { setSaved(res); setPhase('prompt'); }
        else { setInitial(fromPlan); setPhase('ready'); }
      })
      .catch(() => { if (!cancelled) { setInitial(fromPlan); setPhase('ready'); } });

    return () => {
      cancelled = true;
      // Leaving mid-entry: save whatever hasn't been sent yet.
      clearTimeout(timer.current);
      if (!finished.current && latest.current) persist(latest.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing or backgrounding the app skips React's cleanup, so send anything
  // still waiting on the debounce the moment the page is hidden.
  useEffect(() => {
    function flush() {
      if (document.visibilityState !== 'hidden' || finished.current || !latest.current) return;
      clearTimeout(timer.current);
      persist(latest.current);
      latest.current = null;
    }
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(snapshot) {
    if (finished.current) return;
    latest.current = snapshot;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { persist(snapshot); latest.current = null; }, 800);
  }

  async function handleLogged(summary) {
    finished.current = true;
    clearTimeout(timer.current);
    latest.current = null;
    await queue.current;                 // let any save already on its way finish first…
    api.clearWorkoutDraft().catch(() => {}); // …so this delete is the last word
    // Land on Past Workouts with the PR popup. replace: so Back doesn't return
    // to an empty log form.
    navigate('/log/history', { replace: true, state: { logged: summary } });
  }

  function finishOld() {
    setInitial(saved.draft);
    setResumed(true);
    setPhase('ready');
  }

  async function discardOld() {
    setDiscarding(true);
    try { await api.clearWorkoutDraft(); } catch { /* if this fails, the next edit overwrites it anyway */ }
    setInitial(fromPlan);
    setPhase('ready');
  }

  const showingPlan = phase === 'ready' && !resumed && prefill?.planLabel;

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 className="page-title" style={{marginBottom:0}}>Log Workout</h2>
        <Link to="/log" className="link-small">← Workouts</Link>
      </div>
      {showingPlan && (
        <p className="muted" style={{fontSize:'13px',marginTop:'-12px',marginBottom:'16px'}}>From plan: {prefill.planLabel}</p>
      )}

      {phase === 'checking' && <div className="spinner" />}

      {phase === 'prompt' && (
        <UnfinishedWorkoutModal
          draft={saved.draft}
          updatedAt={saved.updatedAt}
          startingFresh={!!fromPlan}
          busy={discarding}
          onFinish={finishOld}
          onDiscard={discardOld}
        />
      )}

      {phase === 'ready' && (
        <div className="card-form">
          <WorkoutForm
            mode="create"
            initial={initial}
            onSubmit={(payload) => api.logWorkout(payload)}
            onChange={handleChange}
            onLogged={handleLogged}
          />
        </div>
      )}
    </div>
  );
}
