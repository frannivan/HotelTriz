require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
// Inicializamos Stripe de manera segura (si no hay key temporalmente, usamos un string vacío para no crashear Node)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_temporary_key_hoteltriz');

// Configuración de Prisma 7 con LibSQL para SQLite local
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ message: 'HotelTriz API is running smoothly (Prisma 7 + SQLite)' });
});

// Ruta para obtener disponibilidad filtrada
app.post('/api/availability', async (req, res) => {
  const { checkIn, checkOut, guests } = req.body;

  if (!checkIn || !checkOut) {
    return res.status(400).json({ error: 'Check-in and Check-out dates are required' });
  }

  try {
    // 1. Obtener tipos de habitaciones que cumplen con la capacidad
    const roomTypes = await prisma.roomType.findMany({
      where: {
        capacity: { gte: parseInt(guests) || 1 }
      },
      include: {
        rooms: {
          include: {
            bookings: {
              where: {
                OR: [
                  {
                    AND: [
                      { checkIn: { lt: new Date(checkOut) } },
                      { checkOut: { gt: new Date(checkIn) } }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    });

    // 2. Filtrar tipos que tengan al menos una habitación libre (sin colisiones)
    const availableRoomTypes = roomTypes.filter(type => {
      // Una habitación está disponible si su array de bookings (filtrado por colisión) está vacío
      const hasFreeRoom = type.rooms.some(room => room.bookings.length === 0);
      return hasFreeRoom;
    });

    res.json(availableRoomTypes);
  } catch (error) {
    console.error('Availability Error:', error);
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
  }
});

// Obtener servicios extra
app.get('/api/extra-services', async (req, res) => {
  try {
    const services = await prisma.extraService.findMany();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener servicios extra' });
  }
});

// Crear una reserva y sesión de cobro en Stripe
app.post('/api/bookings', async (req, res) => {
  const { guestName, guestEmail, checkIn, checkOut, roomId, extraServices, totalPrice } = req.body;

  try {
    // 1. Crear reserva en la BD con estado PENDING
    const booking = await prisma.booking.create({
      data: {
        guestName,
        guestEmail,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalPrice,
        status: 'PENDING',
        room: { connect: { id: roomId } },
        extraServices: {
          connect: (extraServices || []).map(id => ({ id }))
        }
      }
    });

    // 2. Crear Sesión de Stripe Checkout Segura
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Estancia en HotelTriz - ${guestName}`,
              description: `Alojamiento del ${checkIn} al ${checkOut}`
            },
            unit_amount: Math.round(totalPrice * 100), // Stripe opera en centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Permite testear localmente sin Ngrok regresando el session_id
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?payment_cancelled=true`,
      client_reference_id: booking.id,
    });

    // 3. Guardar el session ID provisionalmente
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id }
    });

    res.json({ message: 'Redirigiendo a pasarela', url: session.url, booking });
  } catch (error) {
    console.error('Booking Error:', error);
    res.status(500).json({ error: 'Error al procesar reserva o comunicación con Stripe' });
  }
});

// Endpoint de confirmación (Para uso local sin Webhook Tunnel)
app.post('/api/payments/confirm', async (req, res) => {
  const { session_id, booking_id } = req.body;
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid' || session.status === 'complete') {
      const updated = await prisma.booking.update({
        where: { id: booking_id },
        data: { status: 'CONFIRMED' }
      });
      return res.json({ success: true, booking: updated });
    }
    res.status(400).json({ success: false, error: 'Pago no completado u origen desconocido' });
  } catch (error) {
    res.status(500).json({ error: 'Error validando estado en Stripe' });
  }
});

// === ENDPOINTS ADMINISTRATIVOS (FASE 3 & SEGURIDAD) ===

// Login Administrativo MVP
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'hoteltriz2026';
  
  if (password === adminPassword) {
    // Para la etapa actual antes de Supabase, validamos con un token simple estático
    res.json({ token: 'admin_authorized_token_hoteltriz_v1' });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// Obtener estadísticas para el dashboard
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalBookings = await prisma.booking.count();
    const roomsCount = await prisma.room.count();
    const totalRevenue = await prisma.booking.aggregate({
      _sum: { totalPrice: true }
    });
    
    // Ocupación hoy (simulado: hoy hay reservas activas)
    const today = new Date();
    today.setHours(0,0,0,0);
    const occupiedRooms = await prisma.booking.count({
      where: {
        checkIn: { lte: today },
        checkOut: { gte: today },
        status: { not: 'CANCELLED' }
      }
    });

    res.json({
      totalBookings,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      occupancyRate: roomsCount > 0 ? (occupiedRooms / roomsCount) * 100 : 0,
      occupiedRooms,
      totalRooms: roomsCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Lista completa de reservas (Staff)
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        room: { include: { roomType: true } },
        extraServices: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener reservas admin' });
  }
});

// Gestión de estado general de la habitación
app.patch('/api/admin/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 

  try {
    const updatedRoom = await prisma.room.update({
      where: { id },
      data: { status }
    });
    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar habitación' });
  }
});

