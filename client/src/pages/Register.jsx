import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await register({ ...form, phone: form.phone || undefined });
      toast.success('Account created');
      navigate('/');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel mx-auto mt-8 max-w-sm space-y-4">
      <h1 className="text-xl font-bold">Create your account</h1>
      <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={form.name} onChange={set('name')} required minLength={2} /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" /></div>
      <div>
        <label className="label" htmlFor="phone">Phone <span className="font-normal text-slate-400">(shared only after a verified claim)</span></label>
        <input id="phone" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" />
      </div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" className="input" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /><p className="mt-1 text-xs text-slate-500">At least 8 characters.</p></div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      <p className="text-center text-sm text-slate-500">Already registered? <Link className="font-medium text-brand-700 underline" to="/login">Log in</Link></p>
    </form>
  );
}
