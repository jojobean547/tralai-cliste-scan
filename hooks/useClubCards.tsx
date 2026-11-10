// Which club cards the shopper has, switched on in Settings and kept on the phone.
// The basket total uses club prices and club-only deals only for these cards.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tralai.clubCards.v1';

type ClubCardsContextType = {
  clubCards: string[];                          // e.g. ['Tesco Clubcard', 'Lidl Plus']
  hasClubCard: (cardName: string) => boolean;
  setClubCard: (cardName: string, on: boolean) => void;
};

const ClubCardsContext = createContext<ClubCardsContextType | null>(null);

export function ClubCardsProvider({ children }: { children: ReactNode }) {
  const [clubCards, setClubCards] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load once when the app starts
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(saved)) setClubCards(saved.filter((c): c is string => typeof c === 'string'));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save after every change (but not before loading, or the empty start would overwrite the saved list)
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clubCards)).catch(() => {});
  }, [clubCards, loaded]);

  const hasClubCard = useCallback((cardName: string) => clubCards.includes(cardName), [clubCards]);

  const setClubCard = useCallback((cardName: string, on: boolean) => {
    setClubCards((prev) => (on ? [...new Set([...prev, cardName])] : prev.filter((c) => c !== cardName)));
  }, []);

  const value = useMemo(() => ({ clubCards, hasClubCard, setClubCard }), [clubCards, hasClubCard, setClubCard]);
  return <ClubCardsContext.Provider value={value}>{children}</ClubCardsContext.Provider>;
}

export function useClubCards() {
  const context = useContext(ClubCardsContext);
  if (!context) throw new Error('useClubCards must be used inside a ClubCardsProvider');
  return context;
}
