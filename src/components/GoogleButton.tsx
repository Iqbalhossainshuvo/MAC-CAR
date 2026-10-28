import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { GOOGLE_CLIENT_ID } from '@/lib/api';

declare global {
  interface Window {
    google?: any;
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client';

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT}"]`) as HTMLScriptElement | null;
    const el = existing ?? document.createElement('script');
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error('Could not load Google sign-in')));
    if (!existing) {
      el.src = SCRIPT;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

export const googleSignInAvailable = Platform.OS === 'web' && GOOGLE_CLIENT_ID.length > 10;

/** Official "Sign in with Google" button (web). Calls onCredential with a Google ID token. */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onCredential);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    cb.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!googleSignInAvailable || !width) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (r: { credential: string }) => cb.current(r.credential),
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          text: 'signin_with',
          width: Math.min(400, Math.max(200, Math.floor(width))),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [width]);

  if (!googleSignInAvailable) return null;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center', minHeight: 44 }}>
      <div ref={ref} />
    </View>
  );
}
