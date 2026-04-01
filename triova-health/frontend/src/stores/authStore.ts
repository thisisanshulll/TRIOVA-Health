import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

interface User {
  userId: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  patientId?: string;
  doctorId?: string;
  firstName?: string;
  lastName?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // starts true until checkAuth
      
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        // Optional: call backend logout
        api.post('/auth/logout').catch(()=>console.error('Logout failed'));
        window.location.href = '/login';
      },
      
      checkAuth: async () => {
        try {
          // Verify current session with backend 
          const res = await api.get('/auth/me'); 
          set({ user: res.data.data, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      }
    }),
    {
      name: 'triova-auth', // localStorage key
      partialize: (state) => ({ token: state.token }), // only persist token, let user data fetch on mount
    }
  )
);
