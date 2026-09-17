import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { IconBarbell, IconTrendingUp, IconFeed, IconPeople, IconMeals, IconPlus } from './Icons';

const links = [
  { to: '/log',     label: 'Workouts', Icon: IconBarbell },
  { to: '/photos',  label: 'Progress', Icon: IconTrendingUp },
  { to: '/feed',    label: 'Feed',   Icon: IconFeed },
  { to: '/social',  label: 'Social', Icon: IconPeople },
  { to: '/meals',   label: 'Meals',  Icon: IconMeals },
];

export default function Nav() {
  const navigate = useNavigate();
  const [showLogChoice, setShowLogChoice] = useState(false);

  return (
    <nav className="bottom-nav">
      {links.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div className="nav-icon-wrap">
            <Icon className="nav-icon" />
          </div>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}

      <button type="button" className="nav-item" onClick={()=>setShowLogChoice(true)} style={{background:'none',border:'none',cursor:'pointer'}}>
        <div className="nav-icon-wrap">
          <IconPlus className="nav-icon" />
        </div>
        <span className="nav-label">Log</span>
      </button>

      {showLogChoice && createPortal(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={()=>setShowLogChoice(false)}>
          <div style={{width:'100%',maxWidth:'340px',borderRadius:'16px',background:'var(--surface)',padding:'20px',boxShadow:'var(--shadow-lg)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:'16px',textAlign:'center'}}>What are you logging?</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button className="btn-primary" onClick={()=>{setShowLogChoice(false); navigate('/log');}}>
                Workout
              </button>
              <button className="btn-primary" onClick={()=>{setShowLogChoice(false); navigate('/meals/log');}}>
                Meal
              </button>
              <button className="btn-ghost" onClick={()=>setShowLogChoice(false)}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}
