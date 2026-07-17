// Создаёт демо-сотрудников только при самом первом запуске (когда в базе
// вообще нет ни одного сотрудника). Если сотрудников уже создавали и потом
// кто-то из них был удалён вручную — seed.js больше НЕ будет пытаться
// восстановить именно его при следующем деплое, потому что скрипт вообще
// не запускает создание, раз в таблице employees уже есть хоть одна запись.
const bcrypt = require('bcryptjs');
const prisma = require('./db');

async function main() {
  const existingCount = await prisma.employee.count();

  if (existingCount > 0) {
    console.log(`В базе уже есть сотрудники (${existingCount}) — пропускаем создание демо-аккаунтов.`);
    return;
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.employee.create({
    data: { fullName: 'Администратор', login: 'admin', passwordHash, role: 'admin' },
  });
  console.log('Создан администратор: login=admin password=admin123 (смените после первого входа!)');

  const opHash = await bcrypt.hash('operator123', 10);
  await prisma.employee.create({
    data: { fullName: 'Оператор Приёма', login: 'operator1', passwordHash: opHash, role: 'operator' },
  });

  const prodHash = await bcrypt.hash('production123', 10);
  await prisma.employee.create({
    data: { fullName: 'Сотрудник Производства', login: 'production1', passwordHash: prodHash, role: 'production' },
  });

  const courierHash = await bcrypt.hash('courier123', 10);
  await prisma.employee.create({
    data: { fullName: 'Курьер', login: 'courier1', passwordHash: courierHash, role: 'courier' },
  });

  console.log('Seed завершён — созданы демо-аккаунты для первого входа.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
