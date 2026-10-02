import { createContext, useContext, type ReactNode } from 'react';
import type { YouTubeSession } from './session';

const YouTubeContext = createContext<YouTubeSession | null>(null);

type YouTubeProviderProps = {
  session: YouTubeSession;
  children: ReactNode;
};

export function YouTubeProvider({ session, children }: YouTubeProviderProps) {
  return (
    <YouTubeContext.Provider value={session}>
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube(): YouTubeSession {
  const session = useContext(YouTubeContext);
  if (session === null) {
    throw new Error('useYouTube() must be used inside <YouTubeProvider>');
  }
  return session;
}
