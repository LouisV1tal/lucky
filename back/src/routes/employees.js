const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

router.get('/', async (req, res) => {
  const employees = await prisma.employee.findMany({
    select: { id: true, fullName: true, login: true, role: true, phone: true, isActive: true, createdAt: true },
    orderBy: { fullName: 'asc' },
  });
  res.json(employees);
});

router.post('/', async (req, res) => {
  const { fullName, login, password, role, phone } = req.body;
  if (!fullName || !login || !password || !role) {
    return res.status(400).json({ error: 'Заполните имя, логин, пароль и роль' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const employee = await prisma.employee.create({
    data: { fullName, login, passwordHash, role, phone },
  });
  res.status(201).json({ id: employee.id, fullName: employee.fullName, login: employee.login, role: employee.role });
});

router.patch('/:id/deactivate', async (req, res) => {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.json(employee);
});

module.exports = router;
