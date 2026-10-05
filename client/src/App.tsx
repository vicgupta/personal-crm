import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import OrganizationDetail from './pages/OrganizationDetail';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Deals from './pages/Deals';
import DealDetail from './pages/DealDetail';
import Pipeline from './pages/Pipeline';

interface AuthState {
  checked: boolean;
  username: string | null;
  authDisabled: boolean;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ checked: false, username: null, authDisabled: false });

  useEffect(() => {
    api.auth
      .me()
      .then((m) =>
        setAuth({
          checked: true,
          username: m.authenticated ? (m.username ?? null) : null,
          authDisabled: !!m.authDisabled,
        }),
      )
      .catch(() => setAuth({ checked: true, username: null, authDisabled: false }));
  }, []);

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      /* fall through */
    }
    setAuth({ checked: true, username: null, authDisabled: false });
  }

  if (!auth.checked) return <div className="loading">Loading…</div>;

  if (!auth.authDisabled && !auth.username) {
    return <Login onLogin={(username) => setAuth({ checked: true, username, authDisabled: false })} />;
  }

  return (
    <BrowserRouter>
      <Layout username={auth.username} onLogout={auth.authDisabled ? undefined : handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/deals/:id" element={<DealDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
