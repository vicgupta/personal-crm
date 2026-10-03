import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, Briefcase, Columns3 } from 'lucide-react';
import type { ReactNode } from 'react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard />, end: true },
  { to: '/organizations', label: 'Organizations', icon: <Building2 /> },
  { to: '/contacts', label: 'Contacts', icon: <Users /> },
  { to: '/deals', label: 'Deals', icon: <Briefcase /> },
  { to: '/pipeline', label: 'Pipeline', icon: <Columns3 /> },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-name">Personal CRM</div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
