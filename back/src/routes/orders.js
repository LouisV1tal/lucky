const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { getNextStatus, isValidStatus, clientStatusOf, CANCELLED } = require('../utils/statusChain');
const { notifyIfReady } = require('../services/notifications');

const router = express.Router();
router.use(authRequired);

// Простой сквозной номер заказа: 1, 2, 3... — легко вводить вручную,
// в отличие от формата "2026-00001".
async function generateOrderNumber() {
  const count = await prisma.order.count();
  return String(count + 1);
}

// GET /api/v1/orders  (реестр с фильтрами)
router.get('/', async (req, res) => {
  const { status, employee, city, phone, search, dateFrom, dateTo } = req.query;
  const where = {};

  if (status) where.statusTech = status;
  if (employee) where.responsibleEmployeeId = Number(employee);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (city) where.address = { city: { contains: city, mode: 'insensitive' } };
  if (phone) where.client = { primaryPhone: { contains: phone } };
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { client: { fullName: { contains: search, mode: 'insensitive' } } },
      { client: { primaryPhone: { contains: search } } },
    ];
  }

  // Оператор/курьер/производство видят по-разному согласно роли (см. раздел 2 ТЗ)
  if (req.user.role === 'operator') {
    where.creatorEmployeeId = req.user.id;
  } else if (req.user.role === 'courier' || req.user.role === 'production') {
    where.responsibleEmployeeId = req.user.id;
  }

  const orders = await prisma.order.findMany({
    where,
    include: { client: true, address: true, items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  res.json(orders.map(serializeOrder));
});

function serializeOrder(o) {
  return { ...o, statusClient: clientStatusOf(o.statusTech) };
}

// GET /api/v1/orders/by-qr/:token  (используется при сканировании)
router.get('/by-qr/:token', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { qrToken: req.params.token },
    include: { client: true, address: true, items: true, statusHistory: { orderBy: { changedAt: 'desc' } } },
  });
  if (!order) return res.status(404).json({ error: 'Заказ по данному QR-коду не найден' });
  res.json(serializeOrder(order));
});

// GET /api/v1/orders/:id
router.get('/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      client: true,
      address: true,
      items: true,
      statusHistory: { orderBy: { changedAt: 'desc' }, include: { changedByEmployee: true } },
      qrPrints: true,
      notifications: true,
      responsibleEmployee: true,
      creatorEmployee: true,
    },
  });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(serializeOrder(order));
});

// POST /api/v1/orders  (создание заказа с товарами)
router.post('/', requireRole('admin', 'operator'), async (req, res) => {
  const { clientId, addressId, description, employeeComment, plannedDeliveryDate, items, responsibleEmployeeId } = req.body;

  if (!clientId) return res.status(400).json({ error: 'Не указан клиент' });
  if (!items || !items.length) return res.status(400).json({ error: 'В заказе должен быть хотя бы один товар' });

  const orderNumber = await generateOrderNumber();
  const qrToken = uuidv4();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      qrToken,
      clientId,
      addressId: addressId || null,
      description: description || null,
      employeeComment: employeeComment || null,
      plannedDeliveryDate: plannedDeliveryDate ? new Date(plannedDeliveryDate) : null,
      creatorEmployeeId: req.user.id,
      responsibleEmployeeId: responsibleEmployeeId || req.user.id,
      statusTech: 'new',
      items: {
        create: items.map((it, idx) => ({
          positionNumber: idx + 1,
          productName: it.productName || 'Ковёр',
          description: it.description || null,
          comment: it.comment || null,
          size: it.size || null,
          damageNotes: it.damageNotes || null,
        })),
      },
      statusHistory: {
        create: {
          previousStatus: null,
          newStatus: 'new',
          changedByEmployeeId: req.user.id,
          changeMethod: 'manual',
          comment: 'Заказ создан',
        },
      },
    },
    include: { items: true, client: true, address: true },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { lastContactDate: new Date() },
  });

  res.status(201).json(serializeOrder(order));
});

// PATCH /api/v1/orders/:id  (редактирование до начала обработки)
router.patch('/:id', requireRole('admin', 'operator'), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (order.statusTech !== 'new' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Редактирование доступно только для заказов в статусе "Новый"' });
  }

  const { description, employeeComment, plannedDeliveryDate, addressId } = req.body;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { description, employeeComment, addressId, plannedDeliveryDate: plannedDeliveryDate ? new Date(plannedDeliveryDate) : undefined },
  });
  res.json(serializeOrder(updated));
});

// POST /api/v1/orders/:id/status/next  (перевод на следующий этап - главный сценарий сканирования)
router.post('/:id/status/next', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const next = getNextStatus(order.statusTech);
  if (!next) {
    return res.status(400).json({ error: 'У заказа нет следующего этапа (либо уже завершён/отменён)' });
  }

  const updated = await applyStatusChange(order, next, {
    employeeId: req.user.id,
    method: req.body.method || 'manual',
    deviceInfo: req.body.deviceInfo || null,
    comment: req.body.comment || null,
  });

  res.json(serializeOrder(updated));
});

// POST /api/v1/orders/:id/status  (ручная установка статуса - только admin)
router.post('/:id/status', requireRole('admin'), async (req, res) => {
  const { status, comment } = req.body;
  if (!isValidStatus(status)) return res.status(400).json({ error: 'Некорректный статус' });

  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const updated = await applyStatusChange(order, status, {
    employeeId: req.user.id,
    method: 'manual',
    comment: comment || 'Ручное изменение статуса администратором',
  });

  res.json(serializeOrder(updated));
});

// POST /api/v1/orders/:id/cancel
router.post('/:id/cancel', requireRole('admin', 'operator'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Укажите причину отмены заказа' });

  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (req.user.role === 'operator' && !['new', 'accepted'].includes(order.statusTech)) {
    return res.status(403).json({ error: 'Оператор может отменить заказ только до начала обработки' });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      statusTech: CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason,
      statusHistory: {
        create: {
          previousStatus: order.statusTech,
          newStatus: CANCELLED,
          changedByEmployeeId: req.user.id,
          changeMethod: 'manual',
          comment: reason,
        },
      },
    },
  });

  res.json(serializeOrder(updated));
});

// внутренняя функция применения смены статуса + запись истории + триггер уведомления
async function applyStatusChange(order, newStatus, { employeeId, method, deviceInfo, comment }) {
  const data = {
    statusTech: newStatus,
    statusHistory: {
      create: {
        previousStatus: order.statusTech,
        newStatus,
        changedByEmployeeId: employeeId,
        changeMethod: method,
        deviceInfo,
        comment,
      },
    },
  };
  if (newStatus === 'ready_for_delivery') data.readyAt = new Date();
  if (newStatus === 'completed') data.completedAt = new Date();

  const updated = await prisma.order.update({ where: { id: order.id }, data, include: { client: true } });

  if (newStatus === 'ready_for_delivery') {
    await notifyIfReady(updated);
  }

  return updated;
}

module.exports = router;
