import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { formatDateStr } from '../dateUtils';
import { IconBarbell, IconMeals, IconWave } from '../components/Icons';
import FireIcon from '../components/StreakFire';
import { displayWeight, weightUnitLabel } from '../units';

function Skeleton() {
  return (
    <div>
      <div className="skeleton skeleton-card" style={{animationDelay:'.05s'}}/>
      <div className="skeleton skeleton-card" style={{animationDelay:'.1s'}}/>
      <div className="skeleton skeleton-card" style={{animationDelay:'.15s'}}/>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [workouts,   setWorkouts]   = useState([]);
  const [prs,        setPRs]        = useState([]);
  const [streak,     setStreak]     = useState(0);
  const [showAllPRs, setShowAllPRs] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [workoutPlanCount, setWorkoutPlanCount] = useState(null);
  const [mealPlanCount,    setMealPlanCount]    = useState(null);

  useEffect(() => {
    Promise.all([api.getWorkouts(), api.getPRs(), api.getStreak().catch(() => ({ streak: 0 }))])
      .then(([w, p, s]) => { setWorkouts(w); setPRs(p); setStreak(s.streak || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
    api.getWorkoutPlans().then(p => setWorkoutPlanCount(p.length)).catch(() => setWorkoutPlanCount(0));
    api.listMealPlans().then(d => setMealPlanCount((d.plans||[]).length)).catch(() => setMealPlanCount(0));
  }, []);

  const recent = workouts.slice(0, 5);
  const visiblePRs = showAllPRs ? prs : prs.slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <p className="page-subtitle" style={{color:'var(--muted)',fontSize:'13px',marginBottom:'4px',marginTop:'0'}}>{greeting}</p>
      <h2 className="page-title" style={{marginBottom:'20px',display:'flex',alignItems:'center',gap:'8px'}}>{user.username} <IconWave style={{width:'20px',height:'20px',color:'var(--accent)'}}/></h2>

      <div className="stat-row">
        {/* Same destinations as the stat cards on the Progress tab. */}
        <Link to="/log/history" className="stat-card" style={{animationDelay:'.05s',textDecoration:'none',color:'inherit',cursor:'pointer'}}>
          <span className="stat-num">{workouts.length}</span>
          <span className="stat-label">Workouts</span>
        </Link>
        <Link to="/photos?show=strength" className="stat-card" style={{animationDelay:'.1s',textDecoration:'none',color:'inherit',cursor:'pointer'}}>
          <span className="stat-num">{prs.length}</span>
          <span className="stat-label">PRs Set</span>
        </Link>
        <div className="stat-card" style={{animationDelay:'.15s'}}>
          <span className="stat-num" style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'center'}}>
            {streak}
            {streak > 0 && <FireIcon size={Math.min(24, 14 + streak)} />}
          </span>
          <span className="stat-label">Day Streak</span>
        </div>
      </div>

      <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
        <Link to="/workout-plans" className="glass-card" style={{flex:1,textDecoration:'none',color:'inherit',padding:'14px',textAlign:'center'}}>
          <div style={{fontWeight:'700',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}><IconBarbell style={{width:'16px',height:'16px'}}/> Workout Plans</div>
          <div className="muted" style={{fontSize:'12px',marginTop:'2px'}}>{workoutPlanCount === null ? '…' : `${workoutPlanCount} saved`}</div>
        </Link>
        <Link to="/meals/plans" className="glass-card" style={{flex:1,textDecoration:'none',color:'inherit',padding:'14px',textAlign:'center'}}>
          <div style={{fontWeight:'700',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}><IconMeals style={{width:'16px',height:'16px'}}/> Meal Plans</div>
          <div className="muted" style={{fontSize:'12px',marginTop:'2px'}}>{mealPlanCount === null ? '…' : `${mealPlanCount} saved`}</div>
        </Link>
      </div>

      <section className="section">
        <div className="section-header">
          <span className="section-title">Recent Workouts</span>
          <Link to="/log/new" className="link-small">+ Log one</Link>
        </div>
        {loading ? <Skeleton /> : recent.length === 0
          ? <p className="muted">No workouts yet. <Link to="/log/new">Log your first!</Link></p>
          : recent.map((w, i) => {
            const extra = Math.max(0, (w.exercise_count || 1) - 1);
            const mixed = w.categories?.includes(',');
            return (
              <Link to={`/workouts/${w.id}`} key={w.id} className="list-item clickable" style={{animationDelay:`${i*.05}s`,animation:'fadeInUp .3s ease both'}}>
                <div style={{flex:1}}>
                  <div className="item-main">{w.name || `${w.first_exercise}${extra > 0 ? ` +${extra} more` : ''}`}</div>
                  <div className="item-meta">{w.exercise_count} exercise{w.exercise_count === 1 ? '' : 's'} · {mixed ? 'mixed' : w.categories}</div>
                </div>
                <span className="item-date">{formatDateStr(w.date)}</span>
              </Link>
            );
          })
        }
      </section>

      <section className="section">
        <div className="section-header">
          <span className="section-title">Personal Records</span>
          {prs.length > 5 && (
            <button className="link-small" style={{background:'none',border:'none',cursor:'pointer'}} onClick={() => setShowAllPRs(s => !s)}>
              {showAllPRs ? 'Show less' : `View all (${prs.length})`}
            </button>
          )}
        </div>
        {loading ? <Skeleton /> : visiblePRs.map((pr, i) => {
          const Card = pr.workout_id ? Link : 'div';
          const cardProps = pr.workout_id ? { to: `/workouts/${pr.workout_id}` } : {};
          return (
            <Card key={pr.id} className="list-item clickable" style={{animationDelay:`${i*.05}s`,animation:'fadeInUp .3s ease both'}} {...cardProps}>
              <span className="item-main">{pr.exercise}</span>
              <span className="item-accent">{pr.unit === 'lbs' ? `${displayWeight(pr.max_weight, user?.weightUnit)} ${weightUnitLabel(user?.weightUnit)}` : pr.display_value}</span>
            </Card>
          );
        })}
        {!loading && prs.length === 0 && <p className="muted">Log a workout to set your first PR.</p>}
      </section>
    </div>
  );
}
