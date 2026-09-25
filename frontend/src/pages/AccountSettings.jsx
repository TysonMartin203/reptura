import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { IconChevron } from '../components/Icons';
import { enablePush, disablePush, getPushStatus } from '../push';

// This page is deliberately just Notifications and Feed Preferences — the
// "what reaches me" settings. Everything about the account itself (login
// details, appearance, units, connected stores, the meal/workout profile)
// lives on the Profile page instead.

const FEED_TYPES = [
  { key: 'workout',   label: 'Workouts',   meta: 'When you or a friend logs a workout' },
  { key: 'pr',        label: 'PRs',        meta: 'When you or a friend sets a personal record' },
  { key: 'meal',      label: 'Meals',      meta: 'When you or a friend logs a meal' },
  { key: 'challenge', label: 'Challenges', meta: 'When you or a friend starts or joins a challenge' },
];

export default function AccountSettings() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [pushStatus, setPushStatus] = useState('unknown');
  const [error, setError] = useState('');

  // Feed preferences
  const [feedTypes, setFeedTypesState] = useState(null); // null = all types shown
  const [friends, setFriends] = useState([]);
  const [mutedIds, setMutedIds] = useState(new Set());
  const [feedPrefsLoading, setFeedPrefsLoading] = useState(true);
  const [showFriendFeedList, setShowFriendFeedList] = useState(false);

  useEffect(() => {
    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'));

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

      <p className="muted" style={{fontSize:'12px',textAlign:'center',marginTop:'4px'}}>
        Account details, appearance, units and connected stores are on your Profile.
      </p>
    </div>
  );
}
