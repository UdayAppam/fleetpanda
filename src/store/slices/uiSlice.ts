import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemePref = 'system' | 'light' | 'dark';
interface UiState {
  theme: ThemePref;
  sidebarCollapsed: boolean;
}
const initialState: UiState = { theme: 'system', sidebarCollapsed: false };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemePref>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { setTheme, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
export const selectTheme = (s: { ui: UiState }) => s.ui.theme;
export const selectSidebarCollapsed = (s: { ui: UiState }) => s.ui.sidebarCollapsed;
