import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const STATUS_LABELS = {
  new: 'Новый',
  accepted: 'Принят',
  delivered_to_production: 'Доставлен на производство',
  washing: 'Мойка',
  drying: 'Сушка',
  packing: 'Упаковка',
  ready_for_delivery: 'Готов к доставке',
  in_transit: 'В пути',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

function badgeClass(status) {
  if (status === 'ready_for_delivery') return 'badge ready';
  if (status === 'completed') return 'badge done';
  if (status === 'cancelled') return 'badge cancelled';
  return 'badge';
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    const { data } = await api.get('/orders', { params });
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Скачивание реестра в Excel — учитывает те же фильтры (поиск, статус),
  // что сейчас применены в списке на экране. Файл требует авторизации,
  // поэтому скачиваем через api-клиент (с токеном), а не прямой ссылкой.
  async function downloadExcel() {
    setExportError('');
    setExporting(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;

      const res = await api.get('/export/orders.xlsx', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'orders_export.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        e.response?.status === 403
          ? 'Экспорт в Excel доступен только администратору'
          : 'Не удалось скачать файл. Попробуйте ещё раз.'
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h1>Реестр заказов</h1>
      <div className="card">
        <div className="row">
          <div>
            <label>Поиск (номер, имя, телефон)</label>
            <input className="input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <div>
            <label>Статус</label>
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Все</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={load}>Найти</button>
            {user.role === 'admin' && (
              <button className="btn secondary" onClick={downloadExcel} disabled={exporting}>
                {exporting ? 'Готовим файл…' : 'Скачать в Excel'}
              </button>
            )}
          </div>
        </div>
        {exportError && <div className="error-text">{exportError}</div>}
      </div>

      <div className="card">
        {loading ? <p>Загрузка…</p> : orders.length === 0 ? (
          <p className="hint-text">Заказов не найдено.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>№ заказа</th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Товаров</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/orders/${o.id}`}>{o.orderNumber}</Link></td>
                  <td>{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td>{o.client?.fullName}</td>
                  <td>{o.client?.primaryPhone}</td>
                  <td>{o.items?.length}</td>
                  <td><span className={badgeClass(o.statusTech)}>{STATUS_LABELS[o.statusTech] || o.statusTech}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
