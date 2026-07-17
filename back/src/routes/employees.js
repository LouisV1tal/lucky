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

  const existing = await prisma.employee.findUnique({ where: { login } });
  if (existing) {
    return res.status(409).json({ error: 'Сотрудник с таким логином уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const employee = await prisma.employee.create({
    data: { fullName, login, passwordHash, role, phone },
  });
  res.status(201).json({ id: employee.id, fullName: employee.fullName, login: employee.login, role: employee.role });
});

// PATCH /api/v1/employees/:id — редактирование имени, логина, телефона, роли и (опционально) пароля
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { fullName, login, phone, role, password } = req.body;

  if (login) {
    const existing = await prisma.employee.findUnique({ where: { login } });
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: 'Этот логин уже занят другим сотрудником' });
    }
  }

  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (login !== undefined) data.login = login;
  if (phone !== undefined) data.phone = phone;
  if (role !== undefined) data.role = role;
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data,
      select: { id: true, fullName: true, login: true, role: true, phone: true, isActive: true, createdAt: true },
    });
    res.json(employee);
  } catch (e) {
    res.status(400).json({ error: 'Не удалось обновить сотрудника' });
  }
});

router.patch('/:id/deactivate', async (req, res) => {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.json(employee);
});

router.patch('/:id/activate', async (req, res) => {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { isActive: true },
  });
  res.json(employee);
});

// DELETE /api/v1/employees/:id — полное удаление из системы.
// Если у сотрудника уже есть связанные заказы/история (он что-то создавал
// или менял статусы), удаление запрещено на уровне базы (внешние ключи) —
// в этом случае просим деактивировать вместо удаления, чтобы не терять
// историю и не ломать существующие заказы.
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (req.user.id === id) {
    return res.status(400).json({ error: 'Нельзя удалить свою собственную учётную запись' });
  }

  try {
    await prisma.employee.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') {
      return res.status(409).json({
        error: 'Нельзя удалить сотрудника: с ним связаны заказы или записи истории. Деактивируйте его вместо удаления, чтобы сохранить историю.',
      });
    }
    res.status(400).json({ error: 'Не удалось удалить сотрудника' });
  }
});

module.exports = router;
