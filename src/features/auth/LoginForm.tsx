import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { useAuth, roleHome } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/api/httpClient';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import styles from './LoginForm.module.css';

const QUICK = [
  { label: 'Admin', email: 'admin@fleetpanda.com', password: 'admin123' },
  { label: 'Driver', email: 'driver@fleetpanda.com', password: 'driver123' },
  { label: 'Amina', email: 'amina@fleetpanda.com', password: 'driver123' }, // 4-drop milk-run today
  { label: 'Sam', email: 'sam@fleetpanda.com', password: 'driver123' }, // live in-transit run
];

export function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const from = (loc.state as { from?: string } | null)?.from;

  const submit = async (data: LoginInput) => {
    setBusy(true);
    try {
      const user = await login(data.email, data.password);
      toast.success(`Welcome, ${user.name}`);
      nav(from ?? roleHome(user.role), { replace: true });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/panda.svg" width={46} height={46} alt="" />
          <div>
            <h1>FleetPanda</h1>
            <p className={styles.tag}>Petroleum fleet control</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(submit)} className={styles.form}>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="username" {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" size="lg" block loading={busy}>
            Sign in
          </Button>
        </form>

        <div className={styles.quick}>
          <span className={styles.quickLabel}>Quick login</span>
          <div className={styles.quickRow}>
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                className={styles.chip}
                onClick={() => {
                  setValue('email', q.email);
                  setValue('password', q.password);
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
