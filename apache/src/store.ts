import type { Session } from './sdk';

const KEY = 'p3.session.v1';

type SessionData = Session & { wcTopic?: string };

export const SessionStore = {
  async save(session: SessionData) {
    localStorage.setItem(KEY, JSON.stringify(session));
  },

  async load(): Promise<SessionData | null> {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async clear() {
    localStorage.removeItem(KEY);
  },
};
