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

  async function submitManual(e) {
    e.preventDefault();
    setError('');
    await openOrderByToken(extractToken(value));
  }

  async function startScanning() {
    setError('');
    setCameraError('');
    foundRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      tick();
    } catch (err) {
      setCameraError(
        'Не удалось получить доступ к камере. Проверьте, что браузер имеет разрешение на использование камеры, ' +
        'и что сайт открыт по HTTPS. Можно ввести код вручную ниже.'
      );
    }
  }

  function stopScanning() {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

      {scanning ? (
        <>
          <div className="scanner-viewport">
            <video ref={videoRef} playsInline muted />
            <div className="scanner-frame" />
          </div>
          <button className="btn secondary" onClick={stopScanning}>Остановить камеру</button>
        </>
      ) : (
        <button className="btn big accent" style={{ maxWidth: 420, margin: '0 auto 20px' }} onClick={startScanning}>
          Начать сканирование
        </button>
      )}

      {cameraError && <div className="error-text" style={{ maxWidth: 420, margin: '0 auto 20px' }}>{cameraError}</div>}

      <p className="hint-text" style={{ marginTop: 24 }}>
        Также можно ввести код вручную — если есть USB/Bluetooth-сканер штрихкодов (он печатает код прямо в поле ниже),
        или если нужно найти заказ по ссылке/токену без камеры.
      </p>
      <form onSubmit={submitManual} style={{ maxWidth: 420, margin: '0 auto' }}>
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Токен заказа или ссылка"
        />
        <button className="btn big" style={{ marginTop: 14 }}>Открыть заказ</button>
      </form>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
