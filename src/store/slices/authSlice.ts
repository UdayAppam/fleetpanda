import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Role, User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
}

const initialState: AuthState = { user: null, token: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (s: { auth: AuthState }) => s.auth.user;
export const selectRole = (s: { auth: AuthState }): Role | null => s.auth.user?.role ?? null;
export const selectIsAuthed = (s: { auth: AuthState }) => Boolean(s.auth.token);
