import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);

  async function find() {
    const { data } = await api.get('/clients', { params: { search } });
    setClients(data);
    setLoaded(true);
  }

  return (
    <div>
      <h1>Клиенты</h1>
      <div className="card">
        <div className="row">
          <div><label>Поиск по имени или телефону</label><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn" onClick={find}>Найти</button></div>
        </div>
      </div>
      <div className="card">
        {!loaded ? <p className="hint-text">Введите запрос для поиска.</p> : clients.length === 0 ? <p className="hint-text">Ничего не найдено.</p> : (
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
