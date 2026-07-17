const prisma = require('../db');

// Отправка уведомления о готовности заказа.
// Реальная отправка в Telegram выполняется ботом: здесь мы просто формируем
// сообщение, проверяем, не отправлялось ли оно уже, и кладём его в очередь
// (в этой MVP-реализации — сразу пишем в NotificationLog и дергаем Bot API
// напрямую через fetch, если BOT_TOKEN задан).
async function notifyIfReady(order) {
  const alreadySent = await prisma.notificationLog.findFirst({
    where: { orderId: order.id, channel: 'telegram', status: 'sent' },
  });
  if (alreadySent) return; // уведомление отправляется только один раз при первом переходе

  const link = await prisma.telegramLink.findUnique({ where: { clientId: order.clientId } });
  const itemsCount = await prisma.orderItem.count({ where: { orderId: order.id } });

  const text = `Ваш заказ №${order.orderNumber} готов к доставке.\nКоличество товаров: ${itemsCount}.\nВ ближайшее время с вами свяжется сотрудник для согласования доставки.`;

  if (!link || !link.isActive) {
    await prisma.notificationLog.create({
      data: {
        orderId: order.id,
        channel: 'telegram',
        recipientId: null,
        messageText: text,
        status: 'failed',
        errorInfo: 'Telegram клиента не привязан',
      },
    });
    return;
  }

  try {
    if (process.env.BOT_TOKEN) {
      const resp = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: link.telegramChatId, text }),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.description || 'Telegram API error');
    }
    await prisma.notificationLog.create({
      data: {
        orderId: order.id,
        channel: 'telegram',
        recipientId: link.telegramChatId,
        messageText: text,
        status: 'sent',
      },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        orderId: order.id,
        channel: 'telegram',
        recipientId: link.telegramChatId,
        messageText: text,
        status: 'failed',
        errorInfo: String(e.message || e),
      },
    });
  }
}

// Ручная повторная отправка (только администратор, см. раздел 13 ТЗ)
async function resendNotification(orderId, employeeId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Заказ не найден');

  const link = await prisma.telegramLink.findUnique({ where: { clientId: order.clientId } });
  if (!link || !link.isActive) throw new Error('Telegram клиента не привязан');

  const itemsCount = await prisma.orderItem.count({ where: { orderId } });
  const text = `Ваш заказ №${order.orderNumber} готов к доставке.\nКоличество товаров: ${itemsCount}.\nВ ближайшее время с вами свяжется сотрудник для согласования доставки.`;

  let status = 'sent';
  let errorInfo = null;
  try {
    if (process.env.BOT_TOKEN) {
      const resp = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: link.telegramChatId, text }),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.description || 'Telegram API error');
    }
  } catch (e) {
    status = 'failed';
    errorInfo = String(e.message || e);
  }

  return prisma.notificationLog.create({
    data: {
      orderId,
      channel: 'telegram',
      recipientId: link.telegramChatId,
      messageText: text,
      status,
      errorInfo,
      sentByEmployeeId: employeeId,
    },
  });
}

module.exports = { notifyIfReady, resendNotification };
