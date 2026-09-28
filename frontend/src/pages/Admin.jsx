import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateStr } from '../dateUtils';

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState(null);
  const [crews, setCrews] = useState(null);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [viewingUser, setViewingUser] = useState(null);
  const [userWorkouts, setUserWorkouts] = useState(null);

  useEffect(() => { loadUsers(); loadCrews(); }, []);

  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;

  function loadUsers() { api.adminListUsers().then(setUsers).catch(err => setError(err.message)); }
  function loadCrews() { api.adminListCrews().then(setCrews).catch(err => setError(err.message)); }

  async function createUser(e) {
    e.preventDefault();
    setError('');
    try {
      await api.adminCreateUser(newUser);
      setNewUser({ username: '', email: '', password: '' });
      setShowNew(false);
      loadUsers();
    } catch (err) { setError(err.message); }
  }

  async function deleteUser(id, username) {
    if (!window.confirm(`Delete ${username}'s account? This cannot be undone.`)) return;
    try { await api.adminDeleteUser(id); loadUsers(); }
    catch (err) { setError(err.message); }
  }

  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  async function resetPassword(id, username) {
    if (!window.confirm(`Generate a new temporary password for ${username}? Their current password will stop working immediately.`)) return;
    try {
      const res = await api.adminResetPassword(id);
      setTempPasswordInfo({ username, password: res.tempPassword });
      loadUsers();
    }
    catch (err) { setError(err.message); }
  }

  // Direct grants only — premium that comes from a crew is managed on the Crews tab.
  async function grantPremium(u) {
    const input = window.prompt(`Grant Premium to ${u.username}.\n\nNumber of days, or leave blank for no end date:`, '');
    if (input === null) return;
    const days = input.trim() ? Number(input) : null;
    if (days !== null && (!Number.isFinite(days) || days <= 0)) { setError('Enter a positive number of days, or leave it blank.'); return; }
    try { await api.adminGrantPremium(u.id, days); loadUsers(); } catch (err) { setError(err.message); }
  }
  async function revokePremium(u) {
    if (!window.confirm(`Remove ${u.username}'s direct Premium grant?${u.premium_crew ? ` They'll keep Premium through ${u.premium_crew} while they're in it.` : ''}`)) return;
    try { await api.adminRevokePremium(u.id); loadUsers(); } catch (err) { setError(err.message); }
  }
  async function toggleCrewFlag(c, key) {
    const next = !Number(c[key]);
    const warn = key === 'auto_join' && !next
      ? `Stop adding new signups to ${c.name}?${Number(c.grants_premium) ? ' New accounts will start on the free plan; current members keep Premium.' : ''}`
      : key === 'grants_premium' && !next
        ? `Stop ${c.name} from granting Premium? Its ${c.member_count} member${c.member_count===1?'':'s'} lose Premium unless granted it directly.`
        : null;
    if (warn && !window.confirm(warn)) return;
    try { await api.adminSetCrewFlags(c.id, { [key]: next }); loadCrews(); if (key === 'grants_premium') loadUsers(); }
    catch (err) { setError(err.message); }
  }

  async function viewWorkouts(u) {
    setViewingUser(u);
    setUserWorkouts(null);
    try { setUserWorkouts(await api.adminUserWorkouts(u.id)); }
    catch (err) { setError(err.message); }
  }

  if (viewingUser) {
    return (
      <div className="page">
        <button className="btn-ghost-sm" style={{marginBottom:'16px'}} onClick={()=>setViewingUser(null)}>← Back to Users</button>
        <h2 className="page-title">{viewingUser.username}'s Workouts</h2>
        <p className="muted" style={{fontSize:'12px',marginBottom:'16px'}}>Progress photos are never visible to admins.</p>
        {!userWorkouts ? <div className="spinner"/> : userWorkouts.length === 0 ? (
          <p className="muted">No workouts logged.</p>
        ) : userWorkouts.map(w => (
          <div key={w.id} className="glass-card" style={{marginBottom:'10px'}}>
            <div style={{fontWeight:'700',fontSize:'14px'}}>{w.name || formatDateStr(w.date)}</div>
            <div className="muted" style={{fontSize:'12px',marginBottom:'6px'}}>{formatDateStr(w.date)}</div>
            {w.exercises?.map(ex => (
              <div key={ex.id} className="item-meta" style={{fontSize:'13px'}}>
                {ex.exercise_name} — {ex.category==='lifting' ? `${ex.sets||'?'}×${ex.reps||'?'} @ ${ex.weight||'?'}lbs` : `${ex.duration_minutes||'?'}min`}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">Admin</h2>
      {error && <p className="form-error" style={{marginBottom:'12px'}}>{error}</p>}
      {tempPasswordInfo && (
        <div className="glass-card" style={{marginBottom:'16px',border:'1px solid var(--accent)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:'700',marginBottom:'6px'}}>New password for {tempPasswordInfo.username}</div>
              <div style={{fontFamily:'monospace',fontSize:'20px',fontWeight:'700',letterSpacing:'.03em',background:'var(--surface-tint)',padding:'8px 12px',borderRadius:'var(--r-sm)',display:'inline-block'}}>
                {tempPasswordInfo.password}
              </div>
              <p className="muted" style={{fontSize:'12px',marginTop:'8px',marginBottom:0}}>
                Send this to them directly (text, call, in person) — it won't be shown again. They can log in with it and change it themselves in Settings → Account.
              </p>
            </div>
            <button className="btn-ghost-sm" onClick={()=>setTempPasswordInfo(null)} style={{flexShrink:0}}>Dismiss</button>
          </div>
        </div>
      )}
      <div className="tab-row" style={{marginBottom:'16px'}}>
        <button className={tab==='users'?'tab active':'tab'} onClick={()=>setTab('users')}>Users {users ? `(${users.length})` : ''}</button>
        <button className={tab==='crews'?'tab active':'tab'} onClick={()=>setTab('crews')}>Crews {crews ? `(${crews.length})` : ''}</button>
      </div>

      {tab === 'users' && (
        <>
          <button className="btn-secondary" style={{marginBottom:'12px'}} onClick={()=>setShowNew(s=>!s)}>{showNew ? 'Cancel' : '+ Create Account'}</button>
          {showNew && (
            <form onSubmit={createUser} className="card-form form-stack" style={{marginBottom:'14px'}}>
              <div className="field"><label className="label">Username</label><input className="input" value={newUser.username} onChange={e=>setNewUser(u=>({...u,username:e.target.value}))} required/></div>
              <div className="field"><label className="label">Email</label><input className="input" type="email" value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))} required/></div>
              <div className="field"><label className="label">Password</label><input className="input" type="password" value={newUser.password} onChange={e=>setNewUser(u=>({...u,password:e.target.value}))} required/></div>
              <button className="btn-primary" type="submit">Create</button>
            </form>
          )}
          {!users ? <div className="spinner"/> : users.map(u => (
            <div key={u.id} className="list-item" style={{marginBottom:'6px',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:'160px'}}>
                <div className="item-main">{u.username} {u.is_admin ? <span style={{fontSize:'10px',color:'var(--accent)',fontWeight:'700'}}>ADMIN</span> : null}</div>
                <div className="item-meta">{u.email}{u.has_google ? ' · Google' : ''}{u.needs_password ? ' · needs password' : ''}</div>
                {'premium_crew' in u && (
                  <div className="item-meta" style={{color: (u.premium_crew || Number(u.premium_granted)) ? 'var(--accent)' : undefined, fontWeight: (u.premium_crew || Number(u.premium_granted)) ? 600 : undefined}}>
                    {u.premium_crew && Number(u.premium_granted) ? `Premium · ${u.premium_crew} + direct grant`
                      : u.premium_crew ? `Premium · via ${u.premium_crew}`
                      : Number(u.premium_granted) ? `Premium · granted${u.premium_until && !String(u.premium_until).startsWith('9999') ? ` until ${new Date(u.premium_until).toLocaleDateString()}` : ''}`
                      : 'Free plan'}
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                <button className="btn-ghost-sm" onClick={()=>viewWorkouts(u)}>Workouts</button>
                <button className="btn-ghost-sm" onClick={()=>resetPassword(u.id, u.username)}>New Password</button>
                {'premium_crew' in u && (Number(u.premium_granted)
                  ? <button className="btn-ghost-sm" onClick={()=>revokePremium(u)}>Remove Premium</button>
                  : <button className="btn-ghost-sm" onClick={()=>grantPremium(u)}>Grant Premium</button>)}
                <button className="btn-ghost-sm" style={{color:'var(--danger)'}} onClick={()=>deleteUser(u.id, u.username)}>Delete</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'crews' && (
        !crews ? <div className="spinner"/> : crews.length === 0 ? <p className="muted">No crews yet.</p> : crews.map(c => (
          <div key={c.id} className="list-item" style={{marginBottom:'6px'}}>
            <div style={{flex:1}}>
              <div className="item-main">{c.name}</div>
              <div className="item-meta">by {c.creator_username || 'unknown'} · {c.member_count} member{c.member_count===1?'':'s'}</div>
              {'auto_join' in c && (
                <div style={{display:'flex',gap:'16px',flexWrap:'wrap',marginTop:'8px'}}>
                  <label className="checkbox-row" style={{fontSize:'12px'}}>
                    <input type="checkbox" checked={!!Number(c.auto_join)} onChange={()=>toggleCrewFlag(c, 'auto_join')}/>
                    <span>New signups join automatically</span>
                  </label>
                  {'grants_premium' in c && (
                    <label className="checkbox-row" style={{fontSize:'12px'}}>
                      <input type="checkbox" checked={!!Number(c.grants_premium)} onChange={()=>toggleCrewFlag(c, 'grants_premium')}/>
                      <span>Members get Premium</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
