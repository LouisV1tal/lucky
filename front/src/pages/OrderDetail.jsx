import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { API_URL } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const CHAIN = ['new','accepted','delivered_to_production','washing','drying','packing','ready_for_delivery','in_transit','completed'];
const LABELS = {
  new: 'Новый', accepted: 'Принят', delivered_to_production: 'Доставлен на производство',
  washing: 'Мойка', drying: 'Сушка', packing: 'Упаковка', ready_for_delivery: 'Готов к доставке',
  in_transit: 'В пути', completed: 'Завершён', cancelled: 'Отменён',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  async function load() {
    const { data } = await api.get(`/orders/${id}`);
    setOrder(data);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function nextStatus() {
    setError('');
    try {
      await api.post(`/orders/${id}/status/next`, { method: 'manual' });
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось изменить статус');
    }
  }

  async function manualStatus(status) {
    setError('');
    try {
      await api.post(`/orders/${id}/status`, { status, comment: 'Ручное изменение администратором' });
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось изменить статус');
    }
  }

  async function cancelOrder() {
    setError('');
    try {
      await api.post(`/orders/${id}/cancel`, { reason: cancelReason });
      setShowCancel(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось отменить заказ');
    }
  }

  function printTags() {
    window.open(`${API_URL}/api/v1/orders/${id}/print/tags`, '_blank');
  }
  function printInvoice() {
    window.open(`${API_URL}/api/v1/orders/${id}/print/invoice`, '_blank');
  }

  if (!order) return <p>Загрузка…</p>;

  const currentIdx = CHAIN.indexOf(order.statusTech);

  return (
    <div>
      <h1>Заказ №{order.orderNumber}</h1>

      <div className="card">
        <div className="row">
          <div>
            <h2>Клиент</h2>
            <p>{order.client.fullName}<br />{order.client.primaryPhone}</p>
          </div>
          <div>
            <h2>Адрес</h2>
            <p>{order.address ? `${order.address.city || ''}, ${order.address.street || ''} ${order.address.house || ''}, кв. ${order.address.apartment || ''}` : '—'}</p>
          </div>
          <div>
            <img src={`${API_URL}/api/v1/orders/${order.id}/qr/image`} alt="QR" width={120} height={120} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Статус: {LABELS[order.statusTech] || order.statusTech}</h2>
        {order.statusTech !== 'cancelled' && (
          <div className="status-flow">
            {CHAIN.map((s, i) => (
              <span key={s} className={`status-step ${i < currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}`}>
                {LABELS[s]}
              </span>
            ))}
          </div>
        )}

        {order.statusTech !== 'completed' && order.statusTech !== 'cancelled' && (
          <button className="btn big" onClick={nextStatus}>Перевести на следующий этап →</button>
        )}

        {user.role === 'admin' && order.statusTech !== 'cancelled' && (
          <div style={{ marginTop: 14 }}>
            <label>Ручная установка статуса (администратор)</label>
            <select className="input" value={order.statusTech} onChange={(e) => manualStatus(e.target.value)}>
              {CHAIN.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
            </select>
          </div>
        )}

        {(user.role === 'admin' || user.role === 'operator') && !['completed', 'cancelled'].includes(order.statusTech) && (
          <div style={{ marginTop: 14 }}>
            {!showCancel ? (
              <button className="btn danger" onClick={() => setShowCancel(true)}>Отменить заказ</button>
            ) : (
              <div>
                <label>Причина отмены (обязательно)</label>
                <input className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn danger" onClick={cancelOrder} disabled={!cancelReason}>Подтвердить отмену</button>
                  <button className="btn secondary" onClick={() => setShowCancel(false)}>Назад</button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card">
        <h2>Товары ({order.items.length})</h2>
        {order.items.map((it) => (
          <div className="item-card" key={it.id}>
            <strong>{it.positionNumber}. {it.productName}</strong>{it.size ? ` — ${it.size}` : ''}
            {it.description && <div className="hint-text">{it.description}</div>}
            {it.damageNotes && <div className="hint-text">Повреждения: {it.damageNotes}</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Печать</h2>
        <div className="row">
          <button className="btn secondary" onClick={printTags}>Печать бирок ({order.items.length} шт.)</button>
          <button className="btn secondary" onClick={printInvoice}>Печать накладной</button>
        </div>
      </div>

      <div className="card">
        <h2>История статусов</h2>
        <table>
          <thead><tr><th>Дата</th><th>Из</th><th>В</th><th>Способ</th><th>Комментарий</th></tr></thead>
          <tbody>
            {order.statusHistory.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.changedAt).toLocaleString('ru-RU')}</td>
                <td>{h.previousStatus ? LABELS[h.previousStatus] : '—'}</td>
                <td>{LABELS[h.newStatus]}</td>
                <td>{h.changeMethod}</td>
                <td>{h.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
