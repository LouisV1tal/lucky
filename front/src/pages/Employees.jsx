import React, { useEffect, useState } from 'react';
import api from '../api.js';

const ROLE_LABELS = { admin: 'Администратор', operator: 'Оператор', production: 'Производство', courier: 'Курьер' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ fullName: '', login: '', password: '', role: 'operator', phone: '' });
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', login: '', phone: '', role: '', password: '' });
  const [editError, setEditError] = useState('');

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

  async function activate(id) {
    await api.patch(`/employees/${id}/activate`);
    load();
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditError('');
    setEditForm({ fullName: emp.fullName, login: emp.login, phone: emp.phone || '', role: emp.role, password: '' });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(id) {
    setEditError('');
    try {
      const payload = {
        fullName: editForm.fullName,
        login: editForm.login,
        phone: editForm.phone,
        role: editForm.role,
      };
      if (editForm.password) payload.password = editForm.password;

      await api.patch(`/employees/${id}`, payload);
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Не удалось сохранить изменения');
    }
  }

  async function remove(emp) {
    const sure = window.confirm(
      `Удалить сотрудника «${emp.fullName}» насовсем? Это действие необратимо.\n\n` +
      'Если у сотрудника уже есть заказы или записи истории — система откажет в удалении и предложит деактивировать вместо этого.'
    );
    if (!sure) return;

    try {
      await api.delete(`/employees/${emp.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Не удалось удалить сотрудника');
    }
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
          <thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Статус</th><th style={{ minWidth: 320 }}></th></tr></thead>
          <tbody>
            {employees.map((e) => (
              editingId === e.id ? (
                <tr key={e.id}>
                  <td colSpan={5}>
                    <div className="item-card">
                      <div className="row">
                        <div className="field"><label>Имя</label><input className="input" value={editForm.fullName} onChange={(ev) => setEditForm({ ...editForm, fullName: ev.target.value })} /></div>
                        <div className="field"><label>Логин</label><input className="input" value={editForm.login} onChange={(ev) => setEditForm({ ...editForm, login: ev.target.value })} /></div>
                      </div>
                      <div className="row">
                        <div className="field"><label>Телефон</label><input className="input" value={editForm.phone} onChange={(ev) => setEditForm({ ...editForm, phone: ev.target.value })} /></div>
                        <div className="field">
                          <label>Роль</label>
                          <select className="input" value={editForm.role} onChange={(ev) => setEditForm({ ...editForm, role: ev.target.value })}>
                            <option value="operator">Оператор</option>
                            <option value="production">Производство</option>
                            <option value="courier">Курьер</option>
                            <option value="admin">Администратор</option>
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label>Новый пароль (оставьте пустым, если не меняете)</label>
                        <input className="input" type="password" value={editForm.password} onChange={(ev) => setEditForm({ ...editForm, password: ev.target.value })} />
                      </div>
                      {editError && <div className="error-text">{editError}</div>}
                      <div className="row-actions">
                        <button className="btn row-action" style={{ width: 'auto', padding: '0 20px' }} onClick={() => saveEdit(e.id)}>Сохранить</button>
                        <button className="btn row-action outline" style={{ width: 'auto', padding: '0 20px' }} onClick={cancelEdit}>Отмена</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td>{e.fullName}</td>
                  <td>{e.login}</td>
                  <td>{ROLE_LABELS[e.role]}</td>
                  <td>{e.isActive ? 'Активен' : 'Деактивирован'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn row-action outline" onClick={() => startEdit(e)}>Изменить</button>
                      {e.isActive ? (
                        <button className="btn row-action warn" onClick={() => deactivate(e.id)}>Деактивировать</button>
                      ) : (
                        <button className="btn row-action positive" onClick={() => activate(e.id)}>Активировать</button>
                      )}
                      <button className="btn row-action solid-danger" onClick={() => remove(e)}>Удалить</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
