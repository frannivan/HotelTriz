const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  });
  const prisma = new PrismaClient({ adapter });
  console.log('🛡️  INICIANDO SANEAMIENTO DE INTEGRIDAD (Modo Adaptador)...');
  
  // Debug: Ver modelos disponibles si falla
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
  console.log('📦 Modelos detectados en Prisma:', models.join(', '));

  try {
    // 1. Consolidar Tipos de Habitación (por nombre)
    const roomTypes = await prisma.roomType.findMany({ include: { _count: { select: { rooms: true } } } });
    const typeGroups = {};
    roomTypes.forEach(t => {
      if (!typeGroups[t.name]) typeGroups[t.name] = [];
      typeGroups[t.name].push(t);
    });

    for (const [name, list] of Object.entries(typeGroups)) {
      if (list.length > 1) {
        console.log(`  - Consolidando Tipo de Habitación: "${name}"`);
        const master = list.sort((a,b) => b._count.rooms - a._count.rooms)[0];
        const dups = list.filter(t => t.id !== master.id);
        for (const dup of dups) {
          await prisma.room.updateMany({ where: { roomTypeId: dup.id }, data: { roomTypeId: master.id } });
          await prisma.roomType.delete({ where: { id: dup.id } });
        }
      }
    }

    // 2. Consolidar Habitaciones (por número)
    const rooms = await prisma.room.findMany({ include: { _count: { select: { bookings: true } } } });
    const roomGroups = {};
    rooms.forEach(r => {
      if (!roomGroups[r.number]) roomGroups[r.number] = [];
      roomGroups[r.number].push(r);
    });

    for (const [num, list] of Object.entries(roomGroups)) {
      if (list.length > 1) {
        console.log(`  - Consolidando Habitación: ${num}`);
        const master = list.sort((a,b) => b._count.bookings - a._count.bookings)[0];
        const dups = list.filter(r => r.id !== master.id);
        for (const dup of dups) {
          await prisma.booking.updateMany({ where: { roomId: dup.id }, data: { roomId: master.id } });
          await prisma.room.delete({ where: { id: dup.id } });
        }
      }
    }

    // 3. Consolidar Servicios Extra (por nombre)
    const extras = await prisma.extraService.findMany({ include: { _count: { select: { bookings: true } } } });
    const extraGroups = {};
    extras.forEach(e => {
      if (!extraGroups[e.name]) extraGroups[e.name] = [];
      extraGroups[e.name].push(e);
    });

    for (const [name, list] of Object.entries(extraGroups)) {
      if (list.length > 1) {
        console.log(`  - Consolidando Servicio Extra: "${name}"`);
        const master = list.sort((a,b) => b._count.bookings - a._count.bookings)[0];
        const dups = list.filter(e => e.id !== master.id);
        for (const dup of dups) {
          // Actualizar relaciones en la tabla pivot de reservas
          await prisma.extraServiceOnBooking.updateMany({
            where: { extraServiceId: dup.id },
            data: { extraServiceId: master.id }
          });
          await prisma.extraService.delete({ where: { id: dup.id } });
        }
      }
    }

    console.log('✅ SANEAMIENTO COMPLETADO.');
  } catch (error) {
    console.error('❌ ERROR DURANTE EL SANEAMIENTO:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
