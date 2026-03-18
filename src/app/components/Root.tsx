import { Outlet } from 'react-router';
import { AuthProvider } from '../lib/AuthContext';

export function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
