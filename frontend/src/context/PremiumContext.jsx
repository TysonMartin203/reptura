import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import UpgradeModal from '../components/UpgradeModal';

// Premium status for the signed-in user, plus the app-wide upgrade popup.
// The API client fires two window events (see api/client.js):
//   reptura:ai-used           — a metered generation succeeded → refresh counts
//   reptura:premium-required  — the server refused one → show the popup
const PremiumContext = createContext({ status: null, refresh: () => {} });

export function PremiumProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);   // null while loading
  const [blocked, setBlocked] = useState(null); // detail of the refused request

  const refresh = useCallback(() => {
    if (!user) { setStatus(null); return; }
    api.getPremiumStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
  }, [user]);

  useEffect(() => { refresh(); }, [refresh, user?.id]);

  useEffect(() => {
    const onUsed = () => refresh();
    const onBlocked = (e) => { setBlocked(e.detail || {}); refresh(); };
    window.addEventListener('reptura:ai-used', onUsed);
    window.addEventListener('reptura:premium-required', onBlocked);
    return () => {
      window.removeEventListener('reptura:ai-used', onUsed);
      window.removeEventListener('reptura:premium-required', onBlocked);
    };
  }, [refresh]);

  return (
    <PremiumContext.Provider value={{ status, refresh, showUpgrade: (detail) => setBlocked(detail || {}) }}>
      {children}
      {blocked && <UpgradeModal detail={blocked} onClose={() => setBlocked(null)} />}
    </PremiumContext.Provider>
  );
}

export function usePremium() { return useContext(PremiumContext); }
