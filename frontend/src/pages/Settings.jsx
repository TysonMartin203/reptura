import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { IconEdit, IconChevron, IconCheck } from '../components/Icons';
import AchievementIcon from '../components/AchievementIcon';
import { compressImage } from '../compressImage';

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

const FEED_TYPES = [
  { key: 'workout',   label: 'Workouts',   meta: 'When you or a friend logs a workout' },
  { key: 'pr',        label: 'PRs',        meta: 'When you or a friend sets a personal record' },
  { key: 'meal',      label: 'Meals',      meta: 'When you or a friend logs a meal' },
  { key: 'challenge', label: 'Challenges', meta: 'When you or a friend starts or joins a challenge' },
];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
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

  // Feed preferences
  const [feedTypes, setFeedTypesState] = useState(null); // null = all types shown
  const [friends, setFriends] = useState([]);
  const [mutedIds, setMutedIds] = useState(new Set());
  const [feedPrefsLoading, setFeedPrefsLoading] = useState(true);
  const [showFriendFeedList, setShowFriendFeedList] = useState(false);

  const initials  = user?.username?.slice(0,2).toUpperCase() || 'FT';
  const avatarUrl = user?.avatarUrl ? api.fileUrl(user.avatarUrl) : null;

  useEffect(() => {
    api.getAchievements()
      .then(d => setAchievements(d.achievements || []))
      .catch(() => {})
      .finally(() => setLoadingAch(false));

    Promise.all([api.getFeedPrefs(), api.getFriends()])
      .then(([prefs, friendList]) => {
        setFeedTypesState(prefs.feedTypes); // null or array
        setMutedIds(new Set((prefs.mutedFriends || []).map(f => f.id)));
        setFriends(friendList || []);
      })
      .catch(() => {})
      .finally(() => setFeedPrefsLoading(false));
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

      {/* Settings button — everything else (account, appearance, notifications,
          meal/workout profile, units, admin, logout) lives on its own page now. */}
      <button className="btn-secondary" style={{width:'100%',marginBottom:'20px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
        onClick={()=>navigate('/account')}>
        ⚙️ Settings
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
    </div>
  );
}
