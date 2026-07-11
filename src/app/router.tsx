import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleRoute } from './guards/guards';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Spinner } from '@/components/ui/misc';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const FleetMapPage = lazy(() => import('@/pages/admin/FleetMapPage'));
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const AllocationPage = lazy(() => import('@/pages/admin/AllocationPage'));
const InventoryPage = lazy(() => import('@/pages/admin/InventoryPage'));
const MasterDataPage = lazy(() => import('@/pages/admin/MasterDataPage'));
const ShiftPage = lazy(() => import('@/pages/driver/ShiftPage'));
const SchedulePage = lazy(() => import('@/pages/driver/SchedulePage'));
const DriverMapPage = lazy(() => import('@/pages/driver/DriverMapPage'));
const ShiftHistoryPage = lazy(() => import('@/pages/driver/ShiftHistoryPage'));

const load = (node: React.ReactNode, label: string) => (
  <ErrorBoundary fallbackLabel={label}>
    <Suspense fallback={<Spinner label="Loading…" />}>{node}</Suspense>
  </ErrorBoundary>
);

export const router = createBrowserRouter([
  { path: '/login', element: load(<LoginPage />, 'login') },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleRoute role="admin" />,
        children: [
          {
            path: '/admin',
            element: <AppShell variant="admin" />,
            children: [
              { index: true, element: load(<DashboardPage />, 'dashboard') },
              { path: 'map', element: load(<FleetMapPage />, 'fleet map') },
              { path: 'orders', element: load(<OrdersPage />, 'orders') },
              { path: 'allocation', element: load(<AllocationPage />, 'allocation') },
              { path: 'inventory', element: load(<InventoryPage />, 'inventory') },
              { path: 'master', element: load(<MasterDataPage />, 'master data') },
            ],
          },
        ],
      },
      {
        element: <RoleRoute role="driver" />,
        children: [
          {
            path: '/driver',
            element: <AppShell variant="driver" />,
            children: [
              { index: true, element: load(<ShiftPage />, 'shift') },
              { path: 'schedule', element: load(<SchedulePage />, 'schedule') },
              { path: 'map', element: load(<DriverMapPage />, 'driver map') },
              { path: 'history', element: load(<ShiftHistoryPage />, 'history') },
            ],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
