import DuplicateWorkoutModal from '../components/DuplicateWorkoutModal';
import WorkoutLoggedModal from '../components/WorkoutLoggedModal';
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { formatDateStr } from '../dateUtils';

export default function PastWorkouts() {
  const location = useLocation();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [duplicating, setDuplicating] = useState(null);
  // Set when arriving straight from logging (or "Do it again") — see LogWorkout.
  const [logged, setLogged] = useState(location.state?.logged || null);

  // location.key changes on every navigation, including landing here again
  // from "Again" while already on this page, so the list and popup refresh.
  useEffect(() => {
    if (location.state?.logged) setLogged(location.state.logged);
    // Reloads after the first are silent — no spinner flash behind the popup.
    api.getWorkouts()
      .then(setWorkouts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeLogged() {
    setLogged(null);
    // Drop the state so a refresh or Back doesn't show the popup again.
    navigate(location.pathname, { replace: true, state: null });
  }

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 className="page-title" style={{marginBottom:0}}>Past Workouts</h2>
        <Link to="/log" className="link-small">← Workouts</Link>
      </div>

      {loading ? <div className="spinner"/> : error ? <p className="form-error">{error}</p> : workouts.length === 0 ? (
        <p className="muted">No workouts logged yet. <Link to="/log/new">Log your first!</Link></p>
      ) : (
        workouts.map((w, i) => {
          const extra = Math.max(0, (w.exercise_count || 1) - 1);
          const mixed = w.categories?.includes(',');
          return (
            <Link to={`/workouts/${w.id}`} key={w.id} className="list-item clickable" style={{animationDelay:`${Math.min(i,10)*.03}s`,animation:'fadeInUp .3s ease both'}}>
              <div style={{flex:1}}>
                <div className="item-main">{w.name || `${w.first_exercise}${extra > 0 ? ` +${extra} more` : ''}`}</div>
                <div className="item-meta">{w.exercise_count} exercise{w.exercise_count === 1 ? '' : 's'} · {mixed ? 'mixed' : w.categories}</div>
              </div>
              <span className="item-date">{formatDateStr(w.date)}</span>
              <button type="button" className="btn-ghost-sm" style={{flexShrink:0}}
                onClick={e => { e.preventDefault(); e.stopPropagation(); setDuplicating(w); }}>
                Again
              </button>
            </Link>
          );
        })
      )}
      {duplicating && (
        <DuplicateWorkoutModal
          workoutId={duplicating.id}
          workoutName={duplicating.name || duplicating.first_exercise}
          exerciseCount={duplicating.exercise_count}
          onClose={()=>setDuplicating(null)}
        />
      )}
      {logged && <WorkoutLoggedModal summary={logged} onClose={closeLogged} />}
    </div>
  );
}
