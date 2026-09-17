import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { IconLogo } from '../components/Icons';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-wrap"><IconLogo /></div>
          <h1>Reptura</h1>
          <p>Set a new password</p>
        </div>

        <div className="auth-glass">
          {!token ? (
            <div style={{textAlign:'center'}}>
              <p className="form-error" style={{marginBottom:'16px'}}>This reset link is missing its token. Request a new one.</p>
              <Link to="/forgot-password" className="link-small">← Request a new link</Link>
            </div>
          ) : done ? (
            <div style={{textAlign:'center'}}>
              <p style={{marginBottom:'16px'}}>Your password has been reset. Taking you to log in…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack">
              <div className="field">
                <label className="label">New Password</label>
                <input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
              </div>
              <div className="field">
                <label className="label">Confirm Password</label>
                <input className="input" type="password" placeholder="••••••••" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Reset Password'}</button>
              <Link to="/" className="link-small" style={{textAlign:'center'}}>← Back to log in</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
