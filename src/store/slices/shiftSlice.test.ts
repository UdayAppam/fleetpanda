import { describe, it, expect } from 'vitest';
import reducer, { setActiveShift, selectActiveShiftId } from './shiftSlice';

describe('shiftSlice', () => {
  const initial = reducer(undefined, { type: '@@INIT' });

  it('starts with no active shift', () => {
    expect(initial.activeShiftId).toBeNull();
  });

  it('sets and clears the active shift id', () => {
    const set = reducer(initial, setActiveShift('shift-1'));
    expect(set.activeShiftId).toBe('shift-1');
    expect(selectActiveShiftId({ shift: set })).toBe('shift-1');
    const cleared = reducer(set, setActiveShift(null));
    expect(cleared.activeShiftId).toBeNull();
  });
});
