const express = require('express');
const { authRequired, requireRole } = require('../middleware/auth');
const { resendNotification } = require('../services/notifications');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

// POST /api/v1/notifications/:orderId/resend
router.post('/:orderId/resend', async (req, res) => {
  try {
    const log = await resendNotification(Number(req.params.orderId), req.user.id);
    res.json(log);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
