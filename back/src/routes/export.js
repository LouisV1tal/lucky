const express = require('express');
const ExcelJS = require('exceljs');
const prisma = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { TECH_STATUS_LABELS } = require('../utils/statusChain');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

// Тот же принцип, что и в реестре заказов: числовой ввод ищет ТОЛЬКО номер
// заказа точным совпадением, без ложных совпадений по телефону клиента.
function buildSearchWhere(search) {
  const trimmed = search.trim();
  const isPureNumber = /^\d+$/.test(trimmed);

  if (isPureNumber) {
    return { orderNumber: { equals: trimmed } };
  }

  return {
    OR: [
      { orderNumber: { contains: trimmed } },
      { client: { fullName: { contains: trimmed, mode: 'insensitive' } } },
      { client: { primaryPhone: { contains: trimmed } } },
    ],
  };
}

// GET /api/v1/export/orders.xlsx
router.get('/orders.xlsx', async (req, res) => {
  const { status, dateFrom, dateTo, search, phone, city } = req.query;
  const where = {};
  if (status) where.statusTech = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (city) where.address = { city: { contains: city, mode: 'insensitive' } };
  if (phone) where.client = { primaryPhone: { contains: phone } };
  if (search) Object.assign(where, buildSearchWhere(search));

  const orders = await prisma.order.findMany({
    where,
    include: { client: true, address: true, items: true, responsibleEmployee: true, notifications: true },
    orderBy: { createdAt: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Заказы');
  sheet.columns = [
    { header: 'Номер заказа', key: 'orderNumber', width: 14 },
    { header: 'Дата создания', key: 'createdAt', width: 18 },
    { header: 'Клиент', key: 'clientName', width: 22 },
    { header: 'Телефон', key: 'phone', width: 16 },
    { header: 'Город', key: 'city', width: 14 },
    { header: 'Район', key: 'district', width: 14 },
    { header: 'Улица', key: 'street', width: 16 },
    { header: 'Дом', key: 'house', width: 8 },
    { header: 'Квартира', key: 'apartment', width: 8 },
    { header: 'Кол-во товаров', key: 'itemsCount', width: 14 },
    { header: 'Статус', key: 'status', width: 22 },
    { header: 'Ответственный', key: 'responsible', width: 20 },
    { header: 'Дата готовности', key: 'readyAt', width: 18 },
    { header: 'Дата уведомления Telegram', key: 'notifiedAt', width: 20 },
    { header: 'Дата завершения', key: 'completedAt', width: 18 },
  ];

  orders.forEach((o) => {
    const notif = o.notifications.find((n) => n.status === 'sent');
    sheet.addRow({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toLocaleString('ru-RU'),
      clientName: o.client.fullName,
      phone: o.client.primaryPhone,
      city: o.address?.city || '',
      district: o.address?.district || '',
      street: o.address?.street || '',
      house: o.address?.house || '',
      apartment: o.address?.apartment || '',
      itemsCount: o.items.length,
      status: TECH_STATUS_LABELS[o.statusTech] || o.statusTech,
      responsible: o.responsibleEmployee?.fullName || '',
      readyAt: o.readyAt ? o.readyAt.toLocaleString('ru-RU') : '',
      notifiedAt: notif ? notif.sentAt.toLocaleString('ru-RU') : '',
      completedAt: o.completedAt ? o.completedAt.toLocaleString('ru-RU') : '',
    });
  });

  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="orders_export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
