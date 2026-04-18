require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando Seed (Prisma 7 - Extras)...');

  // 1. Crear o encontrar el hotel
  let hotel = await prisma.hotel.findFirst();
  
  if (!hotel) {
    hotel = await prisma.hotel.create({
      data: {
        name: 'HotelTriz Demo',
        domain: 'hoteltriz.com'
      }
    });
    console.log('✅ Hotel base creado.');
  }

  // 2. Crear Tipos de Habitación
  const standard = await prisma.roomType.create({
    data: {
      name: 'Standard Room',
      description: 'Habitación cómoda con vista a la ciudad.',
      basePrice: 120.0,
      capacity: 2,
      hotelId: hotel.id
    }
  });

  const suite = await prisma.roomType.create({
    data: {
      name: 'Luxury Suite',
      description: 'Suite amplia con jacuzzi y balcón.',
      basePrice: 250.0,
      capacity: 4,
      hotelId: hotel.id
    }
  });
  console.log('✅ Tipos de Habitación creados.');

  // 3. Crear Habitaciones Físicas (Inventario)
  const roomPromises = [];
  for (let i = 1; i <= 5; i++) {
    roomPromises.push(prisma.room.create({ data: { number: `10${i}`, floor: 1, roomTypeId: standard.id } }));
  }
  for (let i = 1; i <= 3; i++) {
    roomPromises.push(prisma.room.create({ data: { number: `20${i}`, floor: 2, roomTypeId: suite.id } }));
  }
  const allRooms = await Promise.all(roomPromises);
  console.log('✅ Habitaciones físicas creadas.');

  // 4. Crear Servicios Extra
  const extrasData = [
    { name: 'Desayuno Buffet Premium', description: 'Variedad de frutas frescas y platos calientes.', price: 25.0, hotelId: hotel.id },
    { name: 'Acceso al Spa & Sauna', description: 'Relájate en nuestras instalaciones.', price: 45.0, hotelId: hotel.id }
  ];
  
  for (const extra of extrasData) {
    await prisma.extraService.create({ data: extra });
  }
  console.log('✅ Servicios Extra creados.');

  // 5. Crear algunas reservas de prueba para encender el Calendario
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  
  await prisma.booking.create({
    data: {
      guestName: 'Francisco Ivan',
      guestEmail: 'demo@hoteltriz.com',
      checkIn: today,
      checkOut: tomorrow,
      totalPrice: 120.0,
      status: 'CONFIRMED',
      source: 'LOCAL',
      roomId: allRooms[0].id
    }
  });
  
  await prisma.booking.create({
    data: {
      guestName: 'Huésped Airbnb',
      guestEmail: 'airbnb@sync.com',
      checkIn: today,
      checkOut: nextWeek,
      totalPrice: 0,
      status: 'CONFIRMED',
      source: 'AIRBNB',
      roomId: allRooms[allRooms.length - 1].id
    }
  });

  console.log('✅ Reservas Demo inyectadas con éxito.');
  console.log('🎉 BASE DE DATOS LISTA PARA PRODUCCIÓN');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
