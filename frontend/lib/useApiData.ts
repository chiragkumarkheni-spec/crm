'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/**
 * Lightweight stale-while-revalidate data hook (no external dependency).
 *
 * It returns any previously-cached value for `path` instantly — from an
 * in-memory map first, then sessionStorage — so revisiting a screen paints
 * immediately, while a fresh copy is fetched in the background and swapped in.
 *
 * Pass `path = null` to skip fetching (e.g. while inputs aren't ready).
 */
const memCache = new Map<string, unknown>();

function sessionKey(path: string) {
  return `nexton_cache:${path}`;
}

function readCache<T>(path: string): T | undefined {
  if (memCache.has(path)) return memCache.get(path) as T;
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(sessionKey(path));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as T;
    memCache.set(path, value);
    return value;
  } catch {
    return undefined;
  }
}

function writeCache<T>(path: string, value: T) {
  memCache.set(path, value);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(sessionKey(path), JSON.stringify(value));
  } catch {
    /* sessionStorage full or unavailable — in-memory cache still works */
  }
}

export function useApiData<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(() =>
    path ? readCache<T>(path) : undefined
  );
  // Only show the blocking loading state when we have nothing cached to show.
  const [loading, setLoading] = useState(
    path ? readCache<T>(path) === undefined : false
  );
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!path) return;
    return api
      .get<T>(path)
      .then((d) => {
        writeCache(path, d);
        setData(d);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load')
      )
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      return;
    }
    // Show cached value immediately (if any), then revalidate.
    const cached = readCache<T>(path);
    setData(cached);
    setLoading(cached === undefined);
    refetch();
  }, [path, refetch]);

  return { data, loading, error, refetch };
}
