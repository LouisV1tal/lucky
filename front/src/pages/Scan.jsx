import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_URL } from '../api.js';

// Примечание: полноценное сканирование через камеру требует HTTPS и тестирования
// на конкретном планшете (см. вопрос №6 в разделе "Вопросы к заказчику" ТЗ).
// Здесь реализован рабочий вариант через внешние Bluetooth/USB-сканеры (они
// эмулируют клавиатурный ввод и просто "печатают" токен в это поле) плюс
// ручной ввод/вставка токена или ссылки.
export default function Scan() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function extractToken(raw) {
    const trimmed = raw.trim();
    const parts = trimmed.split('/');
    return parts[parts.length - 1];
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const token = extractToken(value);
    if (!token) return;
    try {
      const { data } = await api.get(`/orders/by-qr/${token}`);
      navigate(`/orders/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Заказ по данному коду не найден');
    }
  }

  return (
    <div className="qr-scan-box">
      <h1>Сканирование QR-кода</h1>
      <p className="hint-text">
        Наведите USB/Bluetooth-сканер на бирку заказа — код появится в поле ниже автоматически.
        Либо введите/вставьте код или ссылку вручную.
      </p>
      <form onSubmit={submit} style={{ maxWidth: 420, margin: '0 auto' }}>
        <input
          className="input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Токен заказа или ссылка"
        />
        <button className="btn big accent" style={{ marginTop: 14 }}>Открыть заказ</button>
      </form>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
