import { useState, useEffect, useCallback } from 'react';
import {
  HubPreferences,
  HubBackground,
  DockStyle,
  loadHubPreferences,
  saveHubPreferences,
  setDockApp,
  removeDockApp,
  setBackground,
  setDockStyle,
  setDecryptPassword,
  removeDecryptPassword,
  verifyDecryptPassword,
} from '@/lib/hubPreferences';

interface UseHubPreferencesReturn {
  preferences: HubPreferences;
  isLoaded: boolean;
  isUnlocked: boolean;
  updateDockApp: (appId: string, position: number) => void;
  deleteDockApp: (appId: string) => void;
  updateBackground: (background: HubBackground) => void;
  updateDockStyle: (style: Partial<DockStyle>) => void;
  setPassword: (password: string) => Promise<void>;
  clearPassword: () => void;
  unlock: (password: string) => Promise<boolean>;
  toggleDock: (show: boolean) => void;
}

export function useHubPreferences(walletAddress: string | null): UseHubPreferencesReturn {
  const [preferences, setPreferences] = useState<HubPreferences>({
    dock: [],
    background: { type: 'gradient', value: 'from-slate-900 via-purple-900/20 to-slate-900' },
    showDock: true,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);

  useEffect(() => {
    if (walletAddress) {
      const loaded = loadHubPreferences(walletAddress);
      setPreferences(loaded);
      setIsLoaded(true);
      setIsUnlocked(!loaded.decryptPasswordHash);
    } else {
      setPreferences({
        dock: [],
        background: { type: 'gradient', value: 'from-slate-900 via-purple-900/20 to-slate-900' },
        showDock: true,
      });
      setIsLoaded(false);
      setIsUnlocked(true);
    }
  }, [walletAddress]);

  const persistPreferences = useCallback((newPrefs: HubPreferences) => {
    if (walletAddress) {
      saveHubPreferences(walletAddress, newPrefs);
    }
  }, [walletAddress]);

  const updateDockApp = useCallback((appId: string, position: number) => {
    setPreferences(prev => {
      const newPrefs = setDockApp(prev, appId, position);
      persistPreferences(newPrefs);
      return newPrefs;
    });
  }, [persistPreferences]);

  const deleteDockApp = useCallback((appId: string) => {
    setPreferences(prev => {
      const newPrefs = removeDockApp(prev, appId);
      persistPreferences(newPrefs);
      return newPrefs;
    });
  }, [persistPreferences]);

  const updateBackground = useCallback((background: HubBackground) => {
    setPreferences(prev => {
      const newPrefs = setBackground(prev, background);
      persistPreferences(newPrefs);
      return newPrefs;
    });
  }, [persistPreferences]);

  const updateDockStyle = useCallback((style: Partial<DockStyle>) => {
    setPreferences(prev => {
      const newPrefs = setDockStyle(prev, style);
      persistPreferences(newPrefs);
      return newPrefs;
    });
  }, [persistPreferences]);

  const setPasswordHandler = useCallback(async (password: string) => {
    const newPrefs = await setDecryptPassword(preferences, password);
    setPreferences(newPrefs);
    persistPreferences(newPrefs);
    setIsUnlocked(true);
  }, [preferences, persistPreferences]);

  const clearPassword = useCallback(() => {
    setPreferences(prev => {
      const newPrefs = removeDecryptPassword(prev);
      persistPreferences(newPrefs);
      return newPrefs;
    });
    setIsUnlocked(true);
  }, [persistPreferences]);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const valid = await verifyDecryptPassword(preferences, password);
    if (valid) {
      setIsUnlocked(true);
    }
    return valid;
  }, [preferences]);

  const toggleDock = useCallback((show: boolean) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, showDock: show };
      persistPreferences(newPrefs);
      return newPrefs;
    });
  }, [persistPreferences]);

  return {
    preferences,
    isLoaded,
    isUnlocked,
    updateDockApp,
    deleteDockApp,
    updateBackground,
    updateDockStyle,
    setPassword: setPasswordHandler,
    clearPassword,
    unlock,
    toggleDock,
  };
}
