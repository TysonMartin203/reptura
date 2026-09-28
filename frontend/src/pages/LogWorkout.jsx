import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import WorkoutForm from '../components/WorkoutForm';

export default function LogWorkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state; // { initialExercises, planLabel } when arriving from a workout plan

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 className="page-title" style={{marginBottom:0}}>Log Workout</h2>
        <Link to="/log" className="link-small">← Workouts</Link>
      </div>
      {prefill?.planLabel && (
        <p className="muted" style={{fontSize:'13px',marginTop:'-12px',marginBottom:'16px'}}>From plan: {prefill.planLabel}</p>
      )}
      <div className="card-form">
        <WorkoutForm
          mode="create"
          initial={prefill?.initialExercises ? { exercises: prefill.initialExercises } : undefined}
          onSubmit={(payload) => api.logWorkout(payload)}
          // Land on Past Workouts with the new workout at the top, and let the
          // PR popup there do the celebrating. replace: so Back doesn't return
          // to an empty log form.
          onLogged={(summary) => navigate('/log/history', { replace: true, state: { logged: summary } })}
        />
      </div>
    </div>
  );
}
