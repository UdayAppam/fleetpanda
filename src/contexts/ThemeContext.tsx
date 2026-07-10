import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { selectTheme, setTheme, type ThemePref } from '@/store/slices/uiSlice';

interface ThemeCtx {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  cycle: () => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppSelector(selectTheme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const order: ThemePref[] = ['system', 'light', 'dark'];
  const value: ThemeCtx = {
    theme,
    setTheme: (t) => dispatch(setTheme(t)),
    cycle: () => dispatch(setTheme(order[(order.indexOf(theme) + 1) % order.length])),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
};
