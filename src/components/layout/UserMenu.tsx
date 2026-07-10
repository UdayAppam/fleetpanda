import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './UserMenu.module.css';

const themeIcon = { system: MonitorSmartphone, light: Sun, dark: Moon };

export function UserMenu({ name, role }: { name: string; role: string }) {
  const { logout } = useAuth();
  const { theme, cycle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const TIcon = themeIcon[theme];

  return (
    <div className={styles.wrap}>
      <button className={styles.themeBtn} onClick={cycle} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>
        <TIcon size={18} />
      </button>
      <button className={styles.trigger} onClick={() => setOpen((o) => !o)}>
        <span className={styles.avatar}>{name.charAt(0)}</span>
        <span className={styles.meta}>
          <span className={styles.name}>{name}</span>
          <span className={styles.role}>{role === 'admin' ? 'Dispatcher' : 'Driver'}</span>
        </span>
      </button>
      {open && (
        <>
          <div className={styles.scrim} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            <button
              onClick={() => {
                logout();
                nav('/login');
              }}
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
