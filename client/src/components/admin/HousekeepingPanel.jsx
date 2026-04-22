import React, { useState, useEffect } from 'react';
import { roomService } from '../../services/api';

const HousekeepingPanel = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, ARRIVALS, DEPARTURES, DIRTY
  const [viewMode, setViewMode] = useState('grid'); // grid, list

  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await roomService.getHousekeepingTasks();
      
      // Lógica de Priorización:
      // 1. Habitación Sucia + Entrada Hoy (CRÍTICO)
      // 2. Habitación Sucia
      // 3. Habitación con Salida Hoy
      // 4. Limpias
      const sorted = data.sort((a, b) => {
        const aHasArrival = a.bookings?.some(b => isToday(b.checkIn));
        const bHasArrival = b.bookings?.some(b => isToday(b.checkIn));
        const aIsDirty = a.housekeepingStatus === 'DIRTY';
        const bIsDirty = b.housekeepingStatus === 'DIRTY';

        if ((aHasArrival && aIsDirty) && !(bHasArrival && bIsDirty)) return -1;
        if (!(aHasArrival && aIsDirty) && (bHasArrival && bIsDirty)) return 1;
        
        if (aIsDirty && !bIsDirty) return -1;
        if (!aIsDirty && bIsDirty) return 1;

        if (aHasArrival && !bHasArrival) return -1;
        if (!aHasArrival && bHasArrival) return 1;

        return 0;
      });

      setTasks(sorted);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const changeStatus = async (id, status, isGlobalStatusChange = false) => {
    try {
      if (isGlobalStatusChange) {
        // Cambiar estado global (AVAILABLE / MAINTENANCE)
        await roomService.updateRoomStatus(id, status);
        setTasks(tasks.map(t => t.id === id ? { ...t, status: status } : t));
      } else {
        // Cambiar estado de limpieza (CLEAN / DIRTY)
        await roomService.updateHousekeepingStatus(id, status);
        setTasks(tasks.map(t => t.id === id ? { ...t, housekeepingStatus: status } : t));
      }
    } catch (err) {
      alert("Error al actualizar la habitación");
    }
  };

  const filteredTasks = tasks.filter(room => {
    if (filter === 'ALL') return true;
    if (filter === 'DIRTY') return room.housekeepingStatus === 'DIRTY';
    if (filter === 'ARRIVALS') return room.bookings?.some(b => isToday(b.checkIn));
    if (filter === 'DEPARTURES') return room.bookings?.some(b => isToday(b.checkOut));
    return true;
  });

  if (loading) return <div className="p-10 text-center text-xs text-gray-500 uppercase tracking-widest font-semibold animate-pulse">Analizando Disponibilidad y Limpieza...</div>;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden min-h-screen lg:min-h-0">
      {/* HEADER ESTRATÉGICO */}
      <div className="p-6 border-b border-gray-50 bg-[#FAFAFA] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#111]">Operaciones de Limpieza</h3>
          <p className="text-xs text-gray-500 mt-1">Control de estado en tiempo real (Sincronizado con Reservas)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <i className="fa-solid fa-grip mr-1"></i> Cuadrícula
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <i className="fa-solid fa-list mr-1"></i> Lista
            </button>
          </div>
          <button onClick={fetchTasks} className="bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm text-xs font-bold uppercase transition-all hover:bg-gray-50 active:scale-95 text-[#111]">
            <i className="fa-solid fa-rotate-right mr-2"></i> Refrescar
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS RÁPIDOS */}
      <div className="p-4 bg-white border-b border-gray-50 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: 'Todas', icon: 'list' },
          { id: 'DIRTY', label: 'Necesitan Limpieza', icon: 'broom', color: 'text-red-600' },
          { id: 'ARRIVALS', label: 'Entradas Hoy', icon: 'plane-arrival', color: 'text-blue-600' },
          { id: 'DEPARTURES', label: 'Salidas Hoy', icon: 'plane-departure', color: 'text-orange-600' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
              filter === item.id 
              ? 'bg-[#111] text-white shadow-lg scale-105' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <i className={`fa-solid fa-${item.icon} ${filter === item.id ? 'text-white' : item.color}`}></i>
            {item.label}
          </button>
        ))}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50/30">
        {filteredTasks.map(room => {
          const isDirty = room.housekeepingStatus === 'DIRTY';
          const isClean = room.housekeepingStatus === 'CLEAN';
          const isMaintenance = room.housekeepingStatus === 'IN_SERVICE';
          
          const arrival = room.bookings?.find(b => isToday(b.checkIn));
          const departure = room.bookings?.find(b => isToday(b.checkOut));

          return (
            <div key={room.id} className={`bg-white rounded-2xl shadow-sm p-6 border-2 transition-all relative overflow-hidden ${
              isDirty ? (arrival ? 'border-red-500 ring-2 ring-red-100 animate-pulse-slow' : 'border-red-200') : 
              isClean ? 'border-green-200' : 'border-amber-200'
            }`}>
              
              {/* Indicadores de Movimiento Hoy */}
              <div className="flex gap-2 mb-4">
                {arrival && (
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                    <i className="fa-solid fa-star"></i> Check-in Hoy
                  </div>
                )}
                {departure && (
                  <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                    <i className="fa-solid fa-door-open"></i> Checkout Hoy
                  </div>
                )}
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-3xl font-black text-[#111]">#{room.number}</h4>
                  <p className="text-[10px] uppercase font-bold text-gray-400 mt-1">{room.roomType?.name}</p>
                </div>
                <div className="flex gap-2">
                  <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${room.housekeepingStatus === 'CLEAN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {room.housekeepingStatus === 'CLEAN' ? 'Limpia' : 'Sucia'}
                  </div>
                  {isMaintenance && (
                    <div className="text-[10px] font-black px-3 py-1 rounded-full bg-gray-900 text-white uppercase tracking-tighter flex items-center gap-1.5">
                      <i className="fa-solid fa-wrench"></i> OOS
                    </div>
                  )}
                </div>
              </div>

              {/* Información de Huéspedes */}
              <div className="space-y-3 mb-8">
                {arrival && (
                  <div className="flex items-center gap-3 text-blue-700">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <i className="fa-solid fa-user-plus text-xs"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-bold uppercase opacity-60">Próxima Entrada</p>
                      <p className="text-xs font-bold leading-tight line-clamp-1">{arrival.guestName}</p>
                    </div>
                  </div>
                )}
                {departure && (
                  <div className="flex items-center gap-3 text-orange-700">
                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                      <i className="fa-solid fa-user-minus text-xs"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-bold uppercase opacity-60">Salida Hoy</p>
                      <p className="text-xs font-bold leading-tight line-clamp-1">{departure.guestName}</p>
                    </div>
                  </div>
                )}
                {!arrival && !departure && (
                  <div className="py-4 text-center border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sin rotación hoy</p>
                  </div>
                )}
              </div>

              {/* BOTONES DE ACCIÓN GIGANTES PARA MÓVIL */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => changeStatus(room.id, 'CLEAN')}
                  disabled={isClean}
                  className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest transition-all ${
                    isClean 
                    ? 'bg-gray-50 text-gray-300 border border-gray-100' 
                    : 'bg-[#111] text-white hover:bg-green-600 shadow-lg active:scale-95'
                  }`}
                >
                  <i className="fa-solid fa-broom text-lg"></i>
                  {isClean ? 'Habitación Lista' : 'Marcar como Limpia'}
                </button>
                
                <button 
                  onClick={() => changeStatus(room.id, 'DIRTY')}
                  disabled={isDirty}
                  className={`w-full py-3 rounded-xl flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    isDirty 
                    ? 'opacity-40 bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-white border-2 border-red-500 text-red-600 hover:bg-red-50'
                  }`}
                >
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Solicitar Repase / Reportar Sucia
                </button>
              </div>

              {/* Marca de prioridad gerencial (Simulada si se solicita manualmente) */}
              {isDirty && !arrival && !departure && (
                <div className="absolute -right-8 -top-8 w-16 h-16 bg-red-500 rotate-45 flex items-end justify-center pb-1">
                  <i className="fa-solid fa-crown text-white text-[8px] -rotate-45"></i>
                </div>
              )}
            </div>
          );
        })}
        </div>
      ) : (
        /* MODO LISTA - TABLA DE OPERACIONES */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Habitación</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Movimiento Hoy</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filteredTasks.map(room => {
                const isDirty = room.housekeepingStatus === 'DIRTY';
                const isClean = room.housekeepingStatus === 'CLEAN';
                const arrival = room.bookings?.find(b => isToday(b.checkIn));
                const departure = room.bookings?.find(b => isToday(b.checkOut));

                return (
                  <tr key={room.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 ${isDirty ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-600'}`}>
                          {room.number}
                        </div>
                        <div>
                          <div className="text-xs font-black text-[#111]">{room.roomType?.name}</div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase">Piso {room.floor || 1}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${isClean ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isClean ? 'bg-green-600' : 'bg-red-600'} animate-pulse`}></div>
                        {isClean ? 'Limpia' : 'Sucia / Repase'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        {arrival && (
                          <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 flex items-center gap-2 w-fit">
                            <i className="fa-solid fa-plane-arrival text-[10px]"></i>
                            <span className="text-[9px] font-black uppercase tracking-tight">Entrada: {arrival.guestName.split(' ')[0]}</span>
                          </div>
                        )}
                        {departure && (
                          <div className="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg border border-orange-100 flex items-center gap-2 w-fit">
                            <i className="fa-solid fa-plane-departure text-[10px]"></i>
                            <span className="text-[9px] font-black uppercase tracking-tight">Salida: {departure.guestName.split(' ')[0]}</span>
                          </div>
                        )}
                        {!arrival && !departure && <span className="text-[10px] text-gray-300 font-bold uppercase">Sin rotación</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => changeStatus(room.id, 'DIRTY')}
                          disabled={isDirty}
                          className={`p-2.5 rounded-xl transition-all ${isDirty ? 'bg-gray-50 text-gray-300' : 'bg-white border-2 border-amber-400 text-amber-600 hover:bg-amber-50'}`}
                          title="Solicitar Repase"
                        >
                          <i className="fa-solid fa-hand-sparkles"></i>
                        </button>
                        <button 
                          onClick={() => changeStatus(room.id, 'CLEAN')}
                          disabled={isClean}
                          className={`p-2.5 rounded-xl transition-all ${isClean ? 'bg-gray-50 text-gray-300' : 'bg-[#111] text-white hover:bg-green-600 shadow-md transform active:scale-90'}`}
                          title="Marcar como Limpia"
                        >
                          <i className="fa-solid fa-check"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {filteredTasks.length === 0 && (
        <div className="p-20 text-center">
          <i className="fa-solid fa-inbox text-4xl text-gray-200 mb-4"></i>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No hay habitaciones en esta categoría</p>
        </div>
      )}
    </div>
  );
};

export default HousekeepingPanel;
