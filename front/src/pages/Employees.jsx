import React, { useEffect, useState } from 'react';
import api from '../api.js';

const ROLE_LABELS = { admin: 'Администратор', operator: 'Оператор', production: 'Производство', courier: 'Курьер' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ fullName: '', login: '', password: '', role: 'operator', phone: '' });
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/employees');
    setEmployees(data);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/employees', form);
      setForm({ fullName: '', login: '', password: '', role: 'operator', phone: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось создать сотрудника');
    }
  }

  async function deactivate(id) {
    await api.patch(`/employees/${id}/deactivate`);
    load();
  }

  return (
    <div>
      <h1>Сотрудники</h1>
      <div className="card">
        <h2>Добавить сотрудника</h2>
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Имя</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="field"><label>Логин</label><input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Пароль</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="field">
              <label>Роль</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="operator">Оператор</option>
                <option value="production">Производство</option>
                <option value="courier">Курьер</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn">Создать сотрудника</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>{e.fullName}</td>
                <td>{e.login}</td>
                <td>{ROLE_LABELS[e.role]}</td>
                <td>{e.isActive ? 'Активен' : 'Деактивирован'}</td>
                <td>{e.isActive && <button className="btn danger" style={{ minHeight: 36 }} onClick={() => deactivate(e.id)}>Деактивировать</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
