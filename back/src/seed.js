// Создаёт демо-администратора и демо-данные при первом запуске (идемпотентно).
const bcrypt = require('bcryptjs');
const prisma = require('./db');

async function main() {
  const adminLogin = 'admin';
  const existingAdmin = await prisma.employee.findUnique({ where: { login: adminLogin } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.employee.create({
      data: {
        fullName: 'Администратор',
        login: adminLogin,
        passwordHash,
        role: 'admin',
      },
    });
    console.log('Создан администратор: login=admin password=admin123 (смените после первого входа!)');
  }

  const opLogin = 'operator1';
  const existingOp = await prisma.employee.findUnique({ where: { login: opLogin } });
  if (!existingOp) {
    const passwordHash = await bcrypt.hash('operator123', 10);
    await prisma.employee.create({
      data: { fullName: 'Оператор Приёма', login: opLogin, passwordHash, role: 'operator' },
    });
  }

  const prodLogin = 'production1';
  const existingProd = await prisma.employee.findUnique({ where: { login: prodLogin } });
  if (!existingProd) {
    const passwordHash = await bcrypt.hash('production123', 10);
    await prisma.employee.create({
      data: { fullName: 'Сотрудник Производства', login: prodLogin, passwordHash, role: 'production' },
    });
  }

  const courierLogin = 'courier1';
  const existingCourier = await prisma.employee.findUnique({ where: { login: courierLogin } });
  if (!existingCourier) {
    const passwordHash = await bcrypt.hash('courier123', 10);
    await prisma.employee.create({
      data: { fullName: 'Курьер', login: courierLogin, passwordHash, role: 'courier' },
    });
  }

  console.log('Seed завершён.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
