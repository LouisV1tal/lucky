import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

const emptyItem = () => ({ productName: 'Ковёр', size: '', description: '', damageNotes: '' });

export default function OrderNew() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState(null);
  const [notFoundCreate, setNotFoundCreate] = useState(false);
  const [newClient, setNewClient] = useState({ fullName: '', city: '', district: '', street: '', house: '', apartment: '', landmark: '' });
  const [items, setItems] = useState([emptyItem()]);
  const [description, setDescription] = useState('');
  const [plannedDeliveryDate, setPlannedDeliveryDate] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function searchClient() {
    setError('');
    setNotFoundCreate(false);
    setClient(null);
    if (!phone) return;
    const { data } = await api.get('/clients', { params: { phone } });
    if (data.length) {
      setClient(data[0]);
    } else {
      setNotFoundCreate(true);
    }
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function addItem() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      let clientId = client?.id;
      let addressId = client?.addresses?.[0]?.id;

      if (!clientId) {
        if (!newClient.fullName) throw new Error('Укажите имя клиента');
        const { data } = await api.post('/clients', {
          fullName: newClient.fullName,
          primaryPhone: phone,
          addresses: [{
            city: newClient.city, district: newClient.district, street: newClient.street,
            house: newClient.house, apartment: newClient.apartment, landmark: newClient.landmark,
          }],
        });
        clientId = data.id;
        addressId = data.addresses?.[0]?.id;
      }

      const { data: order } = await api.post('/orders', {
        clientId,
        addressId,
        description,
        plannedDeliveryDate: plannedDeliveryDate || null,
        items: items.filter((it) => it.productName),
      });

      navigate(`/orders/${order.id}`);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Не удалось создать заказ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Новый заказ</h1>

      <div className="card">
        <h2>1. Клиент</h2>
        <div className="row">
          <div>
            <label>Номер телефона клиента</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn secondary" onClick={searchClient}>Найти клиента</button>
          </div>
        </div>

        {client && (
          <div className="item-card" style={{ marginTop: 12 }}>
            Найден клиент: <strong>{client.fullName}</strong>
            {client.addresses?.[0] && (
              <div className="hint-text">Адрес: {client.addresses[0].city}, {client.addresses[0].street} {client.addresses[0].house}</div>
            )}
          </div>
        )}

        {notFoundCreate && (
          <div style={{ marginTop: 12 }}>
            <p className="hint-text">Клиент не найден. Заполните данные для создания новой карточки.</p>
            <div className="row">
              <div className="field"><label>Имя клиента</label><input className="input" value={newClient.fullName} onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Город</label><input className="input" value={newClient.city} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} /></div>
              <div className="field"><label>Район</label><input className="input" value={newClient.district} onChange={(e) => setNewClient({ ...newClient, district: e.target.value })} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Улица</label><input className="input" value={newClient.street} onChange={(e) => setNewClient({ ...newClient, street: e.target.value })} /></div>
              <div className="field"><label>Дом</label><input className="input" value={newClient.house} onChange={(e) => setNewClient({ ...newClient, house: e.target.value })} /></div>
              <div className="field"><label>Квартира</label><input className="input" value={newClient.apartment} onChange={(e) => setNewClient({ ...newClient, apartment: e.target.value })} /></div>
            </div>
            <div className="field"><label>Ориентир</label><input className="input" value={newClient.landmark} onChange={(e) => setNewClient({ ...newClient, landmark: e.target.value })} /></div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>2. Товары в заказе</h2>
        {items.map((it, idx) => (
          <div className="item-card" key={idx}>
            <div className="row">
              <div className="field"><label>Название товара</label><input className="input" value={it.productName} onChange={(e) => updateItem(idx, 'productName', e.target.value)} /></div>
              <div className="field"><label>Размер (опционально)</label><input className="input" value={it.size} onChange={(e) => updateItem(idx, 'size', e.target.value)} placeholder="2x3 м" /></div>
            </div>
            <div className="field"><label>Описание / комментарий</label><input className="input" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} /></div>
            <div className="field"><label>Повреждения / загрязнения (опционально)</label><input className="input" value={it.damageNotes} onChange={(e) => updateItem(idx, 'damageNotes', e.target.value)} /></div>
            {items.length > 1 && <button className="btn danger" style={{ minHeight: 40 }} onClick={() => removeItem(idx)}>Удалить товар</button>}
          </div>
        ))}
        <button className="btn secondary" onClick={addItem}>+ Добавить ещё товар</button>
      </div>

      <div className="card">
        <h2>3. Дополнительно</h2>
        <div className="field"><label>Комментарий к заказу</label><textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="field"><label>Плановая дата доставки</label><input className="input" type="date" value={plannedDeliveryDate} onChange={(e) => setPlannedDeliveryDate(e.target.value)} /></div>
      </div>

      {error && <div className="error-text">{error}</div>}
      <button className="btn big accent" disabled={submitting} onClick={submit}>
        {submitting ? 'Сохраняем…' : 'Сохранить заказ и получить QR-код'}
      </button>
    </div>
  );
}
