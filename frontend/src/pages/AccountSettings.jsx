import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { IconChevron, IconSun, IconMoon } from '../components/Icons';
import { enablePush, disablePush, getPushStatus } from '../push';
import ProfileEditModal from '../components/ProfileEditModal';
import { MAP_STYLES, MAP_STYLE_STORAGE_KEY, getSavedMapStyle } from '../data/mapStyles';

const FEED_TYPES = [
  { key: 'workout',   label: 'Workouts',   meta: 'When you or a friend logs a workout' },
  { key: 'pr',        label: 'PRs',        meta: 'When you or a friend sets a personal record' },
  { key: 'meal',      label: 'Meals',      meta: 'When you or a friend logs a meal' },
  { key: 'challenge', label: 'Challenges', meta: 'When you or a friend starts or joins a challenge' },
];

export default function AccountSettings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pushStatus,   setPushStatus]   = useState('unknown');
  const [mwSummaryCount, setMwSummaryCount] = useState(0);
  const [mapStyle, setMapStyle] = useState(getSavedMapStyle);
  const [error, setError] = useState('');

  // Kroger connection
  const [krogerStatus, setKrogerStatus] = useState({ connected: false, locationId: null, locationName: null });
  const [krogerLoading, setKrogerLoading] = useState(true);
  const [krogerMsg, setKrogerMsg] = useState('');
  const [zip, setZip] = useState('');
  const [storeOptions, setStoreOptions] = useState([]);
  const [searchingStores, setSearchingStores] = useState(false);

  function loadKrogerStatus() {
    api.getKrogerStatus().then(setKrogerStatus).catch(()=>{}).finally(()=>setKrogerLoading(false));
  }

  useEffect(() => {
    loadKrogerStatus();
    const flag = searchParams.get('kroger');
    if (flag === 'connected') setKrogerMsg('Kroger account connected!');
    else if (flag === 'denied') setKrogerMsg('Kroger connection was cancelled.');
    else if (flag === 'error') setKrogerMsg("Something went wrong connecting Kroger — please try again.");
    if (flag) {
      searchParams.delete('kroger');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectKroger() {
    try {
      const { url } = await api.getKrogerConnectUrl();
      window.location.href = url;
    } catch (err) { setError(err.message); }
  }

  async function disconnectKroger() {
    try {
      await api.disconnectKroger();
      setKrogerStatus({ connected: false, locationId: null, locationName: null });
      setStoreOptions([]);
    } catch (err) { setError(err.message); }
  }

  async function findStores(e) {
    e.preventDefault();
    setSearchingStores(true); setError('');
    try {
      const { stores } = await api.searchKrogerStores(zip);
      setStoreOptions(stores);
    } catch (err) { setError(err.message); }
    finally { setSearchingStores(false); }
  }

  async function pickStore(store) {
    try {
      await api.setKrogerLocation(store.locationId, store.name);
      setKrogerStatus(s => ({ ...s, locationId: store.locationId, locationName: store.name }));
      setStoreOptions([]);
    } catch (err) { setError(err.message); }
  }

  // Feed preferences
  const [feedTypes, setFeedTypesState] = useState(null); // null = all types shown
  const [friends, setFriends] = useState([]);
  const [mutedIds, setMutedIds] = useState(new Set());
  const [feedPrefsLoading, setFeedPrefsLoading] = useState(true);
  const [showFriendFeedList, setShowFriendFeedList] = useState(false);

  function selectMapStyle(style) {
    setMapStyle(style);
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, style);
  }
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAccount, setShowAccount] = useState(null); // 'username' | 'email' | 'password' | null
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'));
    api.getProfile().then(d => {
      if (d.profile) setMwSummaryCount(Object.values(d.profile).filter(v => v && (!Array.isArray(v) || v.length>0)).length);
    }).catch(()=>{});

    Promise.all([api.getFeedPrefs(), api.getFriends()])
      .then(([prefs, friendList]) => {
        setFeedTypesState(prefs.feedTypes); // null or array
        setMutedIds(new Set((prefs.mutedFriends || []).map(f => f.id)));
        setFriends(friendList || []);
      })
      .catch(() => {})
      .finally(() => setFeedPrefsLoading(false));
  }, []);

  // All types on by default (feedTypes === null); toggling one off when
  // starting from "all" means: start from the full set minus this one.
  const allTypeKeys = FEED_TYPES.map(t => t.key);
  const activeTypes = feedTypes === null ? allTypeKeys : feedTypes;
  async function toggleFeedType(key) {
    const next = activeTypes.includes(key) ? activeTypes.filter(k => k !== key) : [...activeTypes, key];
    // If everything ends up selected, store as "all" (null) rather than an
    // explicit list, matching how the backend treats an empty/full list.
    const toSave = next.length === allTypeKeys.length ? [] : next;
    setFeedTypesState(next.length === allTypeKeys.length ? null : next);
    try { await api.updateFeedTypes(toSave); } catch (err) { setError(err.message); }
  }

  async function toggleFriendInFeed(friendId) {
    const isMuted = mutedIds.has(friendId);
    setMutedIds(prev => {
      const next = new Set(prev);
      isMuted ? next.delete(friendId) : next.add(friendId);
      return next;
    });
    try {
      if (isMuted) await api.unmuteFriendFeed(friendId);
      else await api.muteFriendFeed(friendId);
    } catch (err) { setError(err.message); }
  }

  async function saveUsername(e) {
    e.preventDefault();
    setAccountError(''); setAccountSuccess(''); setSavingAccount(true);
    try {
      const res = await api.changeUsername({ newUsername: usernameInput });
      updateUser({ username: res.username });
      setAccountSuccess('Username updated.');
      setShowAccount(null);
    } catch (err) { setAccountError(err.message); }
    finally { setSavingAccount(false); }
  }

  async function saveEmail(e) {
    e.preventDefault();
    setAccountError(''); setAccountSuccess(''); setSavingAccount(true);
    try {
      const res = await api.changeEmail({ newEmail: emailInput, currentPassword: currentPw });
      updateUser({ email: res.email });
      setAccountSuccess('Email updated.');
      setShowAccount(null); setCurrentPw('');
    } catch (err) { setAccountError(err.message); }
    finally { setSavingAccount(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    setAccountError(''); setAccountSuccess('');
    if (newPw !== confirmPw) { setAccountError("New passwords don't match."); return; }
    setSavingAccount(true);
    try {
      await api.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setAccountSuccess('Password updated.');
      setShowAccount(null); setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) { setAccountError(err.message); }
    finally { setSavingAccount(false); }
  }

  async function setTheme(theme) {
    updateUser({ theme }); // apply instantly
    try { await api.updateTheme(theme); } catch {} // persisted best-effort
  }

  async function toggleNotifyBuzz() {
    const next = !user.notifyBuzz;
    updateUser({ notifyBuzz: next });
    try { await api.updateAccountSettings({ notifyBuzz: next }); } catch {}
  }
  async function toggleNotifyMessages() {
    const next = !user.notifyMessages;
    updateUser({ notifyMessages: next });
    try { await api.updateAccountSettings({ notifyMessages: next }); } catch {}
  }
  async function toggleNotifyReactions() {
    const next = !user.notifyReactions;
    updateUser({ notifyReactions: next });
    try { await api.updateAccountSettings({ notifyReactions: next }); } catch {}
  }
  async function toggleNotifyFriendRequests() {
    const next = !user.notifyFriendRequests;
    updateUser({ notifyFriendRequests: next });
    try { await api.updateAccountSettings({ notifyFriendRequests: next }); } catch {}
  }
  async function toggleNotifyInvites() {
    const next = !user.notifyInvites;
    updateUser({ notifyInvites: next });
    try { await api.updateAccountSettings({ notifyInvites: next }); } catch {}
  }

  async function setWeightUnit(unit) {
    updateUser({ weightUnit: unit });
    try { await api.updateAccountSettings({ weightUnit: unit }); } catch {}
  }
  async function setDistanceUnit(unit) {
    updateUser({ distanceUnit: unit });
    try { await api.updateAccountSettings({ distanceUnit: unit }); } catch {}
  }
  async function togglePush() {
    try {
      if (pushStatus === 'subscribed') { await disablePush(); setPushStatus('not-subscribed'); }
      else { await enablePush(); setPushStatus('subscribed'); }
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="page">
      <button className="btn-ghost" onClick={() => navigate('/settings')} style={{marginBottom:'16px'}}>← Back to Profile</button>
      <h2 className="page-title">Settings</h2>
      {error && <p className="form-error">{error}</p>}

      {/* Account */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Account</span>
        </div>
        {accountSuccess && <p className="form-success" style={{marginBottom:'8px'}}>{accountSuccess}</p>}

        <div className="list-item clickable" onClick={()=>{setShowAccount(s=>s==='username'?null:'username'); setAccountError('');}}>
          <div style={{flex:1}}>
            <div className="item-main">Username</div>
            <div className="item-meta">{user?.username}</div>
          </div>
          <IconChevron style={{width:'16px',height:'16px',color:'var(--muted)'}}/>
        </div>
        {showAccount === 'username' && (
          <form onSubmit={saveUsername} className="card-form form-stack" style={{marginBottom:'10px'}}>
            <div className="field">
              <label className="label">New Username</label>
              <input className="input" value={usernameInput} onChange={e=>setUsernameInput(e.target.value)} required/>
            </div>
            {accountError && <p className="form-error">{accountError}</p>}
            <button className="btn-primary" type="submit" disabled={savingAccount}>{savingAccount?'Saving…':'Save Username'}</button>
          </form>
        )}

        <div className="list-item clickable" onClick={()=>{setShowAccount(s=>s==='email'?null:'email'); setAccountError('');}}>
          <div style={{flex:1}}>
            <div className="item-main">Email</div>
            <div className="item-meta">{user?.email}</div>
          </div>
          <IconChevron style={{width:'16px',height:'16px',color:'var(--muted)'}}/>
        </div>
        {showAccount === 'email' && (
          <form onSubmit={saveEmail} className="card-form form-stack" style={{marginBottom:'10px'}}>
            <div className="field">
              <label className="label">New Email</label>
              <input className="input" type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} required/>
            </div>
            <div className="field">
              <label className="label">Current Password</label>
              <input className="input" type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} placeholder="Leave blank if you use Google sign-in"/>
            </div>
            {accountError && <p className="form-error">{accountError}</p>}
            <button className="btn-primary" type="submit" disabled={savingAccount}>{savingAccount?'Saving…':'Save Email'}</button>
          </form>
        )}

        <div className="list-item clickable" onClick={()=>{setShowAccount(s=>s==='password'?null:'password'); setAccountError('');}}>
          <div style={{flex:1}}>
            <div className="item-main">Password</div>
            <div className="item-meta">Change your password</div>
          </div>
          <IconChevron style={{width:'16px',height:'16px',color:'var(--muted)'}}/>
        </div>
        {showAccount === 'password' && (
          <form onSubmit={savePassword} className="card-form form-stack">
            <div className="field">
              <label className="label">Current Password</label>
              <input className="input" type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} placeholder="Leave blank if you use Google sign-in"/>
            </div>
            <div className="field">
              <label className="label">New Password</label>
              <input className="input" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} required/>
            </div>
            <div className="field">
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} required/>
              {confirmPw && newPw !== confirmPw && <p className="form-error" style={{fontSize:'12px',marginTop:'4px'}}>Passwords don't match.</p>}
            </div>
            {accountError && <p className="form-error">{accountError}</p>}
            <button className="btn-primary" type="submit" disabled={savingAccount || (confirmPw && newPw !== confirmPw)}>{savingAccount?'Saving…':'Save Password'}</button>
          </form>
        )}
      </div>

      {/* Appearance */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Appearance</span>
        </div>
        <div className="tab-row" style={{marginBottom:'14px'}}>
          <button className={user?.theme !== 'dark' ? 'tab active' : 'tab'} onClick={() => setTheme('light')} style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center'}}><IconSun style={{width:'15px',height:'15px'}}/> Light</button>
          <button className={user?.theme === 'dark' ? 'tab active' : 'tab'} onClick={() => setTheme('dark')} style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center'}}><IconMoon style={{width:'15px',height:'15px'}}/> Dark</button>
        </div>
        <div className="item-meta" style={{marginBottom:'6px'}}>Map style (used when tracking a run, walk, or bike)</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
          {Object.entries(MAP_STYLES).map(([key, s]) => (
            <button key={key} type="button" className={mapStyle===key?'tab active':'tab'} onClick={()=>selectMapStyle(key)} style={{flex:'1 1 auto',minWidth:'80px'}}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Notifications</span>
        </div>
        {pushStatus !== 'unsupported' && pushStatus !== 'denied' && (
          <div className="list-item">
            <div style={{flex:1}}>
              <div className="item-main">Push notifications</div>
              <div className="item-meta">{pushStatus === 'subscribed' ? 'Enabled on this device' : 'Off on this device'}</div>
            </div>
            <button className="btn-ghost-sm" onClick={togglePush}>{pushStatus === 'subscribed' ? 'Turn off' : 'Enable'}</button>
          </div>
        )}
        {pushStatus === 'denied' && (
          <p className="muted" style={{fontSize:'12px',marginBottom:'10px'}}>Notifications are blocked in your browser settings — enable them there first.</p>
        )}
        <label className="list-item" style={{cursor:'pointer'}}>
          <div style={{flex:1}}>
            <div className="item-main">Buzz from friends</div>
            <div className="item-meta">A friend nudging you to work out</div>
          </div>
          <input type="checkbox" checked={user?.notifyBuzz !== false} onChange={toggleNotifyBuzz} style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
        </label>
        <label className="list-item" style={{cursor:'pointer'}}>
          <div style={{flex:1}}>
            <div className="item-main">Messages</div>
            <div className="item-meta">New direct messages from friends</div>
          </div>
          <input type="checkbox" checked={user?.notifyMessages !== false} onChange={toggleNotifyMessages} style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
        </label>
        <label className="list-item" style={{cursor:'pointer'}}>
          <div style={{flex:1}}>
            <div className="item-main">Reactions</div>
            <div className="item-meta">Someone reacts to your feed post</div>
          </div>
          <input type="checkbox" checked={user?.notifyReactions !== false} onChange={toggleNotifyReactions} style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
        </label>
        <label className="list-item" style={{cursor:'pointer'}}>
          <div style={{flex:1}}>
            <div className="item-main">Friend requests</div>
            <div className="item-meta">Someone sends or accepts a friend request</div>
          </div>
          <input type="checkbox" checked={user?.notifyFriendRequests !== false} onChange={toggleNotifyFriendRequests} style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
        </label>
        <label className="list-item" style={{cursor:'pointer'}}>
          <div style={{flex:1}}>
            <div className="item-main">Train-together invites</div>
            <div className="item-meta">A friend invites you to train together</div>
          </div>
          <input type="checkbox" checked={user?.notifyInvites !== false} onChange={toggleNotifyInvites} style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
        </label>
      </div>

      {/* Feed Preferences */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Feed Preferences</span>
        </div>
        <p className="muted" style={{fontSize:'12px',marginBottom:'10px'}}>Choose what shows up in your feed, from you and your friends.</p>
        {feedPrefsLoading ? <div className="spinner" style={{margin:'10px auto'}}/> : (
          <>
            {FEED_TYPES.map(t => (
              <label key={t.key} className="list-item" style={{cursor:'pointer'}}>
                <div style={{flex:1}}>
                  <div className="item-main">{t.label}</div>
                  <div className="item-meta">{t.meta}</div>
                </div>
                <input type="checkbox" checked={activeTypes.includes(t.key)} onChange={()=>toggleFeedType(t.key)}
                  style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
              </label>
            ))}

            <div className="list-item clickable" style={{cursor:'pointer',marginTop:'8px'}} onClick={()=>setShowFriendFeedList(s=>!s)}>
              <div style={{flex:1}}>
                <div className="item-main">Friends in your feed</div>
                <div className="item-meta">{mutedIds.size > 0 ? `${mutedIds.size} friend${mutedIds.size===1?'':'s'} hidden` : 'All friends shown'}</div>
              </div>
              <IconChevron style={{width:'16px',height:'16px',color:'var(--muted)',transform: showFriendFeedList ? 'rotate(90deg)' : 'none'}}/>
            </div>
            {showFriendFeedList && (
              friends.length === 0 ? <p className="muted" style={{fontSize:'12px',padding:'8px 0'}}>No friends yet.</p> :
              friends.map(f => (
                <label key={f.id} className="list-item" style={{cursor:'pointer'}}>
                  <div style={{flex:1}}>
                    <div className="item-main">{f.username}</div>
                  </div>
                  <input type="checkbox" checked={!mutedIds.has(f.id)} onChange={()=>toggleFriendInFeed(f.id)}
                    style={{width:'18px',height:'18px',accentColor:'var(--accent)'}} />
                </label>
              ))
            )}
          </>
        )}
      </div>

      {/* Kroger connection */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Kroger</span>
        </div>
        <p className="muted" style={{fontSize:'12px',marginBottom:'12px'}}>Connect your Kroger account (also covers Ralphs, Fred Meyer, King Soopers, Smith's, Fry's, and other Kroger-family stores) to add a meal plan's shopping list straight into your Kroger cart.</p>
        {krogerMsg && <p className={krogerStatus.connected ? 'form-success' : 'muted'} style={{fontSize:'12px',marginBottom:'10px'}}>{krogerMsg}</p>}
        {error && <p className="form-error" style={{fontSize:'12px',marginBottom:'10px'}}>{error}</p>}

        {krogerLoading ? <div className="spinner" style={{margin:'10px auto'}}/> : !krogerStatus.configured ? (
          <p className="muted" style={{fontSize:'12px'}}>Kroger ordering isn't available yet — check back soon.</p>
        ) : !krogerStatus.connected ? (
          <button className="btn-secondary" onClick={connectKroger}>Connect Kroger Account</button>
        ) : (
          <>
            <div className="list-item" style={{marginBottom:'10px'}}>
              <div style={{flex:1}}>
                <div className="item-main">Connected</div>
                <div className="item-meta">{krogerStatus.locationName || 'No store selected yet'}</div>
              </div>
              <button className="btn-ghost-sm" onClick={disconnectKroger}>Disconnect</button>
            </div>

            <form onSubmit={findStores} style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
              <input className="input" placeholder="ZIP code" value={zip} onChange={e=>setZip(e.target.value)} style={{flex:1}}/>
              <button className="btn-ghost-sm" type="submit" disabled={searchingStores}>{searchingStores ? 'Searching…' : (krogerStatus.locationId ? 'Change Store' : 'Find Stores')}</button>
            </form>
            {storeOptions.length > 0 && (
              <div style={{border:'1px solid var(--border)',borderRadius:'var(--r-sm)',overflow:'hidden'}}>
                {storeOptions.map(s => (
                  <div key={s.locationId} className="list-item clickable" style={{cursor:'pointer'}} onClick={()=>pickStore(s)}>
                    <div style={{flex:1}}>
                      <div className="item-main">{s.name}</div>
                      <div className="item-meta">{s.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Meal & Workout Profile */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Meal & Workout Profile</span>
        </div>
        <p className="muted" style={{fontSize:'12px',marginBottom:'12px'}}>Used to build your AI meal and workout plans.</p>
        <div className="list-item clickable" onClick={()=>setShowProfileModal(true)} style={{cursor:'pointer'}}>
          <div style={{flex:1}}>
            <div className="item-main">{mwSummaryCount > 0 ? `${mwSummaryCount} detail${mwSummaryCount===1?'':'s'} saved` : 'Not set up yet'}</div>
            <div className="item-meta">Tap to view, edit, or reset</div>
          </div>
          <IconChevron style={{width:'16px',height:'16px',color:'var(--muted)'}}/>
        </div>
      </div>

      {showProfileModal && (
        <ProfileEditModal
          onClose={()=>setShowProfileModal(false)}
          onSaved={(p)=>setMwSummaryCount(Object.values(p).filter(v => v && (!Array.isArray(v) || v.length>0)).length)}
        />
      )}

      {/* Units */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Units</span>
        </div>
        <div className="tab-row" style={{marginBottom:'10px'}}>
          <button className={user?.weightUnit !== 'kg' ? 'tab active' : 'tab'} onClick={()=>setWeightUnit('lbs')}>Pounds (lbs)</button>
          <button className={user?.weightUnit === 'kg' ? 'tab active' : 'tab'} onClick={()=>setWeightUnit('kg')}>Kilograms (kg)</button>
        </div>
        <div className="tab-row">
          <button className={user?.distanceUnit !== 'km' ? 'tab active' : 'tab'} onClick={()=>setDistanceUnit('mi')}>Miles</button>
          <button className={user?.distanceUnit === 'km' ? 'tab active' : 'tab'} onClick={()=>setDistanceUnit('km')}>Kilometers</button>
        </div>
      </div>

      {/* Nav shortcuts */}
      <div className="settings-group" style={{marginBottom:'16px'}}>
        {[
          { label:'Dashboard',  path:'/dashboard' },
          { label:'Feed',       path:'/feed'       },
          { label:'Meal Plans', path:'/meals/plans' },
          { label:'Social',     path:'/social'     },
        ].map(({label,path}) => (
          <div key={path} className="settings-item" onClick={() => navigate(path)}>
            <span className="settings-label">{label}</span>
            <IconChevron style={{width:'18px',height:'18px',color:'var(--muted)'}}/>
          </div>
        ))}
      </div>

      <div className="settings-group" style={{marginBottom:'16px'}}>
        <div className="settings-item" onClick={() => navigate('/tutorial')}>
          <span className="settings-label">Replay Tutorial</span>
          <IconChevron style={{width:'18px',height:'18px',color:'var(--muted)'}}/>
        </div>
      </div>

      {user?.isAdmin && (
        <div className="settings-group" style={{marginBottom:'16px'}}>
          <div className="settings-item" onClick={() => navigate('/admin')}>
            <span className="settings-label" style={{color:'var(--accent)',fontWeight:'700'}}>Admin Panel</span>
            <IconChevron style={{width:'18px',height:'18px',color:'var(--muted)'}}/>
          </div>
        </div>
      )}

      <div className="settings-group">
        <div className="settings-item" onClick={() => { logout(); navigate('/'); }}>
          <span className="settings-label" style={{color:'var(--danger)'}}>Log Out</span>
        </div>
      </div>
    </div>
  );
}
