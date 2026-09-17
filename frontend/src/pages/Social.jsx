import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { today, formatDateStr } from '../dateUtils';
import { IconLightning } from '../components/Icons';
import FireIcon from '../components/StreakFire';
import { enablePush, getPushStatus } from '../push';
import SharePlanPanel from '../components/SharePlanPanel';
import { closestComparison } from '../weightComparisons';
import { formatCompact } from '../format';
import { displayWeight, weightUnitLabel } from '../units';


// ── Friends sub-tab (add, accept, list, DM, buzz) ──
function FriendsTab() {
  const { user } = useAuth();
  const [friends,  setFriends]  = useState([]);
  const [username, setUsername] = useState('');
  const [convo,    setConvo]    = useState(null);
  const [msgText,  setMsgText]  = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [buzzed,   setBuzzed]   = useState({});
  const [pushStatus, setPushStatus] = useState('unknown');
  const [enabling,   setEnabling]   = useState(false);
  const [showShare,  setShowShare]  = useState(false);
  const [unreadIds, setUnreadIds] = useState([]);
  const [recommended, setRecommended] = useState(null);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [sentTo, setSentTo] = useState({});

  useEffect(() => {
    api.getFriends().then(setFriends).catch(console.error).finally(() => setLoading(false));
    api.getUnreadMessageSenders().then(setUnreadIds).catch(console.error);
    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'));
  }, []);

  async function enableNotifications() {
    setEnabling(true);
    try { await enablePush(); setPushStatus('subscribed'); }
    catch (err) { setError(err.message); }
    finally { setEnabling(false); }
  }

  async function addFriend(e) {
    e.preventDefault(); setError('');
    try {
      await api.addFriend({ username });
      setUsername('');
      setFriends(await api.getFriends());
    } catch (err) { setError(err.message); }
  }

  async function toggleRecommended() {
    if (recommended !== null) { setRecommended(null); return; }
    setLoadingRecommended(true);
    try { setRecommended(await api.getRecommendedFriends()); }
    catch (err) { setError(err.message); }
    finally { setLoadingRecommended(false); }
  }

  async function addFromRecommended(person) {
    setSentTo(s => ({ ...s, [person.id]: true }));
    try { await api.addFriend({ username: person.username }); }
    catch (err) { setError(err.message); setSentTo(s => ({ ...s, [person.id]: false })); }
  }

  async function openConvo(friend) {
    const messages = await api.getConversation(friend.id);
    setConvo({ friend, messages });
    setShowShare(false);
    setUnreadIds(ids => ids.filter(id => id !== friend.id));
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!msgText.trim() || !convo) return;
    await api.sendMessage({ receiverId: convo.friend.id, message: msgText });
    const msgs = await api.getConversation(convo.friend.id); setConvo(c => ({ ...c, messages: msgs }));
    setMsgText('');
  }

  async function buzz(friendId) {
    setBuzzed(b => ({ ...b, [friendId]: 'sending' }));
    try {
      await api.buzzFriend(friendId);
      setBuzzed(b => ({ ...b, [friendId]: 'sent' }));
      setTimeout(() => setBuzzed(b => ({ ...b, [friendId]: null })), 3000);
    } catch (err) {
      setBuzzed(b => ({ ...b, [friendId]: null }));
      setError(err.message);
    }
  }

  const accepted = friends.filter(f => f.status === 'accepted');
  const pending  = friends.filter(f => f.status === 'pending' && f.direction === 'received');
  const sent     = friends.filter(f => f.status === 'pending' && f.direction === 'sent');

  if (loading) return <div className="spinner"/>;

  if (convo) {
    return (
      <div className="convo-page">
        <button className="btn-ghost" onClick={() => setConvo(null)} style={{marginBottom:'12px'}}>← Back</button>
        <h3 style={{marginBottom:'12px'}}>{convo.friend.username}</h3>
        <div className="messages">
          {convo.messages.map(m => (
            <div key={m.id} className={`message ${m.sender_id === user.id ? 'mine' : 'theirs'}`}>
              <span className="msg-text">{m.message}</span>
              <span className="msg-time">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          ))}
          {convo.messages.length === 0 && <p className="muted">No messages yet. Say something!</p>}
        </div>
        {showShare && (
          <SharePlanPanel
            friendId={convo.friend.id}
            onClose={()=>setShowShare(false)}
            onShared={async ()=>{ setShowShare(false); const messages = await api.getConversation(convo.friend.id); setConvo(c=>({...c,messages})); }}
          />
        )}
        <form onSubmit={sendMsg} className="msg-form">
          <button type="button" className="btn-ghost-sm" onClick={()=>setShowShare(s=>!s)} style={{flexShrink:0}}>+ Plan</button>
          <input className="input" placeholder="Message…" value={msgText} onChange={e=>setMsgText(e.target.value)} />
          <button className="btn-primary" type="submit">Send</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {(pushStatus === 'not-subscribed' || pushStatus === 'unknown') && (
        <div className="glass-card" style={{marginBottom:'16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
          <div>
            <div style={{fontWeight:'700',fontSize:'14px'}}>Turn on notifications</div>
            <div className="muted" style={{fontSize:'12px'}}>Get notified when a friend buzzes or messages you</div>
          </div>
          <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:'13px',flexShrink:0}} onClick={enableNotifications} disabled={enabling}>
            {enabling ? '…' : 'Enable'}
          </button>
        </div>
      )}
      {pushStatus === 'denied' && (
        <p className="muted" style={{fontSize:'12px',marginBottom:'16px'}}>Notifications are blocked in your browser settings — enable them there to get buzzed or messaged.</p>
      )}

      <div className="card-form">
        <form onSubmit={addFriend} className="form-stack">
          <div className="field">
            <label className="label">Add a friend by username</label>
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit">Send Request</button>
        </form>
      </div>

      <button className="btn-secondary" style={{marginBottom:'16px'}} onClick={toggleRecommended}>
        {recommended !== null ? 'Hide Recommended Friends' : 'Recommended Friends'}
      </button>
      {loadingRecommended && <div className="spinner"/>}
      {recommended !== null && !loadingRecommended && (
        <section className="section">
          {recommended.length === 0 ? (
            <p className="muted" style={{fontSize:'13px'}}>No suggestions yet — recommendations come from friends your friends have added.</p>
          ) : recommended.map(p => (
            <div key={p.id} className="list-item" style={{marginBottom:'6px'}}>
              <div style={{flex:1}}>
                <div className="item-main">{p.username}</div>
                <div className="item-meta">{p.mutual_count} mutual friend{p.mutual_count===1?'':'s'}</div>
              </div>
              <button className="btn-ghost-sm" onClick={()=>addFromRecommended(p)} disabled={sentTo[p.id]}>
                {sentTo[p.id] ? 'Sent' : 'Add Friend'}
              </button>
            </div>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="section">
          <div className="section-header"><span className="section-title">Requests</span></div>
          {pending.map(f => (
            <div key={f.id} className="list-item">
              <span className="item-main" style={{flex:1}}>{f.username}</span>
              <button className="btn-accent-sm" onClick={async()=>{await api.acceptFriend(f.id);setFriends(await api.getFriends());}}>Accept</button>
            </div>
          ))}
        </section>
      )}

      {sent.length > 0 && (
        <section className="section">
          <div className="section-header"><span className="section-title">Sent</span></div>
          {sent.map(f => (
            <div key={f.id} className="list-item">
              <span className="item-main">{f.username}</span>
              <span className="item-meta" style={{marginLeft:'auto'}}>Pending</span>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <div className="section-header"><span className="section-title">Friends</span></div>
        {accepted.length === 0
          ? <p className="muted">No friends yet — add one above.</p>
          : accepted.map(f => (
            <div key={f.id} className="list-item">
              <Link to={`/profile/${f.id}`} className="item-main" style={{flex:1,color:'inherit',textDecoration:'none'}}>{f.username}</Link>
              <button className="btn-ghost-sm" style={{marginRight:'6px'}} onClick={()=>buzz(f.id)} disabled={buzzed[f.id]==='sending'}>
                {buzzed[f.id]==='sent' ? <>Buzzed! <IconLightning style={{width:'12px',height:'12px',display:'inline'}}/></> : buzzed[f.id]==='sending' ? '…' : <><IconLightning style={{width:'12px',height:'12px',display:'inline'}}/> Buzz</>}
              </button>
              <button className="btn-ghost-sm" onClick={()=>openConvo(f)} style={{position:'relative'}}>
                Messages
                {unreadIds.includes(f.id) && (
                  <span style={{position:'absolute',top:'-3px',right:'-3px',width:'9px',height:'9px',borderRadius:'50%',background:'var(--accent)',border:'2px solid var(--bg)'}}/>
                )}
              </button>
            </div>
          ))
        }
      </section>
    </div>
  );
}

// A generous set of common personal fitness milestones — quick-pick templates
// that fill in type/exercise/target so people don't have to configure these by hand.
// (Used by the Personal Goals section on the Progress tab — see components/PersonalGoals.jsx)

function formatPaceSec(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ── Compete sub-tab (leaderboard, streak, challenges) ──
function CompeteTab() {
  const { user } = useAuth();
  const [board,      setBoard]      = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [metric,     setMetric]     = useState('workouts'); // workouts | volume | streak
  const [period,     setPeriod]     = useState('week');     // week|month|year|lifetime, or daily|weekly for streak
  const [showNew,    setShowNew]    = useState(false);
  const [form, setForm] = useState({ title:'', type:'most_workouts', exercise:'', targetValue:'', startDate: today(), endDate: today(), visibility:'public' });
  const [error, setError] = useState('');
  const [myVolume, setMyVolume] = useState(null);

  useEffect(() => { load(); }, [metric, period]);
  useEffect(() => {
    api.getChallenges().then(list => setChallenges(list.filter(c => c.visibility !== 'personal'))).catch(console.error);
    api.getVolume().then(v => setMyVolume(v.volume)).catch(() => {});
  }, []);

  function load() {
    api.getLeaderboard(metric, period).then(setBoard).catch(console.error);
  }
  function reloadChallenges() {
    api.getChallenges().then(list => setChallenges(list.filter(c => c.visibility !== 'personal'))).catch(console.error);
  }

  function switchMetric(m) {
    setMetric(m);
    setPeriod(m === 'streak' ? 'daily' : 'week');
  }

  async function createChallenge(e) {
    e.preventDefault(); setError('');
    try {
      await api.createChallenge(form);
      setShowNew(false);
      setForm({ title:'', type:'most_workouts', exercise:'', targetValue:'', startDate: today(), endDate: today(), visibility:'public' });
      reloadChallenges();
    } catch (err) { setError(err.message); }
  }

  async function join(id) {
    await api.joinChallenge(id);
    reloadChallenges();
  }

  const [viewingChallenge, setViewingChallenge] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [progressError, setProgressError] = useState('');

  async function viewChallenge(id) {
    setViewingChallenge(id);
    setProgressData(null);
    setProgressError('');
    try {
      const data = await api.getChallengeProgress(id);
      setProgressData(data);
    } catch (err) { setProgressError(err.message); }
  }

  const rows = board || [];
  const periodOptions = metric === 'streak' ? [['daily','Daily'],['weekly','Weekly']] : [['week','Week'],['month','Month'],['year','Year'],['lifetime','Lifetime']];

  return (
    <div>
      <section className="section">
        <div className="section-header"><span className="section-title">Leaderboard</span></div>
        <div className="tab-row" style={{marginBottom:'8px'}}>
          {[['workouts','Workouts'],['volume','Volume'],['streak','Streak']].map(([id,label]) => (
            <button key={id} className={metric===id?'tab active':'tab'} onClick={()=>switchMetric(id)}>{label}</button>
          ))}
        </div>
        <div className="tab-row" style={{marginBottom:'12px'}}>
          {periodOptions.map(([id,label]) => (
            <button key={id} className={period===id?'tab active':'tab'} onClick={()=>setPeriod(id)} style={{fontSize:'12px',padding:'6px 12px'}}>{label}</button>
          ))}
        </div>
        {!board ? <div className="spinner"/> : rows.map((r, i) => (
          <div key={r.id} className="list-item">
            <span style={{width:'22px',color:'var(--muted)',fontWeight:'700',fontSize:'13px'}}>{i+1}</span>
            <Link to={`/profile/${r.id}`} className="item-main" style={{flex:1,color:'inherit',textDecoration:'none'}}>{r.username}</Link>
            <span className="item-accent">
              {metric==='volume'
                ? `${formatCompact(displayWeight(r.value, user?.weightUnit))} ${weightUnitLabel(user?.weightUnit)}`
                : metric==='streak'
                ? <span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}>{r.value} <FireIcon size={14}/></span>
                : r.value}
            </span>
          </div>
        ))}
        {metric === 'volume' && myVolume > 0 && (() => {
          const ref = closestComparison(myVolume);
          const wu = weightUnitLabel(user?.weightUnit);
          return ref ? (
            <p className="muted" style={{fontSize:'12px',marginTop:'10px',textAlign:'center'}}>
              You've lifted {formatCompact(displayWeight(myVolume, user?.weightUnit))} {wu} all-time — that's about the same as {ref.name}!
            </p>
          ) : null;
        })()}
      </section>

      <section className="section">
        <div className="section-header">
          <span className="section-title">Challenges</span>
          <button className="link-small" style={{background:'none',border:'none',cursor:'pointer'}} onClick={()=>setShowNew(s=>!s)}>{showNew ? 'Cancel' : '+ New'}</button>
        </div>

        {viewingChallenge ? (
          <div className="card-form">
            <button className="btn-ghost-sm" style={{marginBottom:'12px'}} onClick={()=>setViewingChallenge(null)}>← Back to challenges</button>
            {progressError ? <p className="form-error">{progressError}</p> : !progressData ? <div className="spinner"/> : (
              <>
                <div style={{fontWeight:'700',fontSize:'16px',marginBottom:'4px'}}>{progressData.title}</div>
                <p className="muted" style={{fontSize:'12px',marginBottom:'14px'}}>{formatDateStr(progressData.start_date)} – {formatDateStr(progressData.end_date)}</p>
                {progressData.leaderboard.map((r, i) => (
                  <div key={r.id} className="list-item" style={{marginBottom:'6px'}}>
                    <span style={{width:'22px',color:'var(--muted)',fontWeight:'700',fontSize:'13px'}}>{i+1}</span>
                    <Link to={`/profile/${r.id}`} className="item-main" style={{flex:1,color:'inherit',textDecoration:'none'}}>{r.username}</Link>
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
                <form onSubmit={createChallenge} className="form-stack">
                  <div className="field">
                    <label className="label">Title</label>
                    <input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Most workouts in March" required />
                  </div>

                  <div className="field">
                    <label className="label">Type</label>
                    <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,exercise:'',targetValue:''}))}>
                      <option value="most_workouts">Most workouts</option>
                      <option value="total_volume">Most total volume lifted</option>
                      <option value="pr_gain">Biggest PR gain on an exercise</option>
                      <option value="bodyweight_reps">Most reps in one set (bodyweight)</option>
                      <option value="most_distance">Most cardio distance</option>
                      <option value="most_calories">Most calories burned</option>
                      <option value="most_meals_logged">Most meals logged</option>
                    </select>
                  </div>

                  {(form.type === 'pr_gain' || form.type === 'bodyweight_reps') && (
                    <div className="field">
                      <label className="label">Exercise</label>
                      <input className="input" value={form.exercise} onChange={e=>setForm(f=>({...f,exercise:e.target.value}))} placeholder={form.type==='pr_gain' ? 'Squat' : 'Push-Up'} required />
                    </div>
                  )}
                  {form.type === 'most_distance' && (
                    <div className="field">
                      <label className="label">Activity</label>
                      <select className="input" value={form.exercise} onChange={e=>setForm(f=>({...f,exercise:e.target.value}))} required>
                        <option value="" disabled>Choose an activity</option>
                        {['Running','Walking','Biking','Swimming','Rowing','Hiking'].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="input-row">
                    <div className="input-group">
                      <label className="label">Start</label>
                      <input className="input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} required/>
                    </div>
                    <div className="input-group">
                      <label className="label">End</label>
                      <input className="input" type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} required/>
                    </div>
                  </div>
                  {error && <p className="form-error">{error}</p>}
                  <button className="btn-primary" type="submit">Create Challenge</button>
                </form>
              </div>
            )}

            {challenges.length === 0 && !showNew && <p className="muted">No challenges yet. Start one above.</p>}
            {challenges.map(c => (
              <div key={c.id} className="glass-card clickable" style={{marginBottom:'10px',cursor:'pointer'}} onClick={()=>viewChallenge(c.id)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'700',fontSize:'14px'}}>{c.title}</div>
                    <div style={{fontSize:'12px',color:'var(--muted)'}}>
                      by {c.creator_username} · {formatDateStr(c.start_date)} – {formatDateStr(c.end_date)}
                    </div>
                  </div>
                  {!c.joined && <button className="btn-accent-sm" onClick={(e)=>{e.stopPropagation();join(c.id);}}>Join</button>}
                  {c.joined && <span style={{fontSize:'11px',color:'var(--teal)',fontWeight:'700'}}>Joined</span>}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

// ── Crews sub-tab ──
function CrewsTab() {
  const { user } = useAuth();
  const [crews,   setCrews]   = useState([]);
  const [invites, setInvites] = useState([]);
  const [active,  setActive]  = useState(null);
  const [name,    setName]    = useState('');
  const [msgText, setMsgText] = useState('');
  const [friends, setFriends] = useState([]);
  const [invited, setInvited] = useState({});
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.getCrews().then(setCrews).catch(console.error);
    api.getCrewInvites().then(setInvites).catch(console.error);
    api.getFriends().then(f => setFriends(f.filter(x=>x.status==='accepted'))).catch(console.error);
  }, []);

  async function createCrew(e) {
    e.preventDefault(); setError('');
    try {
      await api.createCrew({ name });
      setName('');
      setCrews(await api.getCrews());
    } catch (err) { setError(err.message); }
  }

  async function respondInvite(id, accept) {
    if (accept) await api.acceptCrewInvite(id); else await api.declineCrewInvite(id);
    setInvites(await api.getCrewInvites());
    if (accept) setCrews(await api.getCrews());
  }

  async function openCrew(id) {
    const crew = await api.getCrew(id);
    const messages = await api.getCrewMessages(id);
    setActive({ crew, messages });
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!msgText.trim() || !active) return;
    await api.sendCrewMessage(active.crew.id, { message: msgText });
    const messages = await api.getCrewMessages(active.crew.id);
    setActive(a => ({ ...a, messages }));
    setMsgText('');
  }

  async function inviteFriend(friendId) {
    try {
      await api.addCrewMember(active.crew.id, { friendId });
      setInvited(i => ({ ...i, [friendId]: true }));
    } catch (err) { setError(err.message); }
  }

  if (active) {
    const memberIds = new Set(active.crew.members.map(m=>m.id));
    const invitable = friends.filter(f => !memberIds.has(f.id) && !invited[f.id]);
    return (
      <div>
        <button className="btn-ghost" onClick={()=>setActive(null)} style={{marginBottom:'12px'}}>← Back</button>
        <h3 style={{marginBottom:'6px'}}>{active.crew.name}</h3>
        <p className="muted" style={{marginBottom:'12px'}}>{active.crew.members.map(m=>m.username).join(', ')}</p>

        {invitable.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'14px'}}>
            {invitable.map(f => (
              <button key={f.id} className="btn-ghost-sm" onClick={()=>inviteFriend(f.id)}>+ Invite {f.username}</button>
            ))}
          </div>
        )}
        {error && <p className="form-error" style={{marginBottom:'12px'}}>{error}</p>}

        <div className="messages">
          {active.messages.map(m => (
            <div key={m.id} className={`message ${m.user_id === user.id ? 'mine' : 'theirs'}`}>
              {m.user_id !== user.id && <Link to={`/profile/${m.user_id}`} style={{fontSize:'11px',color:'var(--muted)',marginBottom:'2px',display:'block'}}>{m.username}</Link>}
              <span className="msg-text">{m.message}</span>
              <span className="msg-time">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          ))}
          {active.messages.length === 0 && <p className="muted">No messages yet. Say hi to the crew!</p>}
        </div>
        <form onSubmit={sendMsg} className="msg-form">
          <input className="input" placeholder="Message the crew…" value={msgText} onChange={e=>setMsgText(e.target.value)} />
          <button className="btn-primary" type="submit">Send</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {invites.length > 0 && (
        <section className="section">
          <div className="section-header"><span className="section-title">Crew Invites</span></div>
          {invites.map(inv => (
            <div key={inv.id} className="glass-card" style={{marginBottom:'10px'}}>
              <div style={{fontWeight:'700',fontSize:'14px'}}>{inv.inviter_username} invited you to "{inv.crew_name}"</div>
              <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                <button className="btn-accent-sm" onClick={()=>respondInvite(inv.id,true)}>Accept</button>
                <button className="btn-ghost-sm" onClick={()=>respondInvite(inv.id,false)}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="card-form">
        <form onSubmit={createCrew} className="form-stack">
          <div className="field">
            <label className="label">New crew name</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Leg Day Legends" required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit">Create Crew</button>
        </form>
      </div>
      {crews.length === 0
        ? <p className="muted">No crews yet — start one above.</p>
        : crews.map(c => (
          <div key={c.id} className="list-item clickable" onClick={()=>openCrew(c.id)}>
            <div style={{flex:1}}>
              <div className="item-main">{c.name}</div>
              <div className="item-meta">{c.member_count} member{c.member_count===1?'':'s'}</div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ── Invites sub-tab (train-together) ──
function InvitesTab() {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [friends, setFriends] = useState([]);
  const [form, setForm] = useState({ receiverId:'', proposedAt:'', message:'' });
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInvites().then(setInvites).catch(console.error);
    api.getFriends().then(f => setFriends(f.filter(x=>x.status==='accepted'))).catch(console.error);
  }, []);

  async function send(e) {
    e.preventDefault(); setError('');
    try {
      await api.sendInvite(form);
      setShowNew(false);
      setForm({ receiverId:'', proposedAt:'', message:'' });
      setInvites(await api.getInvites());
    } catch (err) { setError(err.message); }
  }

  async function respond(id, accept) {
    if (accept) await api.acceptInvite(id); else await api.declineInvite(id);
    setInvites(await api.getInvites());
  }

  const upcoming = invites.filter(i => i.status !== 'declined').sort((a,b)=>new Date(a.proposed_at)-new Date(b.proposed_at));

  return (
    <div>
      <div className="section-header" style={{marginBottom:'12px'}}>
        <span className="section-title">Train Together</span>
        <button className="link-small" style={{background:'none',border:'none',cursor:'pointer'}} onClick={()=>setShowNew(s=>!s)}>{showNew ? 'Cancel' : '+ New'}</button>
      </div>

      {showNew && (
        <div className="card-form">
          <form onSubmit={send} className="form-stack">
            <div className="field">
              <label className="label">Friend</label>
              <select className="input" value={form.receiverId} onChange={e=>setForm(f=>({...f,receiverId:e.target.value}))} required>
                <option value="" disabled>Select a friend</option>
                {friends.map(f => <option key={f.id} value={f.id}>{f.username}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">When</label>
              <input className="input" type="datetime-local" value={form.proposedAt} onChange={e=>setForm(f=>({...f,proposedAt:e.target.value}))} required />
            </div>
            <div className="field">
              <label className="label">Message (optional)</label>
              <input className="input" value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} placeholder="Leg day?" />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" type="submit">Send Invite</button>
          </form>
        </div>
      )}

      {upcoming.length === 0 && !showNew && <p className="muted">No invites yet.</p>}
      {upcoming.map(i => {
        const mine = i.sender_id === user.id;
        const other = mine ? i.receiver_username : i.sender_username;
        return (
          <div key={i.id} className="glass-card" style={{marginBottom:'10px'}}>
            <div style={{fontWeight:'700',fontSize:'14px'}}>{mine ? `You invited ${other}` : `${other} wants to train`}</div>
            <div style={{fontSize:'12px',color:'var(--muted)',margin:'4px 0'}}>
              {new Date(i.proposed_at).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
              {i.message ? ` — ${i.message}` : ''}
            </div>
            {i.status === 'pending' && !mine && (
              <div style={{display:'flex',gap:'8px',marginTop:'6px'}}>
                <button className="btn-accent-sm" onClick={()=>respond(i.id,true)}>Accept</button>
                <button className="btn-ghost-sm" onClick={()=>respond(i.id,false)}>Decline</button>
              </div>
            )}
            {i.status !== 'pending' && (
              <span style={{fontSize:'11px',fontWeight:'700',color:i.status==='accepted'?'var(--teal)':'var(--muted)'}}>
                {i.status === 'accepted' ? 'Accepted' : 'Declined'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Social() {
  const [tab, setTab] = useState('friends');

  return (
    <div className="page">
      <h2 className="page-title">Social</h2>
      <div className="tab-row" style={{marginBottom:'16px'}}>
        {[['friends','Friends'],['compete','Compete'],['crews','Crews'],['invites','Invites']].map(([id,label]) => (
          <button key={id} className={tab===id?'tab active':'tab'} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'friends' && <FriendsTab />}
      {tab === 'compete' && <CompeteTab />}
      {tab === 'crews' && <CrewsTab />}
      {tab === 'invites' && <InvitesTab />}
    </div>
  );
}
