import { Link } from 'react-router-dom';
import { IconBarbell, IconClipboard, IconClock, IconMapPin, IconTrophy } from '../components/Icons';

const CARD_STYLE = {
  textDecoration:'none', color:'inherit', padding:'28px 16px', textAlign:'center',
  display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
};

export default function WorkoutsHub() {
  return (
    <div className="page">
      <h2 className="page-title">Workouts</h2>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginTop:'8px'}}>
        <Link to="/log/new" className="glass-card" style={CARD_STYLE}>
          <IconBarbell style={{width:'34px',height:'34px',color:'var(--accent)'}}/>
          <span style={{fontWeight:'700',fontSize:'16px'}}>Log a Workout</span>
          <span className="muted" style={{fontSize:'13px'}}>Record what you just did</span>
        </Link>
        <Link to="/workout-plans" className="glass-card" style={CARD_STYLE}>
          <IconClipboard style={{width:'34px',height:'34px',color:'var(--accent)'}}/>
          <span style={{fontWeight:'700',fontSize:'16px'}}>Workout Plans</span>
          <span className="muted" style={{fontSize:'13px'}}>Templates, AI, or build your own</span>
        </Link>
        <Link to="/log/track" className="glass-card" style={CARD_STYLE}>
          <IconMapPin style={{width:'34px',height:'34px',color:'var(--accent)'}}/>
          <span style={{fontWeight:'700',fontSize:'16px'}}>Run, Walk, Bike</span>
          <span className="muted" style={{fontSize:'13px'}}>Live GPS distance, pace, and route</span>
        </Link>
        <Link to="/log/history" className="glass-card" style={CARD_STYLE}>
          <IconClock style={{width:'34px',height:'34px',color:'var(--accent)'}}/>
          <span style={{fontWeight:'700',fontSize:'16px'}}>Past Workouts</span>
          <span className="muted" style={{fontSize:'13px'}}>See everything you've logged</span>
        </Link>
        <Link to="/race-training" className="glass-card" style={{...CARD_STYLE, gridColumn:'1 / -1'}}>
          <IconTrophy style={{width:'34px',height:'34px',color:'var(--accent)'}}/>
          <span style={{fontWeight:'700',fontSize:'16px'}}>Race Training</span>
          <span className="muted" style={{fontSize:'13px'}}>5K to Ironman — a week-by-week plan to race day</span>
        </Link>
      </div>
    </div>
  );
}
