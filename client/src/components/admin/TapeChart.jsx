import React, { useState, useEffect } from 'react';
import { roomService } from '../../services/api';

// Ayudantes de Formateo Fuera del Componente (v10.1 - Rescate)
const safeDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch (e) {
    return new Date();
  }
};

const formatDateForInput = (dateStr) => {
  const d = safeDate(dateStr);
  return d.toISOString().split('T')[0];
};

const TapeChart = ({ onOpenBookingModal }) => {
  const [bookings, setBookings] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const [confirmMove, setConfirmMove] = useState(null); // { booking, targetRoom, targetCheckIn }
  const [priceDiff, setPriceDiff] = useState(0);

  // Estados para Navegación y Filtros (v10)
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'list'
  const [baseDate, setBaseDate] = useState(new Date());
  const [searchGuest, setSearchGuest] = useState('');
  const [showOnlyWithBookings, setShowOnlyWithBookings] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'CONFIRMED' | 'OTAS'
  const [filterDates, setFilterDates] = useState({ start: '', end: '' });

  // Estados para Edición (Restaurados)
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ roomId: '', checkIn: '', checkOut: '' });

  // Estados para Resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizeBooking, setResizeBooking] = useState(null);

  // Generar 15 días desde la fecha base
  const generateDates = (start) => {
    const dates = [];
    const begin = new Date(start);
    begin.setHours(0, 0, 0, 0);
    for (let i = 0; i < 15; i++) {
      const date = new Date(begin);
      date.setDate(begin.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = generateDates(baseDate);

  // Navegación temporal
  const handlePrev = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() - 15);
    setBaseDate(newDate);
  };
  const handleNext = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() + 15);
    setBaseDate(newDate);
  };
  const handleToday = () => setBaseDate(new Date());

  // Lógica de Filtrado (Ultra-Defensiva)
  const filteredBookings = (bookings || []).filter(b => {
    // Filtro de Búsqueda
    const search = (searchGuest || '').toLowerCase();
    const guestName = (b.guestName || '').toLowerCase();
    const bId = (b.id || '').toLowerCase();
    const matchesSearch = !searchGuest || guestName.includes(search) || bId.includes(search);
    
    // Filtro de Estado / Tipo
    let matchesStatus = true;
    if (statusFilter === 'OTAS') {
      matchesStatus = b.source !== 'LOCAL';
    } else if (statusFilter !== 'ALL') {
      matchesStatus = (b.status === statusFilter);
    }

    // Filtro de Rango de Fechas
    let matchesDate = true;
    const bIn = new Date(b.checkIn);
    const bOut = new Date(b.checkOut);

    if (filterDates.start) {
      const dStart = new Date(filterDates.start);
      if (!isNaN(dStart.getTime()) && bOut < dStart) matchesDate = false;
    }
    if (filterDates.end) {
      const dEnd = new Date(filterDates.end);
      if (!isNaN(dEnd.getTime()) && bIn > dEnd) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookingsData, roomsData, reasonsData] = await Promise.all([
          roomService.getAdminBookings().catch(() => []),
          roomService.getHousekeepingTasks().catch(() => []),
          roomService.getCancellationReasons().catch(() => [])
        ]);
        
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
        setAllRooms(Array.isArray(roomsData) ? roomsData : []);
        setReasons(Array.isArray(reasonsData) ? reasonsData : []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching admin data:', err);
        setLoading(false);
      }
    };
    fetchData();
    // Cargar motivos de cancelación
    roomService.getCancellationReasons().then(setReasons).catch(console.error);

    // Escuchar refrescos externos
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-calendar', handleRefresh);
    return () => window.removeEventListener('refresh-calendar', handleRefresh);
  }, []);

  const handleDragStart = (e, booking) => {
    e.dataTransfer.setData('bookingId', booking.id);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
  };

  const handleDrop = async (e, targetRoom, targetDayIndex) => {
    e.preventDefault();
    const bookingId = e.dataTransfer.getData('bookingId');
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Calcular nueva fecha de entrada manteniendo la duración
    const msPerDay = 1000 * 60 * 60 * 24;
    const durationDays = Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / msPerDay);
    const newCheckIn = new Date(dates[targetDayIndex]);
    newCheckIn.setHours(12, 0, 0, 0);
    const newCheckOut = new Date(newCheckIn.getTime() + (durationDays * msPerDay));

    // Verificar colisión en el frontend (más rápido)
    const collision = bookings.find(b => 
      b.id !== bookingId &&
      b.roomId === targetRoom.id &&
      b.status !== 'CANCELLED' &&
      new Date(b.checkIn) < newCheckOut &&
      new Date(b.checkOut) > newCheckIn
    );

    if (collision) {
      alert("⚠️ ESPACIO OCUPADO: No puedes mover la reserva a esta habitación en estas fechas.");
      return;
    }

    // Calcular diferencia de precio (Simulación)
    const oldPricePerNight = booking.totalPrice / durationDays;
    const newPricePerNight = targetRoom.roomType.basePrice;
    const newTotal = newPricePerNight * durationDays;
    setPriceDiff(newTotal - booking.totalPrice);

    setConfirmMove({
      booking,
      targetRoom,
      newCheckIn,
      newCheckOut,
      newTotal
    });
  };

  const executeMove = async () => {
    try {
      await roomService.updateBookingPos(confirmMove.booking.id, {
        roomId: confirmMove.targetRoom.id,
        checkIn: confirmMove.newCheckIn.toISOString(),
        checkOut: confirmMove.newCheckOut.toISOString()
      });
      // Refrescar datos
      const bookingsData = await roomService.getAdminBookings();
      setBookings(bookingsData);
      setConfirmMove(null);
    } catch (error) {
      const msg = error.response?.data?.error || error.message || "Error al mover reserva";
      alert(`⚠️ ERROR: ${msg}`);
      setConfirmMove(null);
    }
  };

  const handleCancel = async () => {
    try {
      await roomService.cancelBooking(selectedBooking.id, {
        reasonId: cancelReasonId,
        details: cancelDetails
      });
      // Refrescar
      const bookingsData = await roomService.getAdminBookings();
      setBookings(bookingsData);
      setIsCancelling(false);
      setSelectedBooking(null);
    } catch (error) {
      alert("Error al cancelar");
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      await roomService.updateBookingStatus(bookingId, newStatus);
      // Actualizar localmente para que cambie el color/estado en tiempo real
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.error('Error al actualizar estatus:', err);
      alert('Error al actualizar el estado de la reserva');
    }
  };

  const handleUpdateManual = () => {
    if (!selectedBooking?.id) {
      alert("❌ ERROR: El ID de la reserva no está definido.");
      return;
    }

    const targetRoom = allRooms.find(r => r.id === editFormData.roomId);
    if (!targetRoom) {
      alert("❌ ERROR: No se encontró la habitación seleccionada.");
      return;
    }

    // Preparar fechas seguras (Normalizadas a mediodía para evitar saltos de zona horaria)
    const newCheckIn = new Date(editFormData.checkIn + 'T12:00:00Z');
    const newCheckOut = new Date(editFormData.checkOut + 'T12:00:00Z');

    if (newCheckIn >= newCheckOut) {
      alert("⚠️ ERROR: La fecha de entrada debe ser anterior a la de salida.");
      return;
    }

    // Calcular duración y colisiones
    const msPerDay = 1000 * 60 * 60 * 24;
    const durationDays = Math.ceil((newCheckOut - newCheckIn) / msPerDay);

    const collision = filteredBookings.find(b => 
      b.id !== selectedBooking.id && 
      b.roomId === targetRoom.id &&
      b.status !== 'CANCELLED' &&
      new Date(b.checkIn) < newCheckOut &&
      new Date(b.checkOut) > newCheckIn
    );

    if (collision) {
      alert("⚠️ ESPACIO OCUPADO: No puedes mover la reserva a esta habitación en estas fechas (Colisión detectada).");
      return;
    }

    // Simulación de Diferencia de Precio
    const oldDuration = Math.ceil((new Date(selectedBooking.checkOut) - new Date(selectedBooking.checkIn)) / msPerDay);
    const oldPricePerNight = selectedBooking.totalPrice / (oldDuration || 1);
    const newPricePerNight = targetRoom.roomType?.basePrice || oldPricePerNight;
    const newTotal = newPricePerNight * durationDays;
    setPriceDiff(newTotal - selectedBooking.totalPrice);

    // Activar Modal de Confirmación
    setConfirmMove({
      booking: selectedBooking,
      targetRoom,
      newCheckIn,
      newCheckOut,
      newTotal
    });

    // Cerrar panel de edición para mostrar el modal
    setIsEditing(false);
    setSelectedBooking(null);
  };

  // Lógica de Resizing
  const handleResizeStart = (e, booking) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeBooking(booking);
    
    const handleMouseMove = (moveEvent) => {
      // Opcional: Feedback visual durante el resize
    };

    const handleMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);
      
      // Calcular nueva fecha basada en la posición final
      const grid = document.querySelector('.min-w-\\[800px\\]').getBoundingClientRect();
      const x = upEvent.clientX - grid.left - 128; // 128 es el ancho de la columna Habitación
      const cellWidth = (grid.width - 128) / dates.length;
      const dayIndex = Math.floor(x / cellWidth);
      
      if (dayIndex >= 0 && dayIndex < dates.length) {
        const newCheckOut = new Date(dates[dayIndex]);
        newCheckOut.setHours(12, 0, 0, 0);
        
        if (newCheckOut <= new Date(booking.checkIn)) {
          alert("La fecha de salida debe ser después de la entrada");
          return;
        }

        // Simular drop para disparar el modal de confirmación con el nuevo precio
        const targetRoom = allRooms.find(r => r.id === booking.roomId);
        const msPerDay = 1000 * 60 * 60 * 24;
        const durationDays = Math.round((newCheckOut - new Date(booking.checkIn)) / msPerDay);
        const newTotal = targetRoom.roomType.basePrice * durationDays;
        
        setPriceDiff(newTotal - booking.totalPrice);
        setConfirmMove({
          booking,
          targetRoom,
          newCheckIn: new Date(booking.checkIn),
          newCheckOut: newCheckOut,
          newTotal
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (loading) return <div className="p-10 text-center text-xs text-gray-500 uppercase tracking-widest font-semibold">Cargando Calendario...</div>;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden p-6 animate-in fade-in duration-500">
      {/* TOOLBAR SUPERIOR (v11 - Optimizado) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <button 
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'chart' ? 'bg-[#111] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <i className="fa-solid fa-calendar-days mr-2"></i>Calendario
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'list' ? 'bg-[#111] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <i className="fa-solid fa-list-ul mr-2"></i>Lista
            </button>
          </div>

          <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden lg:block"></div>

          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <button onClick={handlePrev} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button onClick={handleToday} className="px-3 py-1.5 text-[9px] font-black uppercase text-[#111] hover:bg-gray-100 rounded-md">Hoy</button>
            <button onClick={handleNext} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap flex-1 items-center gap-3 justify-end min-w-full lg:min-w-0">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input 
              type="text" 
              placeholder="Buscar huésped..."
              value={searchGuest}
              onChange={(e) => setSearchGuest(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-xs outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/10 transition-all shadow-sm"
            />
            {searchGuest && (
              <button 
                onClick={() => setSearchGuest('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
          </div>

          <div className="flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === 'ALL' ? 'bg-gray-100 text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === 'PENDING' ? 'bg-amber-400 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'PENDING' ? 'bg-white' : 'bg-amber-400'}`}></div>
              Pendientes
            </button>
            <button 
              onClick={() => setStatusFilter('CONFIRMED')}
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === 'CONFIRMED' ? 'bg-[#111] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'CONFIRMED' ? 'bg-white' : 'bg-gray-800'}`}></div>
              Pagados
            </button>
            <button 
              onClick={() => setStatusFilter('OTAS')}
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === 'OTAS' ? 'bg-[#C5A059] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'OTAS' ? 'bg-white' : 'bg-[#C5A059]'}`}></div>
              Agencias
            </button>
          </div>
          
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm shrink-0">
            <input 
              type="date" 
              className="text-[9px] border-none outline-none p-1 text-gray-500 bg-transparent"
              onChange={(e) => setFilterDates({...filterDates, start: e.target.value})}
            />
            <span className="text-gray-300 text-xs">-</span>
            <input 
              type="date" 
              className="text-[9px] border-none outline-none p-1 text-gray-500 bg-transparent"
              onChange={(e) => setFilterDates({...filterDates, end: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-[#111]">
            {viewMode === 'chart' ? 'Calendario de Ocupación' : 'Listado de Reservas Registradas'}
          </h3>
          {viewMode === 'chart' && (
            <button 
              onClick={() => setShowOnlyWithBookings(!showOnlyWithBookings)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[9px] font-black uppercase tracking-tighter ${
                showOnlyWithBookings 
                ? 'bg-[#111] text-white border-[#111] shadow-lg scale-105' 
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
              }`}
            >
              <i className={`fa-solid ${showOnlyWithBookings ? 'fa-filter' : 'fa-list'}`}></i>
              {showOnlyWithBookings ? 'SOLO CON RESERVA' : 'TODAS LAS HABITACIONES'}
            </button>
          )}
        </div>
        {viewMode === 'chart' && (
          <span className="text-[10px] font-bold text-[#C5A059] bg-[#C5A059]/5 px-3 py-1 rounded-full border border-[#C5A059]/20 hidden sm:block">
            Mostrando desde el {dates[0].toLocaleDateString('es', { day: 'numeric', month: 'long' })}
          </span>
        )}
      </div>
      
      {viewMode === 'chart' ? (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[800px]">
            {/* Header Dates */}
            <div className="flex border-b border-gray-100 pb-2 mb-4">
              <div className="w-32 flex-shrink-0 text-[10px] font-bold text-gray-400 tracking-wider uppercase pt-2">
                Habitación
              </div>
              <div className="flex flex-1">
                {dates.map((date, i) => (
                  <div key={i} className="flex-1 min-w-[40px] text-center border-l border-transparent">
                    <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{date.toLocaleDateString('es', { weekday: 'short' })}</div>
                    <div className={`text-xs font-bold mt-1 ${i === 0 ? 'text-[#C5A059]' : 'text-[#111]'}`}>{date.getDate()}</div>
                  </div>
                ))}
              </div>
            </div>

            {allRooms
              .filter(room => {
                if (!showOnlyWithBookings) return true;
                // Solo mostrar si tiene reservas QUE SE VEAN en el rango actual de 15 días
                const startRange = dates[0];
                const endRange = dates[dates.length - 1];
                return bookings.some(b => {
                  if (b.roomId !== room.id || b.status === 'CANCELLED') return false;
                  const bIn = new Date(b.checkIn);
                  const bOut = new Date(b.checkOut);
                  return bIn < endRange && bOut > startRange;
                });
              })
              .map(room => {
              // Filtrar reservas válidas para esta habitación Y que cumplan los filtros actuales
              const roomBookings = filteredBookings.filter(b => b.roomId === room.id && b.status !== 'CANCELLED');
              
              return (
                <div 
                  key={room.id} 
                  className="flex border-b border-gray-50 py-3 items-center group hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-32 flex-shrink-0">
                    <div className="text-sm font-bold text-[#111]">{room.number}</div>
                    <div className="text-[10px] text-gray-400">{room.roomType?.name}</div>
                  </div>
                  
                    <div className="flex flex-1 relative h-8 bg-gray-50/30 rounded-lg">
                      {/* Grid Drop Zones */}
                      {dates.map((date, i) => (
                        <div 
                          key={i} 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDrop(e, room, i)}
                          onDoubleClick={() => onOpenBookingModal({ 
                            roomId: room.id, 
                            checkIn: date.toISOString().split('T')[0],
                            checkOut: new Date(date.getTime() + 86400000).toISOString().split('T')[0],
                            totalPrice: room.roomType.basePrice
                          })}
                          className="flex-1 border-l border-white h-full z-0 hover:bg-[#C5A059]/10 transition-colors cursor-crosshair"
                          title="Doble clic para reservar"
                        ></div>
                      ))}
                    
                    {/* Booking Blocks */}
                    {roomBookings.map(booking => {
                      const checkIn = new Date(booking.checkIn);
                      checkIn.setHours(0,0,0,0);
                      const checkOut = new Date(booking.checkOut);
                      checkOut.setHours(0,0,0,0);
                      const startRange = dates[0];
                      startRange.setHours(0,0,0,0);
                      const endRange = dates[dates.length - 1];
                      endRange.setHours(0,0,0,0);

                      // Skip if completely out of bounds
                      if (checkOut < startRange || checkIn > endRange) return null;

                      // Calculate Box Position
                      const msPerDay = 1000 * 60 * 60 * 24;
                      
                      // Limitar visualmente a nuestra grilla
                      const visibleStart = checkIn < startRange ? startRange : checkIn;
                      const visibleEnd = checkOut > endRange ? endRange : checkOut;

                      const startOffsetDays = Math.round((visibleStart - startRange) / msPerDay);
                      const durationDays = Math.round((visibleEnd - visibleStart) / msPerDay);
                      
                      const leftPercent = (startOffsetDays / dates.length) * 100;
                      const widthPercent = (durationDays / dates.length) * 100;

                      let colorClass = 'bg-[#111]';
                      if (booking.source !== 'LOCAL') colorClass = 'bg-[#C5A059]'; // OTAs (Airbnb/Booking)
                      if (booking.status === 'PENDING') colorClass = 'bg-amber-400';

                      return (
                        <div 
                          key={booking.id}
                          draggable={!isResizing}
                          onDragStart={(e) => handleDragStart(e, booking)}
                                       onClick={() => {
                            if (!booking) return;
                            setSelectedBooking({ ...booking, roomNumber: room?.number });
                            setEditFormData({
                              roomId: booking.roomId,
                              checkIn: formatDateForInput(booking.checkIn),
                              checkOut: formatDateForInput(booking.checkOut)
                            });
                            setIsEditing(false); 
                          }}
                          className={`absolute top-1 bottom-1 rounded-md z-10 flex items-center px-2 text-[9px] font-bold text-white shadow-sm overflow-hidden backdrop-blur-sm cursor-pointer hover:scale-[1.01] transition-all group/booking ${colorClass}`}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          title={`${booking.guestName} (${booking.source})`}
                        >
                          <span className="truncate flex-1">{booking.guestName || booking.source}</span>
                          
                          {/* Resize Handle */}
                          {viewMode === 'chart' && (
                            <div 
                              onMouseDown={(e) => handleResizeStart(e, booking)}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/10 hover:bg-black/30 opacity-0 group-hover/booking:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <div className="w-[1px] h-3 bg-white/50"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {allRooms.length === 0 && (
              <div className="text-center py-10 text-xs text-gray-500">
                No hay habitaciones en el edificio actualmente.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA DE LISTA (ListView) */
        <div className="overflow-hidden border border-gray-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Huésped</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Habitación</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Fechas</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase text-center">Estado</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length > 0 ? (
                filteredBookings.slice().reverse().map(booking => (
                  <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="text-sm font-bold text-[#111]">{booking.guestName || 'Sin Nombre'}</div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {booking.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-semibold text-[#C5A059] bg-[#C5A059]/5 px-2 py-0.5 rounded inline-block">
                        {allRooms.find(r => r.id === booking.roomId)?.number || '??'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-[11px] font-medium text-[#111]">
                        {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                        booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button 
                        onClick={() => {
                          if (!booking) return;
                          const room = allRooms.find(r => r.id === booking.roomId);
                          setSelectedBooking({ ...booking, roomNumber: room?.number });
                          setEditFormData({
                            roomId: booking.roomId,
                            checkIn: formatDateForInput(booking.checkIn),
                            checkOut: formatDateForInput(booking.checkOut)
                          });
                          setIsEditing(false);
                        }}
                        className="p-2 text-gray-400 hover:text-[#111] transition-colors"
                      >
                        <i className="fa-solid fa-ellipsis-vertical text-lg"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-xs text-gray-400">
                    No se encontraron reservas con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="flex gap-4 mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#111]"></div><span className="text-[10px] text-gray-500 uppercase font-semibold">Web (Local)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#C5A059]"></div><span className="text-[10px] text-gray-500 uppercase font-semibold">Agencias (iCal)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div><span className="text-[10px] text-gray-500 uppercase font-semibold">Pendiente Pago</span></div>
      </div>

      {/* Modal de Detalles de Reserva (v11 - Blindado) */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-300">
            <div className={`p-6 border-b border-gray-100 flex justify-between items-center ${isEditing ? 'bg-blue-50' : 'bg-[#FAFAFA]'}`}>
              <div>
                <h4 className={`font-bold uppercase tracking-wider text-xs ${isEditing ? 'text-blue-600' : 'text-[#111]'}`}>
                  {isEditing ? 'Editando Reserva' : 'Detalles de la Reserva'}
                </h4>
                <div className="text-[8px] text-gray-400 font-mono mt-1 uppercase tracking-widest">ID: {selectedBooking?.id || 'N/A'}</div>
              </div>
              <button 
                onClick={() => { setSelectedBooking(null); setIsEditing(false); }}
                className="text-gray-400 hover:text-[#111] transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {isEditing ? (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Cambio de Habitación</label>
                    <select 
                      value={editFormData?.roomId || ''}
                      onChange={(e) => setEditFormData({...editFormData, roomId: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs"
                    >
                      {allRooms.map(r => <option key={r.id} value={r.id}>{r.number} ({r.roomType?.name || 'Habitación'})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Entrada</label>
                      <input 
                        type="date"
                        value={editFormData?.checkIn || ''}
                        onChange={(e) => setEditFormData({...editFormData, checkIn: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Salida</label>
                      <input 
                        type="date"
                        value={editFormData?.checkOut || ''}
                        onChange={(e) => setEditFormData({...editFormData, checkOut: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Huésped</label>
                    <div className="text-sm font-semibold text-[#111]">{selectedBooking.guestName || 'Sin nombre'}</div>
                    <div className="text-[10px] text-gray-500">{selectedBooking.guestEmail}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Entrada</label>
                      <div className="text-xs font-medium text-[#111]">
                        {selectedBooking?.checkIn ? new Date(selectedBooking.checkIn).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Salida</label>
                      <div className="text-xs font-medium text-[#111]">
                        {selectedBooking?.checkOut ? new Date(selectedBooking.checkOut).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Habitación</label>
                      <div className="text-xs font-bold text-[#C5A059]">{selectedBooking?.roomNumber || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Origen</label>
                      <div className="text-xs font-medium text-[#111] flex items-center gap-1">
                        {selectedBooking?.source === 'AIRBNB' && <i className="fa-brands fa-airbnb text-red-500 text-xs"></i>}
                        {selectedBooking?.source === 'BOOKING' && <i className="fa-solid fa-square-b text-blue-600 text-xs"></i>}
                        {selectedBooking?.source === 'LOCAL' && <i className="fa-solid fa-globe text-gray-400 text-xs"></i>}
                        {selectedBooking?.source || 'WEB'}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4">
                <div className={`text-center py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest ${
                  selectedBooking?.status === 'CONFIRMED' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  Estado: {selectedBooking?.status || 'PENDIENTE'}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-2">
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                {!isEditing && selectedBooking.status === 'PENDING' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'CONFIRMED')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-dollar-sign"></i> Confirmar Pago y Marcar como Pagado
                  </button>
                )}

                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex-1 ${isEditing ? 'bg-gray-200 text-gray-700' : 'bg-[#111] text-white'} py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95`}
                  >
                    {isEditing ? 'Cancelar Edición' : 'Modificar fechas / Habitación'}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-xl"
                  >
                    Cancelar Edición
                  </button>
                  <button 
                    onClick={handleUpdateManual}
                    className="flex-[2] py-3 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    Guardar Cambios
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => { setIsCancelling(true); }}
                    className="w-full py-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-red-100 transition-colors"
                  >
                    Eliminar / Cancelar Reserva
                  </button>
                </>
              )}
              <button 
                onClick={() => setSelectedBooking(null)}
                className="w-full py-3 bg-[#111] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#C5A059] transition-colors shadow-lg"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Movimiento (Drag & Drop) */}
      {confirmMove && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-arrows-up-down-left-right text-2xl"></i>
              </div>
              <h4 className="text-lg font-bold text-[#111] mb-2">¿Confirmar Movimiento?</h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-6">
                Vas a mover a <b>{confirmMove.booking.guestName}</b> a la habitación <b>{confirmMove.targetRoom.number}</b>.
              </p>

              <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3 text-sm border border-gray-100">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                  <span className="text-gray-500 text-[10px] uppercase font-bold">Habitación:</span>
                  <span className="font-bold text-[#111]">{confirmMove.targetRoom.number}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-1 text-left">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-gray-400 font-bold">Anterior</span>
                    <div className="text-[11px] text-gray-500 line-through">
                      {new Date(confirmMove.booking.checkIn).toLocaleDateString()} - {new Date(confirmMove.booking.checkOut).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="space-y-1 border-l border-gray-200 pl-4">
                    <span className="text-[9px] uppercase text-blue-500 font-bold tracking-tight">Nueva</span>
                    <div className="text-[11px] font-bold text-[#111]">
                      {new Date(confirmMove.newCheckIn).toLocaleDateString()} - {new Date(confirmMove.newCheckOut).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Diferencia:</span>
                  <span className={`text-[10px] font-bold ${priceDiff > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {priceDiff > 0 ? `+$${priceDiff.toFixed(2)}` : `-$${Math.abs(priceDiff).toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[#111]">
                  <span>Nuevo Total:</span>
                  <span>${confirmMove.newTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmMove(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeMove}
                  className="flex-1 py-3 bg-[#111] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#C5A059] transition-colors shadow-lg"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelación con Motivo */}
      {isCancelling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
              <h4 className="font-bold text-red-600 uppercase tracking-wider text-xs">Cancelar Reserva</h4>
              <button onClick={() => setIsCancelling(false)} className="text-gray-400 hover:text-red-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-[11px] text-gray-500">Por favor, selecciona el motivo de la cancelación para mantener tus estadísticas limpias.</p>
              
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Motivo Principal</label>
                <select 
                  value={cancelReasonId}
                  onChange={(e) => setCancelReasonId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 transition-colors"
                >
                  <option value="">Seleccionar motivo...</option>
                  {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {(cancelReasonId === 'Otro ' || cancelReasonId.includes('Otro')) && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Detalles adicionales</label>
                  <textarea 
                    value={cancelDetails}
                    onChange={(e) => setCancelDetails(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 h-24 resize-none"
                    placeholder="Escribe el motivo aquí..."
                  ></textarea>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2">
              <button 
                onClick={handleCancel}
                disabled={!cancelReasonId}
                className="w-full py-3 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TapeChart;
