const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🚀 Iniciando consolidación de habitaciones...');

  try {
    // 1. Obtener todas las habitaciones
    const allRooms = await prisma.room.findMany({
      include: { _count: { select: { bookings: true } } }
    });

    // 2. Agrupar por número de habitación
    const groups = {};
    allRooms.forEach(room => {
      if (!groups[room.number]) groups[room.number] = [];
      groups[room.number].push(room);
    });

    for (const [number, rooms] of Object.entries(groups)) {
      if (rooms.length > 1) {
        console.log(`\n📦 Detectados ${rooms.length} duplicados para la habitación ${number}`);
        
        // Elegir la "Maestra": la que tenga más reservas o simplemente la primera
        const master = rooms.sort((a, b) => b._count.bookings - a._count.bookings)[0];
        const duplicates = rooms.filter(r => r.id !== master.id);

        console.log(`🏆 Maestra elegida: ID ${master.id} (Reservas: ${master._count.bookings})`);

        for (const dup of duplicates) {
          console.log(`  - Transfiriendo reservas de ID ${dup.id} -> ${master.id}...`);
          
          // Mover reservas a la maestra
          const updateResult = await prisma.booking.updateMany({
            where: { roomId: dup.id },
            data: { roomId: master.id }
          });
          
          console.log(`    ✅ ${updateResult.count} reservas movidas.`);

          // Borrar la habitación duplicada
          await prisma.room.delete({
            where: { id: dup.id }
          });
          console.log(`    🗑️  Habitación duplicada ID ${dup.id} eliminada.`);
        }
      }
    }

    console.log('\n✨ ¡Consolidación completada con éxito!');
  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA CONSOLIDACIÓN:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
