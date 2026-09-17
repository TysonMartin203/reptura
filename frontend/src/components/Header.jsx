import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconLogo, IconHome } from './Icons';
import { api } from '../api/client';

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initials = user?.username?.slice(0,2).toUpperCase() || 'FT';
  const avatarUrl = user?.avatarUrl ? api.fileUrl(user.avatarUrl) : null;

  return (
    <header className="top-header">
      <button className="header-home-btn" onClick={() => navigate('/dashboard')} aria-label="Go to home">
        <IconHome />
      </button>
      <div className="header-logo">
        <IconLogo />
        <span className="header-logo-text">Reptura</span>
      </div>
      <button className="header-avatar-btn" onClick={() => navigate('/settings')} aria-label="Profile">
        {avatarUrl
          ? <img src={avatarUrl} alt="avatar" />
          : <span className="header-avatar-initials">{initials}</span>
        }
      </button>
    </header>
  );
}
