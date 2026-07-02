'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Idle tracking for the signed-in rep.
 *
 * While `active` is true it (a) listens for real user input, (b) every ~60s tells
 * the server how long the rep has been idle (heartbeat), so an admin can see who
 * is sitting idle, and (c) returns the rep's own idle time in ms — refreshed every
 * 30s — for their own "start working" nudge.
 *
 * The input handler only stamps a ref (no per-event state/timer churn), so it stays
 * cheap even on a weak PC — the same approach the idle-logout handler uses.
 */
export function usePresence(active: boolean): number {
  const [idleMs, setIdleMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setIdleMs(0);
      return;
    }
    let lastActive = Date.now();
    const mark = () => {
      lastActive = Date.now();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    // Heartbeat: report how idle we are (server stamps the times on its own clock).
    const beat = () => {
      api
        .post('/api/activity/heartbeat', { idleMs: Date.now() - lastActive })
        .catch(() => {
          /* presence is best-effort — never surface an error to the user */
        });
    };
    beat(); // send one right away so presence is fresh straight after login
    const beatTimer = setInterval(beat, 60000);

    // Refresh our own idle number (drives the rep's nudge banner). 30s cadence
    // matches the rest of the app shell — no extra re-render churn.
    const uiTimer = setInterval(() => setIdleMs(Date.now() - lastActive), 30000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(beatTimer);
      clearInterval(uiTimer);
    };
  }, [active]);

  return idleMs;
}
