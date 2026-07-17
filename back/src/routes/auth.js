const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }

  const employee = await prisma.employee.findUnique({ where: { login } });
  if (!employee || !employee.isActive) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const ok = await bcrypt.compare(password, employee.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign(
    { id: employee.id, role: employee.role, fullName: employee.fullName, login: employee.login },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: {
      id: employee.id,
      fullName: employee.fullName,
      role: employee.role,
      login: employee.login,
    },
  });
});

module.exports = router;
