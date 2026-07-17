const express = require('express');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const prisma = require('../db');
const { authRequired } = require('../middleware/auth');
const { TECH_STATUS_LABELS } = require('../utils/statusChain');

const router = express.Router();
router.use(authRequired);

function qrUrlFor(order) {
  const base = process.env.PUBLIC_ORDER_URL || 'https://orders.example.com/o';
  return `${base}/${order.qrToken}`;
}

// GET /api/v1/orders/:id/qr/image  -- PNG-картинка QR-кода
router.get('/:id/qr/image', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const png = await QRCode.toBuffer(qrUrlFor(order), { type: 'png', width: 300, margin: 1 });
  res.set('Content-Type', 'image/png');
  res.send(png);
});

// POST /api/v1/orders/:id/print/tags?copies=N -- PDF с бирками (58x40мм на страницу)
router.post('/:id/print/tags', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: { client: true, items: true },
  });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const itemsCount = order.items.length || 1;
  const copies = Number(req.query.copies) || itemsCount;
  const qrPng = await QRCode.toBuffer(qrUrlFor(order), { type: 'png', width: 200, margin: 0 });

  const doc = new PDFDocument({ size: [164.4, 113.4], margin: 6 }); // 58x40мм в points (1мм ≈ 2.834pt)
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="tags_${order.orderNumber}.pdf"`);
  doc.pipe(res);

  for (let i = 0; i < copies; i++) {
    if (i > 0) doc.addPage({ size: [164.4, 113.4], margin: 6 });
    doc.image(qrPng, 6, 6, { width: 60, height: 60 });
    doc.fontSize(9).text(`Заказ №${order.orderNumber}`, 70, 8, { width: 90 });
    doc.fontSize(8).text(order.client.fullName, 70, 24, { width: 90 });
    doc.fontSize(8).text(order.client.primaryPhone, 70, 38, { width: 90 });
    doc.fontSize(8).text(`Товар ${i + 1} из ${itemsCount}`, 70, 52, { width: 90 });
    doc.fontSize(7).text(`Приём: ${order.createdAt.toLocaleDateString('ru-RU')}`, 6, 92, { width: 150 });
  }

  doc.end();

  await prisma.qrPrint.create({
    data: { orderId: order.id, printedByEmployeeId: req.user.id, copiesCount: copies },
  });
});

// POST /api/v1/orders/:id/print/invoice -- PDF накладная A5
router.post('/:id/print/invoice', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: { client: true, address: true, items: true },
  });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const doc = new PDFDocument({ size: 'A5', margin: 30 });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="invoice_${order.orderNumber}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(`Накладная — Заказ №${order.orderNumber}`, { underline: true });
  doc.moveDown();
  doc.fontSize(11).text(`Клиент: ${order.client.fullName}`);
  doc.text(`Телефон: ${order.client.primaryPhone}`);
  if (order.address) {
    const a = order.address;
    doc.text(`Адрес: г. ${a.city || ''}, р-н ${a.district || ''}, ул. ${a.street || ''}, д. ${a.house || ''}, кв. ${a.apartment || ''}`);
  }
  doc.text(`Дата приёма: ${order.createdAt.toLocaleString('ru-RU')}`);
  doc.text(`Статус: ${TECH_STATUS_LABELS[order.statusTech] || order.statusTech}`);
  doc.moveDown();
  doc.fontSize(12).text('Товары:', { underline: true });
  order.items.forEach((it) => {
    doc.fontSize(10).text(`${it.positionNumber}. ${it.productName}${it.size ? ' — ' + it.size : ''}`);
    if (it.description) doc.fontSize(9).text(`   ${it.description}`);
    if (it.damageNotes) doc.fontSize(9).text(`   Повреждения: ${it.damageNotes}`);
  });
  doc.moveDown();
  doc.fontSize(10).text('Подпись клиента: _______________________');

  doc.end();
});

module.exports = router;
