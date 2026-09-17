import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reptura_user') || 'null'); }
    catch { return null; }
  });

  function login(data) {
    const u = {
      id: data.userId, username: data.username, email: data.email,
      avatarUrl: data.avatarUrl || null, theme: data.theme || 'light',
      bio: data.bio || null,
      notifyBuzz: data.notifyBuzz !== false, notifyMessages: data.notifyMessages !== false,
      weightUnit: data.weightUnit === 'kg' ? 'kg' : 'lbs',
      distanceUnit: data.distanceUnit === 'km' ? 'km' : 'mi',
      tutorialDone: !!data.tutorialDone,
      isAdmin: !!data.isAdmin,
    };
    localStorage.setItem('reptura_token', data.token);
    localStorage.setItem('reptura_user', JSON.stringify(u));
    setUser(u);
    return u;
  }

  function updateUser(updates) {
    const u = { ...user, ...updates };
    localStorage.setItem('reptura_user', JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('reptura_token');
    localStorage.removeItem('reptura_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
