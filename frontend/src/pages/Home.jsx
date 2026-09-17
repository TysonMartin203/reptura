import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { IconLogo } from '../components/Icons';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Home() {
  const [mode,    setMode]    = useState('login');
  const [form,    setForm]    = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate  = useNavigate();

  // Already signed in — this route is for logged-out visitors only.
  if (user) return <Navigate to="/dashboard" replace />;

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register({ username: form.username, email: form.email, password: form.password });
      login(data);
      navigate(data.isNewUser ? '/tutorial' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential) {
    setError(''); setLoading(true);
    try {
      const data = await api.googleAuth(credential);
      login(data);
      navigate(data.isNewUser ? '/tutorial' : '/dashboard');
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
          <p>Track lifts. Hit PRs. Stay accountable.</p>
        </div>

        <div className="auth-glass">
          <div className="tab-row">
            <button className={mode === 'login'    ? 'tab active' : 'tab'} onClick={() => setMode('login')}>Log In</button>
            <button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => setMode('register')}>Sign Up</button>
          </div>

          <form onSubmit={submit} className="form-stack">
            {mode === 'register' && (
              <div className="field">
                <label className="label">Username</label>
                <input className="input" placeholder="yourname" value={form.username} onChange={set('username')} required />
              </div>
            )}
            <div className="field">
              <label className="label">{mode === 'login' ? 'Email or Username' : 'Email'}</label>
              <input className="input" type={mode === 'login' ? 'text' : 'email'} placeholder={mode === 'login' ? 'you@email.com or username' : 'you@email.com'} value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : undefined} />
            </div>
            {mode === 'register' && (
              <div className="field">
                <label className="label">Confirm Password</label>
                <input className="input" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="form-error" style={{fontSize:'12px',marginTop:'4px'}}>Passwords don't match.</p>
                )}
              </div>
            )}
            {mode === 'login' && (
              <Link to="/forgot-password" className="link-small" style={{alignSelf:'flex-end',marginTop:'-6px'}}>Forgot password?</Link>
            )}
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading || (mode === 'register' && form.confirmPassword && form.password !== form.confirmPassword)} style={{marginTop:'4px'}}>
              {loading ? 'Loading…' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div style={{display:'flex',alignItems:'center',gap:'10px',margin:'18px 0'}}>
                <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                <span className="muted" style={{fontSize:'12px'}}>or</span>
                <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
              </div>
              <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError}/>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
