import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { IconEdit, IconCheck, IconGear, IconChevron, IconSun, IconMoon } from '../components/Icons';
import AchievementIcon from '../components/AchievementIcon';
import ProfileEditModal from '../components/ProfileEditModal';
import { compressImage } from '../compressImage';
import { MAP_STYLES, MAP_STYLE_STORAGE_KEY, getSavedMapStyle } from '../data/mapStyles';

// The Profile page carries everything about *you and your account* — identity,
// login details, appearance, units, connected stores, the meal/workout profile.
// The Settings page (/account) is only Notifications and Feed Preferences.

// How-to descriptions for each achievement
const HOW_TO = {
  first_workout:   'Log your very first workout in the Log tab.',
  five_workouts:   'Log 5 workouts total. Keep showing up!',
  ten_workouts:    'Log 10 workouts. You\'re building a real habit.',
  twenty_workouts: 'Log 20 workouts. Consistency is everything.',
  fifty_workouts:  'Log 50 workouts. You\'re fully dedicated.',
  hundred_workouts:'Log 100 workouts. The century club — elite status.',
  first_pr:        'Set a personal record on any exercise by logging a heavier weight than before.',
  five_prs:        'Set 5 personal records across any combination of exercises.',
  ten_prs:         'Set 10 personal records. You are breaking limits.',
  first_photo:     'Upload your first progress photo in the Photos tab.',
  five_photos:     'Upload 5 progress photos to track your transformation.',
  first_friend:    'Add your first friend in the Friends tab.',
  three_friends:   'Add 3 friends. The more the merrier.',
  five_friends:    'Add 5 friends and build your fitness squad.',
  first_message:   'Send a message to one of your friends.',
  first_meal:      'Generate your first meal plan in the Meals tab.',
  three_meals:     'Generate 3 meal plans. Healthy eating is a lifestyle.',
  has_avatar:      'Upload a profile photo by tapping your avatar at the top of this page.',
};

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef  = useRef();
  const [uploading,    setUploading]    = useState(false);
  const [success,      setSuccess]      = useState('');
  const [error,        setError]        = useState('');
  const [achievements, setAchievements] = useState([]);
  const [loadingAch,   setLoadingAch]   = useState(true);
  const [showAll,      setShowAll]      = useState(false);
  const [expanded,     setExpanded]     = useState(null);
  const [bio,          setBio]          = useState(user?.bio || '');
  const [savingBio,    setSavingBio]    = useState(false);

  // Account details
  const [showAccount,    setShowAccount]    = useState(null); // 'username' | 'email' | 'password' | null
  const [usernameInput,  setUsernameInput]  = useState(user?.username || '');
  const [emailInput,     setEmailInput]     = useState(user?.email || '');
  const [currentPw,      setCurrentPw]      = useState('');
  const [newPw,          setNewPw]          = useState('');
  const [confirmPw,      setConfirmPw]      = useState('');
  const [accountError,   setAccountError]   = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [savingAccount,  setSavingAccount]  = useState(false);

  // Appearance
  const [mapStyle, setMapStyle] = useState(getSavedMapStyle);

  // Meal & workout profile
  const [mwSummaryCount,   setMwSummaryCount]   = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Kroger connection
  const [krogerStatus,    setKrogerStatus]    = useState({ connected: false, locationId: null, locationName: null });
  const [krogerLoading,   setKrogerLoading]   = useState(true);
  const [krogerMsg,       setKrogerMsg]       = useState('');
  const [zip,             setZip]             = useState('');
  const [storeOptions,    setStoreOptions]    = useState([]);
  const [searchingStores, setSearchingStores] = useState(false);

  const initials  = user?.username?.slice(0,2).toUpperCase() || 'FT';
  const avatarUrl = user?.avatarUrl ? api.fileUrl(user.avatarUrl) : null;

  useEffect(() => {
    api.getAchievements()
      .then(d => setAchievements(d.achievements || []))
      .catch(() => {})
      .finally(() => setLoadingAch(false));

    api.getProfile().then(d => {
      if (d.profile) setMwSummaryCount(Object.values(d.profile).filter(v => v && (!Array.isArray(v) || v.length>0)).length);
    }).catch(()=>{});

    api.getKrogerStatus().then(setKrogerStatus).catch(()=>{}).finally(()=>setKrogerLoading(false));

    // Kroger sends the browser back here after the user authorizes.
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

  async function onAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const compressed = await compressImage(file, { maxDimension: 800, quality: 0.85 });
      const fd = new FormData();
      fd.append('avatar', compressed);
      const data = await api.uploadAvatar(fd);
      updateUser({ avatarUrl: data.avatarUrl });
      setSuccess('Profile photo updated!');
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function saveBio() {
    setSavingBio(true);
    try {
      await api.updateAccountSettings({ bio });
      updateUser({ bio });
      setSuccess('Bio updated!');
    } catch (err) { setError(err.message); }
    finally { setSavingBio(false); }
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

  function selectMapStyle(style) {
    setMapStyle(style);
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, style);
  }

  async function setWeightUnit(unit) {
    updateUser({ weightUnit: unit });
    try { await api.updateAccountSettings({ weightUnit: unit }); } catch {}
  }
  async function setDistanceUnit(unit) {
    updateUser({ distanceUnit: unit });
    try { await api.updateAccountSettings({ distanceUnit: unit }); } catch {}
  }

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

  const unlocked = achievements.filter(a => a.unlocked);
  const displayed = showAll ? achievements : achievements.slice(0, 9);

  return (
    <div className="page">
      <h2 className="page-title">Profile</h2>

      {/* Avatar */}
      <div className="profile-section">
        <div className="profile-avatar-wrap" onClick={() => fileRef.current?.click()}>
          <div className="profile-avatar-large">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span className="profile-avatar-initials-lg">{initials}</span>
            }
          </div>
          <div className="avatar-edit-badge">
            <IconEdit style={{width:'11px',height:'11px',color:'#fff'}}/>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" style={{display:'none'}} onChange={onAvatarChange}/>
        <div className="profile-name">{user?.username}</div>
        <div className="profile-email">{user?.email}</div>
        {uploading && <p className="muted" style={{fontSize:'12px'}}>Uploading…</p>}
        {success   && <p className="form-success">{success}</p>}
        {error     && <p className="form-error">{error}</p>}
        <p className="muted" style={{fontSize:'12px',marginTop:'4px'}}>Tap photo to change</p>
      </div>

      {/* Notifications and feed preferences are the only things on their own page now. */}
      <button className="btn-secondary" style={{width:'100%',marginBottom:'20px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
        onClick={()=>navigate('/account')}>
        <IconGear style={{width:'16px',height:'16px'}}/> Notifications &amp; Feed
      </button>

      {/* Bio */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">About You</span>
        </div>
        <textarea className="input" rows={3} placeholder="Tell friends a bit about yourself…" maxLength={280}
          value={bio} onChange={e => setBio(e.target.value)} />
        <button className="btn-ghost-sm" style={{marginTop:'8px'}} onClick={saveBio} disabled={savingBio}>
          {savingBio ? 'Saving…' : 'Save Bio'}
        </button>
      </div>

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

      {/* Meal & Workout Profile */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Meal &amp; Workout Profile</span>
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

      {/* Kroger connection */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Kroger</span>
        </div>
        <p className="muted" style={{fontSize:'12px',marginBottom:'12px'}}>Connect your Kroger account (also covers Ralphs, Fred Meyer, King Soopers, Smith's, Fry's, and other Kroger-family stores) to add a meal plan's shopping list straight into your Kroger cart.</p>
        {krogerMsg && <p className={krogerStatus.connected ? 'form-success' : 'muted'} style={{fontSize:'12px',marginBottom:'10px'}}>{krogerMsg}</p>}

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

      {/* Achievements */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Achievements</span>
          <span style={{fontSize:'13px',color:'var(--teal)',fontWeight:'600'}}>
            {unlocked.length}/{achievements.length} unlocked
          </span>
        </div>

        {loadingAch ? <div className="spinner" style={{margin:'20px auto'}}/> : (
          <>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
              {displayed.map(a => (
                <div key={a.id}
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:'14px',
                    padding:'14px 16px',
                    borderRadius:'var(--r)',
                    border: `1px solid ${a.unlocked ? 'rgba(224,122,95,0.3)' : 'var(--border)'}`,
                    background: a.unlocked ? 'rgba(224,122,95,0.08)' : 'var(--surface-tint)',
                    cursor:'pointer',
                    transition:'all .15s',
                    WebkitTapHighlightColor:'transparent',
                  }}>
                  <div style={{
                    width:'48px', height:'48px', borderRadius:'12px', flexShrink:0,
                    background: 'var(--surface-tint)',
                    border: `1px solid ${a.unlocked ? 'rgba(224,122,95,0.25)' : 'var(--border)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <AchievementIcon id={a.id} active={a.unlocked} size={32}/>
                  </div>

                  <div style={{flex:1, minWidth:0}}>
                    <div style={{
                      fontWeight:'700', fontSize:'14px',
                      color: a.unlocked ? 'var(--text)' : 'var(--muted)',
                      marginBottom:'2px',
                    }}>
                      {a.title}
                      {a.unlocked && <span style={{marginLeft:'8px',fontSize:'11px',color:'var(--teal)',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'3px'}}><IconCheck style={{width:'11px',height:'11px'}}/> UNLOCKED</span>}
                    </div>
                    <div style={{fontSize:'12px',color:'var(--muted)',lineHeight:'1.4'}}>
                      {a.unlocked ? a.desc : HOW_TO[a.id] || a.desc}
                    </div>
                    {!a.unlocked && expanded === a.id && (
                      <div style={{
                        marginTop:'8px', padding:'8px 10px',
                        background:'var(--surface-tint)', borderRadius:'8px',
                        fontSize:'12px', color:'var(--text)', lineHeight:'1.5',
                        border:'1px solid var(--border)',
                      }}>
                        <span style={{color:'var(--teal)',fontWeight:'700'}}>How to unlock: </span>
                        {HOW_TO[a.id] || a.desc}
                      </div>
                    )}
                  </div>

                  {!a.unlocked && (
                    <div style={{color:'var(--muted)',fontSize:'14px',flexShrink:0,transition:'transform .2s',transform: expanded===a.id ? 'rotate(90deg)' : 'none'}}>›</div>
                  )}
                </div>
              ))}
            </div>

            {achievements.length > 9 && (
              <button className="btn-ghost" style={{width:'100%',fontSize:'13px'}} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show Less' : `Show All ${achievements.length} Achievements`}
              </button>
            )}
          </>
        )}
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
