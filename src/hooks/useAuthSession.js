import { useCallback, useEffect, useState } from 'react';
import { getSession, signIn, signOut, signUp } from '../services/authApi.js';

export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let isMounted = true;

    getSession()
      .then((session) => {
        if (isMounted) setUser(session.user || null);
      })
      .catch(() => {
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setIsAuthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError('');
    const session = await signIn(credentials);
    setUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (payload) => {
    setAuthError('');
    const session = await signUp(payload);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  return {
    user,
    isAuthLoading,
    authError,
    setAuthError,
    login,
    register,
    logout,
  };
}
