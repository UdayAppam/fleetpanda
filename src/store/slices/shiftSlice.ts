import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Only the REFERENCE lives here; the shift row is server state (TanStack Query).
interface ShiftState {
  activeShiftId: string | null;
}
const initialState: ShiftState = { activeShiftId: null };

const shiftSlice = createSlice({
  name: 'shift',
  initialState,
  reducers: {
    setActiveShift: (state, action: PayloadAction<string | null>) => {
      state.activeShiftId = action.payload;
    },
  },
});

export const { setActiveShift } = shiftSlice.actions;
export default shiftSlice.reducer;
export const selectActiveShiftId = (s: { shift: ShiftState }) => s.shift.activeShiftId;
