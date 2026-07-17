const path = require('path');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const prisma = require('../db');
const { authRequired } = require('../middleware/auth');
const { TECH_STATUS_LABELS } = require('../utils/statusChain');

const router = express.Router();
router.use(authRequired);

// Шрифты с поддержкой кириллицы — стандартные встроенные шрифты pdfkit
// (Helvetica и т.д.) не умеют русские буквы и печатают "иероглифы".
const FONT_REGULAR = path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'logo.png');

const TAG_WIDTH = 164.4;  // 58мм
const TAG_HEIGHT = 113.4; // 40мм

function registerFonts(doc) {
  doc.registerFont('main', FONT_REGULAR);
  doc.registerFont('main-bold', FONT_BOLD);
  doc.font('main');
}

function hasLogo() {
  return fs.existsSync(LOGO_PATH);
}

function qrUrlFor(order) {
  const base = process.env.PUBLIC_ORDER_URL || 'https://orders.example.com/o';
  return `${base}/${order.qrToken}`;
}

// Рисует содержимое одной бирки. Каждая следующая строка ставится строго под
// предыдущей на основе её РЕАЛЬНОЙ высоты (doc.heightOfString) — поэтому
// длинный номер заказа, длинное имя клиента или телефон никогда не наезжают
// друг на друга, даже если какая-то строка переносится на две строки.
function drawTag(doc, { order, qrPng, index, itemsCount, logoOnTag }) {
  const leftX = 6;
  const topY = 6;
  const qrSize = 58;
  doc.image(qrPng, leftX, topY, { width: qrSize, height: qrSize });

  const textX = leftX + qrSize + 6; // = 70
  const textWidth = TAG_WIDTH - textX - 6; // доступная ширина колонки текста

  let cursorY = 4;

  if (logoOnTag) {
    doc.image(LOGO_PATH, textX, cursorY, { fit: [textWidth, 15] });
    cursorY += 17;
  }

  doc.font('main-bold').fontSize(8);
  const orderLabel = `Заказ №${order.orderNumber}`;
  doc.text(orderLabel, textX, cursorY, { width: textWidth });
  cursorY += doc.heightOfString(orderLabel, { width: textWidth }) + 2;

  doc.font('main').fontSize(7.5);
  doc.text(order.client.fullName, textX, cursorY, { width: textWidth });
  cursorY += doc.heightOfString(order.client.fullName, { width: textWidth }) + 2;

  doc.text(order.client.primaryPhone, textX, cursorY, { width: textWidth });
  cursorY += doc.heightOfString(order.client.primaryPhone, { width: textWidth }) + 2;

  doc.font('main-bold').fontSize(7.5);
  const positionLabel = `Товар ${index + 1} из ${itemsCount}`;
  doc.text(positionLabel, textX, cursorY, { width: textWidth });

  // Дата приёма — отдельной строкой внизу бирки, на всю ширину
  doc.font('main').fontSize(7);
  doc.text(`Приём: ${order.createdAt.toLocaleDateString('ru-RU')}`, leftX, TAG_HEIGHT - 16, { width: TAG_WIDTH - leftX * 2 });
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
  const logoOnTag = hasLogo();

  const doc = new PDFDocument({ size: [TAG_WIDTH, TAG_HEIGHT], margin: 0 });
  registerFonts(doc);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="tags_${order.orderNumber}.pdf"`);
  doc.pipe(res);

  for (let i = 0; i < copies; i++) {
    if (i > 0) {
      doc.addPage({ size: [TAG_WIDTH, TAG_HEIGHT], margin: 0 });
      registerFonts(doc);
    }
    drawTag(doc, { order, qrPng, index: i, itemsCount, logoOnTag });
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
  registerFonts(doc);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="invoice_${order.orderNumber}.pdf"`);
  doc.pipe(res);

  if (hasLogo()) {
    doc.image(LOGO_PATH, doc.page.width - 30 - 90, 30, { fit: [90, 45] });
  }

  doc.font('main-bold').fontSize(16).text(`Накладная — Заказ №${order.orderNumber}`, { underline: true });
  doc.moveDown();
  doc.font('main').fontSize(11).text(`Клиент: ${order.client.fullName}`);
  doc.text(`Телефон: ${order.client.primaryPhone}`);
  if (order.address) {
    const a = order.address;
    doc.text(`Адрес: г. ${a.city || ''}, р-н ${a.district || ''}, ул. ${a.street || ''}, д. ${a.house || ''}, кв. ${a.apartment || ''}`);
  }
  doc.text(`Дата приёма: ${order.createdAt.toLocaleString('ru-RU')}`);
  doc.text(`Статус: ${TECH_STATUS_LABELS[order.statusTech] || order.statusTech}`);
  doc.moveDown();
  doc.font('main-bold').fontSize(12).text('Товары:', { underline: true });
  order.items.forEach((it) => {
    doc.font('main-bold').fontSize(10).text(`${it.positionNumber}. ${it.productName}${it.size ? ' — ' + it.size : ''}`);
    if (it.description) doc.font('main').fontSize(9).text(`   ${it.description}`);
    if (it.damageNotes) doc.font('main').fontSize(9).text(`   Повреждения: ${it.damageNotes}`);
  });
  doc.moveDown();
  doc.font('main').fontSize(10).text('Подпись клиента: _______________________');

  doc.end();
});

module.exports = router;