// Obtener Tareas de Limpieza Diarias (Housekeeping)
app.get('/api/admin/housekeeping', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23,59,59,999);

    const rooms = await prisma.room.findMany({
      include: {
        roomType: true,
        // Traer reservas que hagan checkout hoy (Departures)
        bookings: {
          where: {
            checkOut: { gte: today, lte: endOfDay },
            status: { not: 'CANCELLED' }
          }
        }
      }
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tareas de limpieza' });
  }
});

// Marcar habitación limpia/sucia
app.patch('/api/admin/rooms/:id/housekeeping', async (req, res) => {
  const { id } = req.params;
  const { housekeepingStatus } = req.body;
  try {
    const updated = await prisma.room.update({
      where: { id },
      data: { housekeepingStatus }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando limpieza' });
  }
});


// === FASE 4: SINCRONIZACIÓN ICAL (PUENTE) ===

const https = require('https');

// Parser nativo ligero para iCal
function parseIcal(data) {
  const events = [];
  let currentEvent = null;
  const lines = data.split(/\r?\n/);

  for (let line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent.start && currentEvent.end) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('DTSTART')) currentEvent.start = line.split(':')[1];
      if (line.startsWith('DTEND')) currentEvent.end = line.split(':')[1];
      if (line.startsWith('UID')) currentEvent.uid = line.split(':')[1];
      if (line.startsWith('SUMMARY')) currentEvent.summary = line.split(':')[1];
    }
  }
  return events;
}

// Convertir formato iCal (YYYYMMDD) a Date
function icalToDate(icalStr) {
  if (!icalStr) return null;
  const year = icalStr.substring(0, 4);
  const month = icalStr.substring(4, 6);
  const day = icalStr.substring(6, 8);
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

// Guardar URLs de sincronización (Admin)
app.post('/api/admin/sync/settings', async (req, res) => {
  const { airbnbIcalUrl, bookingIcalUrl } = req.body;
  try {
    const hotel = await prisma.hotel.findFirst();
    if (hotel) {
      const updated = await prisma.hotel.update({
        where: { id: hotel.id },
        data: { airbnbIcalUrl, bookingIcalUrl }
      });
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Hotel no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar configuración iCal' });
  }
});

// Ruta Pública para Exportar Calendario de HotelTriz
app.get('/api/public/calendar/:hotelId.ics', async (req, res) => {
  const { hotelId } = req.params;
  try {
    const bookings = await prisma.booking.findMany({
      where: { room: { roomType: { hotelId } }, status: 'CONFIRMED' }
    });

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HotelTriz//NONSGML v1.0//EN\n";
    bookings.forEach(b => {
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `DTSTART:${b.checkIn.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
      icsContent += `DTEND:${b.checkOut.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
      icsContent += `SUMMARY:Reserva HotelTriz - ${b.guestName}\n`;
      icsContent += `UID:${b.id}@hoteltriz.com\n`;
      icsContent += "END:VEVENT\n";
    });
    icsContent += "END:VCALENDAR";

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="hotel_${hotelId}.ics"`);
    res.send(icsContent);
  } catch (error) {
    res.status(500).send('Error generating calendar');
  }
});

// Disparar sincronización manual (Admin)
app.post('/api/admin/sync/trigger', async (req, res) => {
  const hotel = await prisma.hotel.findFirst(); // En esta versión manejamos un solo hotel por instancia
  if (!hotel || (!hotel.airbnbIcalUrl && !hotel.bookingIcalUrl)) {
    return res.status(400).json({ error: 'No hay URLs de sincronización configuradas.' });
  }

  const syncResults = [];

  const sources = [
    { name: 'AIRBNB', url: hotel.airbnbIcalUrl },
    { name: 'BOOKING', url: hotel.bookingIcalUrl }
  ].filter(s => s.url);

  for (const source of sources) {
    try {
      const data = await new Promise((resolve, reject) => {
        https.get(source.url, (resp) => {
          let str = '';
          resp.on('data', (chunk) => str += chunk);
          resp.on('end', () => resolve(str));
        }).on('error', reject);
      });

      const externalEvents = parseIcal(data);
      let newBlocks = 0;

      for (const event of externalEvents) {
        const checkIn = icalToDate(event.start);
        const checkOut = icalToDate(event.end);
        
        // Evitar duplicados usando externalId
        const existing = await prisma.booking.findFirst({
          where: { externalId: event.uid }
        });

        if (!existing && checkIn && checkOut) {
          // Bloquear la primera habitación disponible
          const firstRoom = await prisma.room.findFirst(); 
          if (firstRoom) {
            await prisma.booking.create({
              data: {
                guestName: event.summary || `Reserva ${source.name}`,
                guestEmail: 'sync@hoteltriz.com',
                checkIn,
                checkOut,
                status: 'CONFIRMED',
                totalPrice: 0,
                source: source.name,
                externalId: event.uid,
                roomId: firstRoom.id
              }
            });
            newBlocks++;
          }
        }
      }
      syncResults.push({ source: source.name, newBlocks });
    } catch (err) {
      console.error(`Error syncing ${source.name}:`, err);
      syncResults.push({ source: source.name, error: 'Fallo al conectar o parsear' });
    }
  }

  res.json({ message: 'Sincronización completada', details: syncResults });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
