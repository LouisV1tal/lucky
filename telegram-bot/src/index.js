require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://backend:4000';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не задан в переменных окружения. Бот не будет запущен.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const api = axios.create({
  baseURL: `${API_URL}/api/v1/bot`,
  headers: process.env.BOT_INTERNAL_SECRET ? { 'x-internal-secret': process.env.BOT_INTERNAL_SECRET } : {},
});

bot.start((ctx) => {
  ctx.reply(
    'Здравствуйте! Это бот для отслеживания статуса заказа.\n\n' +
    'Чтобы привязать свои заказы, отправьте номер телефона, указанный при приёме заказа (в формате +998901234567), кнопкой ниже или сообщением.',
    Markup.keyboard([
      [Markup.button.contactRequest('📱 Отправить номер телефона')],
    ]).resize()
  );
});

bot.on('contact', async (ctx) => {
  const phone = normalizePhone(ctx.message.contact.phone_number);
  await linkPhone(ctx, phone);
});

bot.hears(/^\+?\d[\d\s\-()]{6,}$/, async (ctx) => {
  const phone = normalizePhone(ctx.message.text);
  await linkPhone(ctx, phone);
});

async function linkPhone(ctx, phone) {
  try {
    const { data } = await api.post('/link', { phone, chatId: ctx.chat.id });
    await ctx.reply(
      `Готово! Номер привязан к клиенту «${data.client.fullName}».\n\n` +
      'Доступные команды:\n' +
      '/my_orders — список активных заказов\n' +
      '/order НОМЕР_ЗАКАЗА — статус конкретного заказа',
      Markup.removeKeyboard()
    );
  } catch (e) {
    if (e.response?.status === 404) {
      await ctx.reply('Клиент с таким номером телефона не найден. Проверьте номер или обратитесь в компанию.');
    } else {
      await ctx.reply('Не удалось привязать номер. Попробуйте позже.');
    }
  }
}

bot.command('my_orders', async (ctx) => {
  try {
    const { data } = await api.get('/orders', { params: { chatId: ctx.chat.id } });
    if (!data.length) {
      return ctx.reply('У вас нет активных заказов.');
    }
    const lines = data.map((o) =>
      `Заказ №${o.orderNumber} — ${o.status}\nТоваров: ${o.itemsCount}\nПринят: ${new Date(o.createdAt).toLocaleDateString('ru-RU')}`
    );
    await ctx.reply(lines.join('\n\n'));
  } catch (e) {
    if (e.response?.status === 404) {
      await ctx.reply('Сначала привяжите номер телефона командой /start.');
    } else {
      await ctx.reply('Не удалось получить список заказов. Попробуйте позже.');
    }
  }
});

bot.command('order', async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const orderNumber = parts[1];
  if (!orderNumber) return ctx.reply('Использование: /order НОМЕР_ЗАКАЗА');

  try {
    const { data } = await api.get(`/orders/${orderNumber}`, { params: { chatId: ctx.chat.id } });
    await ctx.reply(
      `Заказ №${data.orderNumber}\nСтатус: ${data.status}\nТоваров: ${data.itemsCount}\n` +
      `Принят: ${new Date(data.createdAt).toLocaleDateString('ru-RU')}` +
      (data.plannedDeliveryDate ? `\nПлановая доставка: ${new Date(data.plannedDeliveryDate).toLocaleDateString('ru-RU')}` : '')
    );
  } catch (e) {
    if (e.response?.status === 404) {
      await ctx.reply('Заказ не найден, либо он не привязан к вашему номеру телефона.');
    } else {
      await ctx.reply('Не удалось получить заказ. Попробуйте позже.');
    }
  }
});

function normalizePhone(raw) {
  return raw.replace(/[\s\-()]/g, '');
}

bot.launch().then(() => console.log('Telegram-бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
