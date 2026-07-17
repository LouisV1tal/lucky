const express = require('express');
const prisma = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /api/v1/clients?phone=...&search=...
router.get('/', async (req, res) => {
  const { phone, search } = req.query;
  const where = {};
  if (phone) {
    where.OR = [
      { primaryPhone: { contains: phone } },
      { phones: { some: { phone: { contains: phone } } } },
    ];
  } else if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { primaryPhone: { contains: search } },
    ];
  }

  const clients = await prisma.client.findMany({
    where,
    include: { addresses: true, phones: true },
    take: 20,
    orderBy: { lastContactDate: 'desc' },
  });
  res.json(clients);
});

// GET /api/v1/clients/:id
router.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      addresses: true,
      phones: true,
      orders: { orderBy: { createdAt: 'desc' } },
      telegramLink: true,
    },
  });
  if (!client) return res.status(404).json({ error: 'Клиент не найден' });
  res.json(client);
});

// POST /api/v1/clients
router.post('/', async (req, res) => {
  const { fullName, primaryPhone, comment, addresses } = req.body;
  if (!fullName || !primaryPhone) {
    return res.status(400).json({ error: 'Укажите имя и номер телефона клиента' });
  }

  const existing = await prisma.client.findUnique({ where: { primaryPhone } });
  if (existing) {
    return res.status(409).json({ error: 'Клиент с таким номером телефона уже существует', client: existing });
  }

  const client = await prisma.client.create({
    data: {
      fullName,
      primaryPhone,
      comment: comment || null,
      addresses: addresses && addresses.length
        ? { create: addresses.map((a, i) => ({ ...a, isDefault: i === 0 })) }
        : undefined,
    },
    include: { addresses: true },
  });

  res.status(201).json(client);
});

// PATCH /api/v1/clients/:id
router.patch('/:id', async (req, res) => {
  const { fullName, comment } = req.body;
  const client = await prisma.client.update({
    where: { id: Number(req.params.id) },
    data: { fullName, comment },
  });
  res.json(client);
});

// POST /api/v1/clients/:id/addresses
router.post('/:id/addresses', async (req, res) => {
  const address = await prisma.clientAddress.create({
    data: { ...req.body, clientId: Number(req.params.id) },
  });
  res.status(201).json(address);
});

module.exports = router;
