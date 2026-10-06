import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-extrabold tracking-tight text-brand-700">FindIt</Link>

        <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? '✕' : '☰'}
        </button>

        <nav className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-full flex-col gap-1 border-b border-slate-200 bg-white p-3 md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0`}>
          <NavLink to="/" end className={link} onClick={close}>Browse</NavLink>
          {user ? (
            <>
              <NavLink to="/post" className={link} onClick={close}>Post item</NavLink>
              <NavLink to="/mine" className={link} onClick={close}>My posts</NavLink>
              {user.role === 'admin' && <NavLink to="/admin" className={link} onClick={close}>Admin</NavLink>}
              <div className="flex items-center gap-2 md:ml-2">
                <NotificationBell />
                <span className="px-1 text-sm text-slate-500">{user.name.split(' ')[0]}</span>
                <button className="btn-ghost" onClick={() => { logout(); close(); navigate('/'); }}>Log out</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 md:ml-2">
              <Link to="/login" className="btn-ghost" onClick={close}>Log in</Link>
              <Link to="/register" className="btn-primary" onClick={close}>Sign up</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
