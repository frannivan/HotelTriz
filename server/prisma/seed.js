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

  // 2. Crear Tipos de Habitación (Upsert)
  const standard = await prisma.roomType.upsert({
    where: { name: 'Standard Room' },
    update: {},
    create: {
      name: 'Standard Room',
      description: 'Habitación cómoda con vista a la ciudad.',
      basePrice: 120.0,
      capacity: 2,
      hotelId: hotel.id
    }
  });

  const suite = await prisma.roomType.upsert({
    where: { name: 'Luxury Suite' },
    update: {},
    create: {
      name: 'Luxury Suite',
      description: 'Suite amplia con jacuzzi y balcón.',
      basePrice: 250.0,
      capacity: 4,
      hotelId: hotel.id
    }
  });
  console.log('✅ Tipos de Habitación asegurados.');

  // 3. Crear Habitaciones Físicas (Upsert)
  for (let i = 1; i <= 5; i++) {
    const num = `10${i}`;
    await prisma.room.upsert({
      where: { number: num },
      update: { roomTypeId: standard.id },
      create: { number: num, floor: 1, roomTypeId: standard.id }
    });
  }
  for (let i = 1; i <= 3; i++) {
    const num = `20${i}`;
    await prisma.room.upsert({
      where: { number: num },
      update: { roomTypeId: suite.id },
      create: { number: num, floor: 2, roomTypeId: suite.id }
    });
  }
  const allRooms = await prisma.room.findMany();
  console.log('✅ Habitaciones físicas aseguradas.');

  // 4. Crear Servicios Extra (Upsert)
  const extrasData = [
    { name: 'Desayuno Buffet Premium', description: 'Variedad de frutas frescas y platos calientes.', price: 25.0, hotelId: hotel.id },
    { name: 'Acceso al Spa & Sauna', description: 'Relájate en nuestras instalaciones.', price: 45.0, hotelId: hotel.id }
  ];
  
  for (const extra of extrasData) {
    await prisma.extraService.upsert({
      where: { name: extra.name },
      update: { price: extra.price },
      create: extra
    });
  }
  console.log('✅ Servicios Extra asegurados.');

  // 5. Crear reservas de prueba (Solo si no hay reservas)
  const bookingCount = await prisma.booking.count();
  if (bookingCount === 0) {
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
    console.log('✅ Reservas Demo inyectadas.');
  }

  // 6. Crear Motivos de Cancelación (Ya usaba upsert)
  const reasons = [
    'No Show (No se presentó)',
    'Cambio de planes del huésped',
    'Error en la fecha/habitación',
    'Emergencia personal',
    'Encontró un precio mejor',
    'Desea cambiar de hotel',
    'Otro motivo (Ver detalles)'
  ];

  for (const name of reasons) {
    await prisma.cancellationReason.upsert({
      where: { id: name.substring(0, 5) }, 
      update: { name },
      create: { id: name.substring(0, 5), name }
    });
  }
  console.log('✅ Motivos de Cancelación asegurados.');

  console.log('🎉 BASE DE DATOS SINCRONIZADA Y PROTEGIDA');
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
