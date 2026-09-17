import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { IconLogo } from '../components/Icons';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
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
          <p>Reset your password</p>
        </div>

        <div className="auth-glass">
          {sent ? (
            <div style={{textAlign:'center'}}>
              <p style={{marginBottom:'16px'}}>If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It expires in 1 hour.</p>
              <Link to="/" className="link-small">← Back to log in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack">
              <p className="muted" style={{fontSize:'13px',marginBottom:'6px'}}>Enter your account email and we'll send you a reset link.</p>
              <div className="field">
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Link'}</button>
              <Link to="/" className="link-small" style={{textAlign:'center'}}>← Back to log in</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
