import React, { useState, useEffect } from 'react';
import { roomService } from '../../services/api';

const TapeChart = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generar próximos 14 días para el Gantt
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 15; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = generateDates();

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await roomService.getAdminBookings();
        setBookings(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching admin bookings:", error);
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  // Extraer habitaciones únicas de las reservas (modo simplificado para el demo)
  const rooms = [...new Map(bookings.map(b => [b.room?.number, b.room])).values()].filter(Boolean);

  if (loading) return <div className="p-10 text-center text-xs text-gray-500 uppercase tracking-widest font-semibold">Cargando Calendario...</div>;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden p-6 animate-in fade-in duration-500">
      <h3 className="text-lg font-semibold text-[#111] mb-6">Calendario de Ocupación (Próximos 15 días)</h3>
      
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

          {/* Room Rows */}
          {rooms.map(room => {
            // Filtrar reservas válidas para esta habitación
            const roomBookings = bookings.filter(b => b.roomId === room.id && b.status !== 'CANCELLED');
            
            return (
              <div key={room.id} className="flex border-b border-gray-50 py-3 items-center group hover:bg-gray-50/50 transition-colors">
                <div className="w-32 flex-shrink-0">
                  <div className="text-sm font-bold text-[#111]">{room.number}</div>
                  <div className="text-[10px] text-gray-400">ID: {room.roomType?.name?.substring(0,8)}</div>
                </div>
                
                <div className="flex flex-1 relative h-8 bg-gray-50/30 rounded-lg overflow-hidden">
                  {/* Grid Lines */}
                  {dates.map((_, i) => (
                    <div key={i} className="flex-1 border-l border-white h-full z-0"></div>
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
                        className={`absolute top-1 bottom-1 rounded-md z-10 flex items-center px-2 text-[9px] font-bold text-white shadow-sm overflow-hidden backdrop-blur-sm ${colorClass}`}
                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                        title={`${booking.guestName} (${booking.source})`}
                      >
                        <span className="truncate">{booking.guestName || booking.source}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {rooms.length === 0 && (
            <div className="text-center py-10 text-xs text-gray-500">
              No hay reservas activas para graficar.
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-4 mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#111]"></div><span className="text-[10px] text-gray-500 uppercase font-semibold">Web (Local)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#C5A059]"></div><span className="text-[10px] text-gray-500 uppercase font-semibold">Agencias (iCal)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div><span className="text-[10px] text-gray-500 uppercase font-semibold">Pendiente Pago</span></div>
      </div>
    </div>
  );
};

export default TapeChart;
