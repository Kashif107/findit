import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => !cancelled && setUser(data.user))
      .catch((err) => { if (!cancelled && err.response?.status) logout(); }) // keep session if only the network is down
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token, logout]);

  const authenticate = useCallback(async (path, body) => {
    const { data } = await api.post(path, body);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user, token, loading, logout,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (body) => authenticate('/auth/register', body)
    }),
    [user, token, loading, logout, authenticate]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
