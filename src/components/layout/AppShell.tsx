import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  PackageSearch,
  CalendarClock,
  Boxes,
  Database,
  Truck,
  History,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { selectSidebarCollapsed, toggleSidebar } from '@/store/slices/uiSlice';
import { UserMenu } from './UserMenu';
import { SyncClock } from './SyncClock';
import styles from './AppShell.module.css';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/map', label: 'Fleet Map', icon: Map },
  { to: '/admin/orders', label: 'Orders', icon: PackageSearch },
  { to: '/admin/allocation', label: 'Allocation', icon: CalendarClock },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/master', label: 'Master Data', icon: Database },
];
const DRIVER_NAV = [
  { to: '/driver', label: 'Shift', icon: Truck, end: true },
  { to: '/driver/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/driver/map', label: 'Map', icon: Map },
  { to: '/driver/history', label: 'History', icon: History },
];

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

export function AppShell({ variant }: { variant: 'admin' | 'driver' }) {
  const { user } = useAuth();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = variant === 'admin' ? ADMIN_NAV : DRIVER_NAV;

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Hamburger: toggles the off-canvas drawer on mobile, the narrow rail on desktop.
  const onMenu = () => (isMobile() ? setMobileOpen((o) => !o) : dispatch(toggleSidebar()));

  return (
    <div className={styles.shell} data-collapsed={collapsed} data-mobile-open={mobileOpen} data-variant={variant}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/panda.svg" width={30} height={30} alt="" />
          <span className={styles.brandName}>FleetPanda</span>
        </div>
        <nav className={styles.nav}>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.roleTag}>{variant === 'admin' ? 'Dispatcher' : 'Driver'}</div>
      </aside>

      {mobileOpen && <div className={styles.scrim} onClick={() => setMobileOpen(false)} />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuBtn} onClick={onMenu} aria-label="Toggle navigation">
            <Menu size={20} />
          </button>
          <SyncClock />
          <div className={styles.spacer} />
          <UserMenu name={user?.name ?? ''} role={variant} />
        </header>
        <main className={`${styles.content} scroll`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
