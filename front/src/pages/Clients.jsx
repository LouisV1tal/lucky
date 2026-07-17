import React, { useState } from 'react';
import api from '../api.js';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [searchError, setSearchError] = useState('');

  const emptyForm = {
    fullName: '', primaryPhone: '', comment: '',
    city: '', district: '', street: '', house: '', apartment: '', landmark: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  async function find(searchValue) {
    setSearchError('');
    try {
      const { data } = await api.get('/clients', { params: { search: searchValue ?? search } });
      setClients(data);
      setLoaded(true);
    } catch (err) {
      setSearchError('Не удалось выполнить поиск');
    }
  }

  async function createClient(e) {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (!form.fullName || !form.primaryPhone) {
      setCreateError('Укажите имя и номер телефона клиента');
      return;
    }

    const hasAddress = form.city || form.district || form.street || form.house || form.apartment || form.landmark;

    try {
      await api.post('/clients', {
        fullName: form.fullName,
        primaryPhone: form.primaryPhone,
        comment: form.comment || undefined,
        addresses: hasAddress
          ? [{
              city: form.city, district: form.district, street: form.street,
              house: form.house, apartment: form.apartment, landmark: form.landmark,
            }]
          : undefined,
      });

      setCreateSuccess(`Клиент «${form.fullName}» добавлен`);
      const phone = form.primaryPhone;
      setForm(emptyForm);
      setSearch(phone);
      find(phone);
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Не удалось добавить клиента');
    }
  }

  return (
    <div>
      <h1>Клиенты</h1>

      <div className="card">
        <h2>Добавить клиента</h2>
        <form onSubmit={createClient}>
          <div className="row">
            <div className="field">
              <label>Имя</label>
              <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="field">
              <label>Номер телефона</label>
              <input className="input" value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })} placeholder="+998901234567" />
            </div>
          </div>
          <div className="row">
            <div className="field"><label>Город</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field"><label>Район</label><input className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Улица</label><input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
            <div className="field"><label>Дом</label><input className="input" value={form.house} onChange={(e) => setForm({ ...form, house: e.target.value })} /></div>
            <div className="field"><label>Квартира</label><input className="input" value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} /></div>
          </div>
          <div className="field"><label>Ориентир (опционально)</label><input className="input" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} /></div>
          <div className="field"><label>Комментарий</label><input className="input" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>

          {createError && <div className="error-text">{createError}</div>}
          {createSuccess && <div className="hint-text" style={{ color: 'var(--ok)' }}>{createSuccess}</div>}
          <button className="btn">Добавить клиента</button>
        </form>
      </div>

      <div className="card">
        <h2>Поиск клиентов</h2>
        <div className="row">
          <div>
            <label>Поиск по имени или телефону</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" onClick={() => find()}>Найти</button>
          </div>
        </div>
        {searchError && <div className="error-text">{searchError}</div>}
      </div>

      <div className="card">
        {!loaded ? (
          <p className="hint-text">Введите запрос для поиска, или добавьте нового клиента выше.</p>
        ) : clients.length === 0 ? (
          <p className="hint-text">Ничего не найдено.</p>
        ) : (
          <table>
            <thead><tr><th>Имя</th><th>Телефон</th><th>Заказов</th><th>Последнее обращение</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.fullName}</td>
                  <td>{c.primaryPhone}</td>
                  <td>{c.orders?.length ?? '—'}</td>
                  <td>{new Date(c.lastContactDate).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
