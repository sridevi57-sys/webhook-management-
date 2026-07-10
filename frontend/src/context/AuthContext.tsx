import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Shared custom Axios instance
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set auth header whenever token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Handle automatic silent refresh on boot
  useEffect(() => {
    const initAuth = async () => {
      try {
        const localUser = localStorage.getItem('user');
        if (localUser) {
          setUser(JSON.parse(localUser));
          // Refresh the token
          const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
          setToken(res.data.accessToken);
        }
      } catch (err) {
        console.warn('Silent refresh failed on initial load, logging out.');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // Axios Interceptors for Token Rotation & 401 handling
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry && error.response?.data?.code === 'TOKEN_EXPIRED') {
          originalRequest._retry = true;
          try {
            // Attempt to hit the refresh endpoint
            const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
            const newAccessToken = res.data.accessToken;
            setToken(newAccessToken);
            
            // Re-execute original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Refresh token expired or revoked, clean up auth state
            localStorage.removeItem('user');
            setUser(null);
            setToken(null);
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
    setToken(res.data.accessToken);
    localStorage.setItem('user', JSON.stringify(res.data.user));
  };

  const register = async (email: string, password: string, name?: string) => {
    await api.post('/auth/register', { email, password, name });
    // Auto login user after registration
    await login(email, password);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') });
    } catch (err) {
      console.error('Failed to logout cleanly from backend:', err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('user');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
