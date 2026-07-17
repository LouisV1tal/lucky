const express = require('express');
const prisma = require('../db');
const { clientStatusOf, CLIENT_STATUS_LABELS } = require('../utils/statusChain');

// Внутренний API для Telegram-бота. В продакшене должен быть закрыт отдельным
// секретом (BOT_INTERNAL_SECRET) — см. middleware ниже.
const router = express.Router();

router.use((req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (process.env.BOT_INTERNAL_SECRET && secret !== process.env.BOT_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// POST /api/v1/bot/link  { phone, chatId }
router.post('/link', async (req, res) => {
  const { phone, chatId } = req.body;
  const client = await prisma.client.findFirst({
    where: { OR: [{ primaryPhone: phone }, { phones: { some: { phone } } }] },
  });
  if (!client) return res.status(404).json({ error: 'Клиент с таким номером телефона не найден' });

  const link = await prisma.telegramLink.upsert({
    where: { clientId: client.id },
    update: { telegramChatId: String(chatId), linkedPhone: phone, isActive: true },
    create: { clientId: client.id, telegramChatId: String(chatId), linkedPhone: phone },
  });

  res.json({ ok: true, client: { id: client.id, fullName: client.fullName }, link });
});

// GET /api/v1/bot/orders?chatId=...
router.get('/orders', async (req, res) => {
  const { chatId } = req.query;
  const link = await prisma.telegramLink.findUnique({ where: { telegramChatId: String(chatId) } });
  if (!link) return res.status(404).json({ error: 'not_linked' });

  const orders = await prisma.order.findMany({
    where: { clientId: link.clientId, statusTech: { notIn: ['completed', 'cancelled'] } },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders.map((o) => ({
    orderNumber: o.orderNumber,
    status: CLIENT_STATUS_LABELS[clientStatusOf(o.statusTech)],
    itemsCount: o.items.length,
    createdAt: o.createdAt,
    plannedDeliveryDate: o.plannedDeliveryDate,
  })));
});

// GET /api/v1/bot/orders/:orderNumber?chatId=...
router.get('/orders/:orderNumber', async (req, res) => {
  const { chatId } = req.query;
  const link = await prisma.telegramLink.findUnique({ where: { telegramChatId: String(chatId) } });
  if (!link) return res.status(404).json({ error: 'not_linked' });

  const order = await prisma.order.findFirst({
    where: { orderNumber: req.params.orderNumber, clientId: link.clientId },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ error: 'not_found' });

  res.json({
    orderNumber: order.orderNumber,
    status: CLIENT_STATUS_LABELS[clientStatusOf(order.statusTech)],
    itemsCount: order.items.length,
    createdAt: order.createdAt,
    plannedDeliveryDate: order.plannedDeliveryDate,
  });
});

module.exports = router;
