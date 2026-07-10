import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { store, persistor } from '@/app/store';
import { queryClient } from '@/app/queryClient';
import { router } from '@/app/router';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/misc';
import { USE_MOCK } from '@/config/env';
import '@/styles/globals.css';

// In serverless demo mode, boot the in-browser mock API before the first request fires.
async function enableMocking() {
  if (!USE_MOCK) return;
  const { startMockWorker } = await import('@/mocks/browser');
  await startMockWorker();
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={store}>
        <PersistGate loading={<Spinner label="Loading FleetPanda…" />} persistor={persistor}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <AuthProvider>
                    <RouterProvider router={router} />
                  </AuthProvider>
                </ConfirmProvider>
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </StrictMode>,
  );
});
