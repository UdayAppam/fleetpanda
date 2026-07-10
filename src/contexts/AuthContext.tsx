import { createContext, useContext, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { loginSuccess, logout as logoutAction, selectUser } from '@/store/slices/authSlice';
import { api } from '@/api/endpoints';
import type { Role, User } from '@/types';

interface AuthCtx {
  user: User | null;
  role: Role | null;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

// Thin façade over authSlice — one seam to swap for a real auth API later.
export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();

  const value: AuthCtx = {
    user,
    role: user?.role ?? null,
    isAuthed: Boolean(user),
    login: async (email, password) => {
      const { user: u, token } = await api.login(email, password);
      dispatch(loginSuccess({ user: u, token }));
      return u;
    },
    logout: () => dispatch(logoutAction()),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
};

export const roleHome = (role: Role | null) => (role === 'driver' ? '/driver' : '/admin');
