const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || 'file:../prisma/dev.db',
  });
  const prisma = new PrismaClient({ adapter });

  console.log('--- DIAGNÓSTICO PRISMA ---');
  try {
    const hotelCount = await prisma.hotel.count();
    console.log('Hoteles:', hotelCount);
    
    const reasons = await prisma.cancellationReason.findMany();
    console.log('Motivos de cancelación encontrados:', reasons.length);
    console.log('Lista:', JSON.stringify(reasons));
    
  } catch (error) {
    console.error('❌ ERROR EN PRISMA:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
