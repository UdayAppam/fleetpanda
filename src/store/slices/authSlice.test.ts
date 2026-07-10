import { describe, it, expect } from 'vitest';
import reducer, {
  loginSuccess,
  logout,
  selectUser,
  selectRole,
  selectIsAuthed,
} from './authSlice';
import type { User } from '@/types';

const user: User = { id: 'u1', email: 'a@b.com', name: 'Dana', role: 'admin' };

describe('authSlice', () => {
  const initial = reducer(undefined, { type: '@@INIT' });

  it('stores the user and token on login', () => {
    const s = reducer(initial, loginSuccess({ user, token: 't' }));
    expect(s.user).toEqual(user);
    expect(s.token).toBe('t');
  });

  it('clears the user and token on logout', () => {
    const loggedIn = reducer(initial, loginSuccess({ user, token: 't' }));
    const s = reducer(loggedIn, logout());
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
  });

  it('selectors read the slice', () => {
    const state = { auth: reducer(initial, loginSuccess({ user, token: 't' })) };
    expect(selectUser(state)).toEqual(user);
    expect(selectRole(state)).toBe('admin');
    expect(selectIsAuthed(state)).toBe(true);
    const empty = { auth: initial };
    expect(selectRole(empty)).toBeNull();
    expect(selectIsAuthed(empty)).toBe(false);
  });
});
