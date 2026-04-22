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
const PORT = process.env.PORT || 3002;

app.use(cors());

// --- RUTA DE WEBHOOK (DEBE IR ANTES DE express.json()) ---
// Stripe requiere el cuerpo del mensaje "en bruto" (raw) para verificar la firma.
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`❌ Error de firma en Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento de pago completado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata.bookingId;

    console.log(`💰 Pago confirmado para reserva: ${bookingId}`);

    try {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' }
      });
      console.log('✅ Reserva marcada como CONFIRMED en la base de datos.');
    } catch (dbError) {
      console.error('❌ Error al actualizar la base de datos en webhook:', dbError);
    }
  }

  res.json({ received: true });
});

// Middleware estándar para el resto de rutas
app.use(express.json());

// Logger de Tráfico (DEPURACIÓN MASTER)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/admin/bookings')) {
    console.log(`📡 [ADMIN_PROBE] ${req.method} ${req.url}`);
  } else {
    console.log(`📡 [TRAFFIC] ${req.method} ${req.url}`);
  }
  next();
});

// ==========================================
// RUTAS ADMINISTRATIVAS DE ALTA PRIORIDAD
// ==========================================

// Atrapa-Todo para Diagnóstico
app.use('/api/admin/bookings/:id', (req, res, next) => {
  console.log(`🔍 [PROBE] Petición detectada para reserva ${req.params.id} -> Procediendo a buscar ruta...`);
  next();
});

// Motivos de Cancelación (ALTA PRIORIDAD)
app.get('/api/admin/cancellation-reasons', async (req, res) => {
  try {
    const reasons = await prisma.cancellationReason.findMany();
    res.json(reasons);
  } catch (error) {
    console.warn('⚠️ [BACKEND] DB Error en motivos. Sirviendo motivos de emergencia.');
    // Motivos de emergencia para que la UI nunca esté vacía
    res.json([
      { id: 'err_reserva', name: 'Error en la reserva' },
      { id: 'cambio_planes', name: 'Cambio de planes' },
      { id: 'no_show', name: 'No se presentó (No-Show)' },
      { id: 'otro', name: 'Otro motivo' }
    ]);
  }
});

// Cobrar y Confirmar Reserva Manual
app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: { status }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estatus' });
  }
});

// Modificar Reserva (Drag & Drop o Manual)
app.patch('/api/admin/bookings/:id/update-pos', async (req, res) => {
  const { id } = req.params;
  const { roomId, checkIn, checkOut } = req.body;
  
  console.log(`[DEBUG] Petición PATCH recibida para ID: ${id}`);
  console.log(`[DEBUG] Datos:`, req.body);

  try {
    const cIn = new Date(checkIn);
    const cOut = new Date(checkOut);

    // 1. Verificar colisiones (excluyendo la propia reserva)
    const conflicts = await prisma.booking.findMany({
      where: {
        roomId,
        id: { not: id },
        status: { not: 'CANCELLED' },
        AND: [
          { checkIn: { lt: cOut } },
          { checkOut: { gt: cIn } }
        ]
      }
    });

    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Choque de fechas: Este espacio ya está ocupado.' });
    }

    // 2. Calcular diferencia de precio (basado en precio base del RoomType)
    const currentBooking = await prisma.booking.findUnique({ 
      where: { id },
      include: { room: { include: { roomType: true } } }
    });
    
    if (!currentBooking) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const targetRoom = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true }
    });

    if (!targetRoom) {
      return res.status(404).json({ error: 'Habitación de destino no encontrada' });
    }

    // Asegurar que tenemos precio base
    const basePrice = targetRoom.roomType?.basePrice || 0;
    const days = Math.ceil((cOut - cIn) / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return res.status(400).json({ error: 'Las fechas seleccionadas no son válidas' });
    }

    const newTotal = basePrice * days;
    const priceDiff = newTotal - currentBooking.totalPrice;

    // 3. Ejecutar actualización
    const updated = await prisma.booking.update({
      where: { id },
      data: { 
        roomId, 
        checkIn: cIn, 
        checkOut: cOut,
        totalPrice: newTotal
      }
    });

    res.json({ 
      message: 'Reserva movida con éxito', 
      booking: updated,
      priceDiff 
    });
  } catch (error) {
    console.error('Update Booking Error:', error);
    res.status(400).json({ error: error.message || 'Error al procesar el cambio en la reserva' });
  }
});

// Cancelar con Motivo
app.post('/api/admin/bookings/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reasonId, details } = req.body;
  
  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: { 
        status: 'CANCELLED',
        cancellationReasonId: reasonId,
        cancellationDetails: details
      }
    });
    res.json({ message: 'Reserva cancelada correctamente', booking: updated });
  } catch (error) {
    res.status(500).json({ error: 'Error al cancelar reserva' });
  }
});

// Simulador de Agencias Externas (Booking/Airbnb)
app.post('/api/admin/simulate-external-booking', async (req, res) => {
  const { guestName, checkIn, checkOut, roomId, source } = req.body;
  
  try {
    const booking = await prisma.booking.create({
      data: {
        guestName,
        guestEmail: `sync-${Math.floor(Math.random() * 1000)}@${source.toLowerCase()}-tester.com`,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        status: 'CONFIRMED',
        totalPrice: 0, // En iCal/Simulación no siempre viene el precio
        source,
        externalId: `${source.substring(0,2).toUpperCase()}-${Math.floor(Math.random() * 899999 + 100000)}`,
        roomId
      }
    });
    res.json({ message: `Reserva de ${source} simulada con éxito`, booking });
  } catch (error) {
    console.error('Simulation Error:', error);
    res.status(500).json({ error: 'Fallo al simular reserva externa' });
  }
});

// === GESTIÓN DE BLOQUEOS DE MANTENIMIENTO (PROFESIONAL) ===

// Listar bloqueos
app.get('/api/admin/maintenance-blocks', async (req, res) => {
  try {
    const blocks = await prisma.maintenanceBlock.findMany({
      include: { room: { include: { roomType: true } } },
      orderBy: { startDate: 'asc' }
    });
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener bloqueos' });
  }
});

// Crear bloqueo
app.post('/api/admin/maintenance-blocks', async (req, res) => {
  const { roomId, startDate, endDate, reason } = req.body;
  
  try {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    
    // Validar fechas
    if (sDate >= eDate) {
      return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la de fin.' });
    }

    // Verificar colisiones con reservas existentes
    const overlapBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { not: 'CANCELLED' },
        AND: [
          { checkIn: { lt: eDate } },
          { checkOut: { gt: sDate } }
        ]
      }
    });

    if (overlapBooking) {
      return res.status(409).json({ error: 'Hay una reserva activa en esas fechas. Debe moverla antes de bloquear.' });
    }

    const block = await prisma.maintenanceBlock.create({
      data: {
        roomId,
        startDate: sDate,
        endDate: eDate,
        reason
      }
    });
    res.json(block);
  } catch (error) {
    console.error('Error creating block:', error);
    res.status(500).json({ error: 'Error al crear bloqueo técnico' });
  }
});

// Actualizar bloqueo
app.patch('/api/admin/maintenance-blocks/:id', async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, reason } = req.body;
  
  try {
    const sDate = startDate ? new Date(startDate) : undefined;
    const eDate = endDate ? new Date(endDate) : undefined;

    // Validar si las fechas son válidas si se proporcionaron
    if ((startDate && isNaN(sDate.getTime())) || (endDate && isNaN(eDate.getTime()))) {
      return res.status(400).json({ error: 'Formato de fecha inválido.' });
    }

    // Si se cambian fechas, verificar colisiones
    if (sDate || eDate) {
      const current = await prisma.maintenanceBlock.findUnique({ where: { id } });
      if (!current) return res.status(404).json({ error: 'Bloqueo no encontrado.' });

      const finalS = (startDate && !isNaN(sDate.getTime())) ? sDate : current.startDate;
      const finalE = (endDate && !isNaN(eDate.getTime())) ? eDate : current.endDate;

      // Validar orden de fechas
      if (finalS >= finalE) {
        return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la de fin.' });
      }

      const overlapBooking = await prisma.booking.findFirst({
        where: {
          roomId: current.roomId,
          status: { not: 'CANCELLED' },
          AND: [
            { checkIn: { lt: finalE } },
            { checkOut: { gt: finalS } }
          ]
        }
      });

      if (overlapBooking) {
        return res.status(409).json({ error: 'Las nuevas fechas colisionan con una reserva existente.' });
      }
    }

    const block = await prisma.maintenanceBlock.update({
      where: { id },
      data: {
        startDate: sDate,
        endDate: eDate,
        reason
      }
    });
    res.json(block);
  } catch (error) {
    console.error('SERVER PATCH ERROR:', error);
    res.status(500).json({ 
      error: 'Error interno al actualizar el bloqueo técnico',
      details: error.message 
    });
  }
});

// Eliminar bloqueo
app.delete('/api/admin/maintenance-blocks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.maintenanceBlock.delete({ where: { id } });
    res.json({ message: 'Bloqueo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar bloqueo' });
  }
});

// ==========================================
// FIN RUTAS ADMINISTRATIVAS
// ==========================================

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
          where: { status: 'AVAILABLE' }, // Solo habitaciones operativas (Modo global)
          include: {
            bookings: {
              where: {
                status: { not: 'CANCELLED' },
                OR: [
                  {
                    AND: [
                      { checkIn: { lt: new Date(checkOut) } },
                      { checkOut: { gt: new Date(checkIn) } }
                    ]
                  }
                ]
              }
            },
            maintenanceBlocks: {
              where: {
                OR: [
                  {
                    AND: [
                      { startDate: { lt: new Date(checkOut) } },
                      { endDate: { gt: new Date(checkIn) } }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    });

    // 2. Filtrar tipos que tengan al menos una habitación libre (sin colisiones de NINGÚN tipo)
    const availableRoomTypes = roomTypes.filter(type => {
      const hasFreeRoom = type.rooms.some(room => 
        room.bookings.length === 0 && room.maintenanceBlocks.length === 0
      );
      return hasFreeRoom;
    });

    res.json(availableRoomTypes);
  } catch (error) {
    console.error('Availability Error:', error);
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
  }
});

// Obtener motivos de cancelación

// Obtener servicios extra
app.get('/api/extra-services', async (req, res) => {
  try {
    const services = await prisma.extraService.findMany();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener servicios extra' });
  }
});

// Crear una reserva pública (Sin pasarela de pago por ahora)
app.post('/api/bookings', async (req, res) => {
  const { guestName, guestEmail, checkIn, checkOut, roomId, extraServices, totalPrice } = req.body;

  try {
    // 1. Crear reserva en la BD con estado PENDING (Pago en efectivo en recepción)
    const booking = await prisma.booking.create({
      data: {
        guestName,
        guestEmail,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalPrice,
        status: 'PENDING',
        source: 'LOCAL',
        room: { connect: { id: roomId } },
        extraServices: {
          connect: (extraServices || []).map(id => ({ id }))
        }
      }
    });
    // 2. Obtener detalles básicos del hotel y habitación para Stripe
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true }
    });

    const clientUrl = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:3030';

    // 3. Crear Sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Reserva: ${room.roomType.name}`,
              description: `Huésped: ${guestName} | ${checkIn} al ${checkOut}`,
            },
            unit_amount: Math.round(totalPrice * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: guestEmail,
      metadata: {
        bookingId: booking.id
      },
      success_url: `${clientUrl.replace(/\/$/, '')}/?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
      cancel_url: `${clientUrl.replace(/\/$/, '')}/?payment_cancelled=true`,
    });

    // 4. Guardar ID de sesión en la reserva
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id }
    });

    // Enviamos la URL de redirección al cliente
    res.json({ 
      message: 'Checkout iniciado', 
      url: session.url,
      booking 
    });
  } catch (error) {
    console.error('Booking Error:', error);
    res.status(500).json({ error: 'Error al procesar reserva o pago' });
  }
});

// Endpoint de confirmación (Desactivado temporalmente - uso futuro para Stripe Webhooks)
app.post('/api/payments/confirm', async (req, res) => {
  const { session_id, booking_id } = req.body;
  console.log(`🔍 Intentando confirmar pago manualmente: Session=${session_id}, Booking=${booking_id}`);
  
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      const updated = await prisma.booking.update({
        where: { id: booking_id },
        data: { status: 'CONFIRMED' }
      });
      return res.json({ success: true, booking: updated });
    }
    res.status(400).json({ success: false, error: 'El pago no ha sido completado' });
  } catch (error) {
    console.error('Stripe Confirm Error:', error);
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

// Cambiar estado de limpieza (Housekeeping)
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
    res.status(500).json({ error: 'Error al actualizar limpieza' });
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
        // Traer reservas con movimiento HOY (Entradas o Salidas)
        bookings: {
          where: {
            OR: [
              { checkOut: { gte: today, lte: endOfDay } },
              { checkIn: { gte: today, lte: endOfDay } }
            ],
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


// === Módulo de Reservas Físicas (Recepción) ===
app.post('/api/admin/bookings/new', async (req, res) => {
  const { guestName, checkIn, checkOut, roomId, totalPrice, force } = req.body;
  
  if (!checkIn || !checkOut || !roomId) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const cIn = new Date(checkIn);
    const cOut = new Date(checkOut);
    
    // 1. Verificación Local: Comprobar colisión estricta en la Base de Datos para esta habitación específica
    const localConflicts = await prisma.booking.findMany({
      where: {
        roomId,
        status: { not: 'CANCELLED' },
        AND: [
          { checkIn: { lt: cOut } },
          { checkOut: { gt: cIn } }
        ]
      }
    });

    if (localConflicts.length > 0 && !force) {
      return res.status(409).json({ 
        error: 'CONFLICTO LOCAL: Esta habitación ya está ocupada en esas fechas en tu sistema interno. ¿Deseas sobreescribir y forzar la reserva?',
        conflictType: 'LOCAL'
      });
    }

    // 2. Verificación Externa (Pre-Flight iCal)
    if (!force) {
      const hotel = await prisma.hotel.findFirst();
      if (hotel) {
        const urls = [hotel.airbnbIcalUrl, hotel.bookingIcalUrl].filter(Boolean);
        for (const url of urls) {
          try {
            const data = await new Promise((resolve, reject) => {
              https.get(url, (resp) => { let str = ''; resp.on('data', chunk => str += chunk); resp.on('end', () => resolve(str)); }).on('error', reject);
            });
            const events = parseIcal(data);
            
            // Comprobar si hay un evento externo que coincida con las fechas (Aviso general de OTA)
            const hasOtaConflict = events.some(event => {
              const eIn = icalToDate(event.start);
              const eOut = icalToDate(event.end);
              return eIn < cOut && eOut > cIn;
            });
            
            if (hasOtaConflict) {
              return res.status(409).json({ 
                error: 'ALERTA AGENCIAS: Se ha detectado una reserva en Booking.com / Airbnb que choca con estas fechas. ¿Forzar inserción de todas formas?',
                conflictType: 'OTA'
              });
            }
          } catch (e) {
            console.error('Error pre-flight iCal:', e);
            // Si falla la OTA, seguimos silenciosamente (por ser caché) o podríamos alertar.
          }
        }
      }
    }

    // 3. Inserción Directa
    const booking = await prisma.booking.create({
      data: {
        guestName: guestName || 'Walk-in Guest',
        guestEmail: 'recepcion@hoteltriz.com',
        checkIn: cIn,
        checkOut: cOut,
        totalPrice: parseFloat(totalPrice) || 0,
        status: 'PENDING', // Cobro en mostrador pendiente
        source: 'LOCAL',
        roomId
      }
    });

    res.json({ message: 'Reserva administrativa creada', booking });
  } catch (error) {
    console.error('Error Admin Booking:', error);
    res.status(500).json({ error: 'Error del servidor al crear reserva' });
  }
});

// (Rutas movidas al inicio para prioridad)

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
