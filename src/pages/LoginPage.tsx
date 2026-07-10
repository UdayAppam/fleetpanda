import { Navigate } from 'react-router-dom';
import { LoginForm } from '@/features/auth/LoginForm';
import { useAuth, roleHome } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { isAuthed, role } = useAuth();
  if (isAuthed) return <Navigate to={roleHome(role)} replace />;
  return <LoginForm />;
}
