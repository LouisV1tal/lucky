import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import api from '../api.js';

export default function Scan() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const foundRef = useRef(false);

  function extractToken(raw) {
    const trimmed = raw.trim();
    const parts = trimmed.split('/');
    return parts[parts.length - 1];
  }

  async function openOrderByToken(token) {
    if (!token) return;
    try {
      const { data } = await api.get(`/orders/by-qr/${token}`);
      navigate(`/orders/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Заказ по данному коду не найден');
    }
  }

  // Ввод похож на ссылку/токен QR (содержит "/" или выглядит как длинный UUID)
  function looksLikeQrToken(raw) {
    if (raw.includes('/')) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  }

  async function submitManual(e) {
    e.preventDefault();
    setError('');
    setSearchResults([]);
    const raw = value.trim();
    if (!raw) return;

    if (looksLikeQrToken(raw)) {
      await openOrderByToken(extractToken(raw));
      return;
    }

    // Иначе ищем как номер заказа или номер телефона клиента —
    // используем тот же реестр заказов с фильтром поиска
    try {
      const { data } = await api.get('/orders', { params: { search: raw } });
      if (data.length === 0) {
        setError('Заказ не найден. Проверьте номер заказа или номер телефона клиента.');
      } else if (data.length === 1) {
        navigate(`/orders/${data[0].id}`);
      } else {
        setSearchResults(data);
      }
    } catch (err) {
      setError('Не удалось выполнить поиск. Попробуйте ещё раз.');
    }
  }

  async function startScanning() {
    setError('');
    setCameraError('');
    setSearchResults([]);
    foundRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setCameraError('Не удалось подготовить видео для камеры. Обновите страницу и попробуйте снова.');
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setCameraError(
        'Не удалось получить доступ к камере. Проверьте, что браузер имеет разрешение на использование камеры, ' +
        'и что сайт открыт по HTTPS. Можно ввести номер заказа, телефон клиента или код вручную ниже.'
      );
    }
  }

  function stopScanning() {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function tick() {
    if (foundRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        foundRef.current = true;
        stopScanning();
        openOrderByToken(extractToken(code.data));
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qr-scan-box">
      <h1>Сканирование QR-кода</h1>
      <p className="hint-text">
        Наведите камеру на бирку заказа — заказ откроется автоматически, как только код будет распознан.
      </p>

      <div className="scanner-viewport" style={{ display: scanning ? 'block' : 'none' }}>
        <video ref={videoRef} playsInline muted />
        <div className="scanner-frame" />
      </div>

      {scanning ? (
        <button className="btn secondary" onClick={stopScanning}>Остановить камеру</button>
      ) : (
        <button className="btn big accent" style={{ maxWidth: 420, margin: '0 auto 20px' }} onClick={startScanning}>
          Начать сканирование
        </button>
      )}

      {cameraError && <div className="error-text" style={{ maxWidth: 420, margin: '0 auto 20px' }}>{cameraError}</div>}

      <p className="hint-text" style={{ marginTop: 24 }}>
        Также можно найти заказ вручную — по номеру заказа, номеру телефона клиента, или вставив ссылку/токен QR
        (например, при использовании USB/Bluetooth-сканера штрихкодов).
      </p>
      <form onSubmit={submitManual} style={{ maxWidth: 420, margin: '0 auto' }}>
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Номер заказа, телефон или токен QR"
        />
        <button className="btn big" style={{ marginTop: 14 }}>Найти заказ</button>
      </form>
      {error && <div className="error-text">{error}</div>}

      {searchResults.length > 0 && (
        <div className="card" style={{ maxWidth: 420, margin: '20px auto 0', textAlign: 'left' }}>
          <h2>Найдено несколько заказов — выберите нужный</h2>
          {searchResults.map((o) => (
            <div
              key={o.id}
              className="item-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <strong>Заказ №{o.orderNumber}</strong>
              <div className="hint-text">{o.client?.fullName} · {o.client?.primaryPhone}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
