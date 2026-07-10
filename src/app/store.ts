import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storageSession from 'redux-persist/lib/storage/session';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import auth from '@/store/slices/authSlice';
import shift from '@/store/slices/shiftSlice';
import mapFilters from '@/store/slices/mapFiltersSlice';
import ui from '@/store/slices/uiSlice';

const rootReducer = combineReducers({ auth, shift, mapFilters, ui });

// Persist auth to sessionStorage (per-tab) so Admin + Driver can run in two tabs;
// ui theme persists too. See docs/DECISIONS.md ADR-07.
const persisted = persistReducer(
  { key: 'fleetpanda', storage: storageSession, whitelist: ['auth', 'ui'] },
  rootReducer,
);

export const store = configureStore({
  reducer: persisted,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
