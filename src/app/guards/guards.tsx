import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, roleHome } from '@/contexts/AuthContext';
import type { Role } from '@/types';

export function ProtectedRoute() {
  const { isAuthed } = useAuth();
  const loc = useLocation();
  if (!isAuthed) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}

export function RoleRoute({ role }: { role: Role }) {
  const { role: userRole } = useAuth();
  if (userRole !== role) return <Navigate to={roleHome(userRole)} replace />;
  return <Outlet />;
}
