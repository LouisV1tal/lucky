import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.login, form.password);
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={submit}>
        <h1>Учёт заказов</h1>
        <p>Приём, обработка и доставка ковров</p>
        <div className="field">
          <label>Логин</label>
          <input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoFocus />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn big" disabled={loading}>{loading ? 'Входим…' : 'Войти'}</button>
        <p className="hint-text" style={{ marginTop: 16 }}>
          Демо: admin/admin123, operator1/operator123, production1/production123, courier1/courier123
        </p>
      </form>
    </div>
  );
}
