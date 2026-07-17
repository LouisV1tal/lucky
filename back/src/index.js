require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const ordersRoutes = require('./routes/orders');
const printRoutes = require('./routes/print');
const employeesRoutes = require('./routes/employees');
const exportRoutes = require('./routes/export');
const botRoutes = require('./routes/bot');
const notificationsRoutes = require('./routes/notifications');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientsRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/orders', printRoutes); // /:id/qr/image, /:id/print/*
app.use('/api/v1/employees', employeesRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/bot', botRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend API запущен на порту ${PORT}`));
