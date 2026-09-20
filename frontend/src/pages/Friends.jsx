import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Friends() {
  const { user }   = useAuth();
  const [friends,  setFriends]  = useState([]);
  const [username, setUsername] = useState('');
  const [convo,    setConvo]    = useState(null);
  const [msgText,  setMsgText]  = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    api.getFriends().then(setFriends).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function addFriend(e) {
    e.preventDefault(); setError('');
    try {
      await api.addFriend({ username });
      setUsername('');
      setFriends(await api.getFriends());
    } catch (err) { setError(err.message); }
  }

  async function openConvo(friend) {
    const messages = await api.getConversation(friend.id);
    setConvo({ friend, messages });
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!msgText.trim() || !convo) return;
    await api.sendMessage({ receiverId: convo.friend.id, message: msgText });
    const msgs = await api.getConversation(convo.friend.id); setConvo(c => ({ ...c, messages: msgs }));
    setMsgText('');
  }

  const accepted = friends.filter(f => f.status === 'accepted');
  const pending  = friends.filter(f => f.status === 'pending' && f.direction === 'received');
  const sent     = friends.filter(f => f.status === 'pending' && f.direction === 'sent');

  if (loading) return <div className="page"><div className="spinner"/></div>;

  if (convo) {
    return (
      <div className="page convo-page">
        <button className="btn-ghost" onClick={() => setConvo(null)} style={{marginBottom:'12px'}}>← Back</button>
        <h2 className="page-title">{convo.friend.username}</h2>
        <div className="messages">
          {convo.messages.map(m => (
            <div key={m.id} className={`message ${m.sender_id === user.id ? 'mine' : 'theirs'}`}>
              <span className="msg-text">{m.message}</span>
              <span className="msg-time">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          ))}
          {convo.messages.length === 0 && <p className="muted">No messages yet. Say something!</p>}
        </div>
        <form onSubmit={sendMsg} className="msg-form">
          <input className="input msg-input" placeholder="Type a message…" value={msgText} onChange={e => setMsgText(e.target.value)} />
          <button className="btn-primary" type="submit">Send</button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">Friends</h2>

      <div className="card-form">
        <div className="field"><label className="label">Add by username</label></div>
        <form onSubmit={addFriend}>
          <div className="input-row">
            <input className="input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
            <button className="btn-primary" type="submit">Add</button>
          </div>
          {error && <p className="form-error" style={{marginTop:'10px'}}>{error}</p>}
        </form>
      </div>

      {pending.length > 0 && (
        <section className="section">
          <div className="section-header"><span className="section-title">Requests</span></div>
          {pending.map(f => (
            <div key={f.id} className="list-item">
              <span className="item-main">{f.username}</span>
              <button className="btn-accent-sm" onClick={() => api.acceptFriend(f.id).then(() => api.getFriends().then(setFriends))}>Accept</button>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <div className="section-header"><span className="section-title">Friends</span></div>
        {accepted.length === 0
          ? <p className="muted">No friends yet. Add some!</p>
          : accepted.map(f => (
            <div key={f.id} className="list-item clickable" onClick={() => openConvo(f)}>
              <span className="item-main">{f.username}</span>
              <span className="item-meta">Message →</span>
            </div>
          ))
        }
      </section>

      {sent.length > 0 && (
        <section className="section">
          <div className="section-header"><span className="section-title">Pending</span></div>
          {sent.map(f => (
            <div key={f.id} className="list-item">
              <span className="item-main">{f.username}</span>
              <span className="chip">Pending</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
