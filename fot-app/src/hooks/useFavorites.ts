import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dashboard_favorites';

const loadFavorites = (): Set<number> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
};

const saveFavorites = (ids: Set<number>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites);

  const toggle = useCallback((id: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: number) => favorites.has(id), [favorites]);

  return { favorites, toggle, isFavorite };
};
