// Технологическая цепочка статусов заказа (см. раздел 4 ТЗ)
const STATUS_CHAIN = [
  'new',                      // Новый
  'accepted',                 // Принят
  'delivered_to_production',  // Доставлен на производство
  'washing',                  // Мойка
  'drying',                   // Сушка
  'packing',                  // Упаковка
  'ready_for_delivery',       // Готов к доставке
  'in_transit',               // В пути
  'completed',                // Завершён
];

const CANCELLED = 'cancelled';

// Маппинг технологического статуса в клиентский (упрощённый, для Telegram-бота)
const CLIENT_STATUS_MAP = {
  new: 'new',
  accepted: 'in_progress',
  delivered_to_production: 'in_progress',
  washing: 'in_progress',
  drying: 'in_progress',
  packing: 'preparing_delivery',
  ready_for_delivery: 'ready_for_delivery',
  in_transit: 'in_transit',
  completed: 'completed',
  cancelled: 'cancelled',
};

const CLIENT_STATUS_LABELS = {
  new: 'Новый',
  in_progress: 'В работе',
  preparing_delivery: 'Подготовка к доставке',
  ready_for_delivery: 'Готов к доставке',
  in_transit: 'В пути',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const TECH_STATUS_LABELS = {
  new: 'Новый',
  accepted: 'Принят',
  delivered_to_production: 'Доставлен на производство',
  washing: 'Мойка',
  drying: 'Сушка',
  packing: 'Упаковка',
  ready_for_delivery: 'Готов к доставке',
  in_transit: 'В пути',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

function getNextStatus(current) {
  const idx = STATUS_CHAIN.indexOf(current);
  if (idx === -1 || idx === STATUS_CHAIN.length - 1) return null;
  return STATUS_CHAIN[idx + 1];
}

function isValidStatus(status) {
  return STATUS_CHAIN.includes(status) || status === CANCELLED;
}

function clientStatusOf(techStatus) {
  return CLIENT_STATUS_MAP[techStatus] || techStatus;
}

module.exports = {
  STATUS_CHAIN,
  CANCELLED,
  CLIENT_STATUS_LABELS,
  TECH_STATUS_LABELS,
  getNextStatus,
  isValidStatus,
  clientStatusOf,
};
