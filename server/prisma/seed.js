require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando Seed (Prisma 7 - Extras)...');

  // 1. Buscar el hotel existente
  const hotel = await prisma.hotel.findFirst({
    where: { domain: 'hoteltriz.com' }
  });

  if (!hotel) {
    console.error('❌ Hotel no encontrado. Ejecuta primero el seed inicial o asegúrate de que el hotel existe.');
    return;
  }

  // 2. Crear Servicios Extra
  const extras = [
    {
      name: 'Desayuno Buffet Premium',
      description: 'Variedad de frutas frescas, panadería artesanal y platos calientes.',
      price: 25.0,
      hotelId: hotel.id
    },
    {
      name: 'Acceso al Spa & Sauna',
      description: 'Relájate en nuestras instalaciones de hidroterapia.',
      price: 45.0,
      hotelId: hotel.id
    },
    {
      name: 'Traslado al Aeropuerto',
      description: 'Servicio de transporte privado ida y vuelta.',
      price: 60.0,
      hotelId: hotel.id
    },
    {
      name: 'Late Check-out (16:00)',
      description: 'Disfruta de tu habitación por más tiempo.',
      price: 35.0,
      hotelId: hotel.id
    }
  ];

  for (const extra of extras) {
    await prisma.extraService.upsert({
      where: { id: extra.name }, // Hack para el seed: usaremos el nombre como ID temporal o simplemente crear si no existe
      update: {},
      create: {
        name: extra.name,
        description: extra.description,
        price: extra.price,
        hotelId: extra.hotelId
      }
    }).catch(async (e) => {
        // Si falla por el ID, simplemente creamos uno nuevo
        await prisma.extraService.create({ data: extra });
    });
  }

  console.log('✅ Servicios Extra creados exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
