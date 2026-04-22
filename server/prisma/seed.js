require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando Seed (Prisma 7 - Extras)...');

  // 1. Limpieza básica o Asegurar Hotel principal
  const hotel = await prisma.hotel.upsert({
    where: { id: "cmnzxqrot0000cs8onjcau8rf" },
    update: {},
    create: {
      id: "cmnzxqrot0000cs8onjcau8rf",
      name: "HotelTriz Luxury",
      domain: "hoteltriz.duckdns.org",
    }
  });

  // 2. Crear Tipos de Habitación (Lógica Manual para evitar errores de Upsert)
  const roomTypesData = [
    { name: "Standard Room", description: "Habitación cómoda con vista a la ciudad.", basePrice: 120, capacity: 2 },
    { name: "Deluxe Suite", description: "Lujo y espacio con balcón privado.", basePrice: 250, capacity: 3 },
    { name: "Presidential Suite", description: "La joya del hotel. Máximo lujo.", basePrice: 500, capacity: 4 }
  ];

  const roomTypesMap = {};
  for (const rt of roomTypesData) {
    let createdRt = await prisma.roomType.findFirst({ where: { name: rt.name } });
    if (!createdRt) {
      createdRt = await prisma.roomType.create({
        data: { ...rt, hotelId: hotel.id }
      });
    }
    roomTypesMap[rt.name] = createdRt;
  }

  // 3. Crear Habitaciones
  const roomsData = [
    { number: "101", floor: 1, typeName: "Standard Room" },
    { number: "102", floor: 1, typeName: "Standard Room" },
    { number: "201", floor: 2, typeName: "Deluxe Suite" },
    { number: "202", floor: 2, typeName: "Deluxe Suite" },
    { number: "301", floor: 3, typeName: "Presidential Suite" }
  ];

  for (const r of roomsData) {
    const existingRoom = await prisma.room.findFirst({ where: { number: r.number } });
    if (!existingRoom) {
      await prisma.room.create({
        data: {
          number: r.number,
          floor: r.floor,
          roomTypeId: roomTypesMap[r.typeName].id,
          housekeepingStatus: "CLEAN"
        }
      });
    }
  }

  // 4. Servicios Extra
  const extrasData = [
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
