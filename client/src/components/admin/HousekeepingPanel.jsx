import React, { useState, useEffect } from 'react';
import { roomService } from '../../services/api';

const HousekeepingPanel = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await roomService.getHousekeepingTasks();
      // Filtrar y ordenar: primero las sucias, luego las que tienen salidas hoy, y al final las limpias
      
      const prioritizedTasks = data.sort((a, b) => {
        if (a.housekeepingStatus === 'DIRTY' && b.housekeepingStatus !== 'DIRTY') return -1;
        if (a.housekeepingStatus !== 'DIRTY' && b.housekeepingStatus === 'DIRTY') return 1;
        
        const aHasCheckout = a.bookings?.length > 0;
        const bHasCheckout = b.bookings?.length > 0;
        
        if (aHasCheckout && !bHasCheckout) return -1;
        if (!aHasCheckout && bHasCheckout) return 1;
        
        return 0;
      });

      setTasks(prioritizedTasks);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const changeStatus = async (id, status) => {
    try {
      await roomService.updateHousekeepingStatus(id, status);
      // Update local state without full reload
      setTasks(tasks.map(t => t.id === id ? { ...t, housekeepingStatus: status } : t));
    } catch (err) {
      alert("Error al actualizar la limpieza");
    }
  };

  if (loading) return <div className="p-10 text-center text-xs text-gray-500 uppercase tracking-widest font-semibold">Cargando Módulo de Limpieza...</div>;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-500">
      <div className="p-6 border-b border-gray-50 bg-[#FAFAFA] flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-[#111]">Tablero de Housekeeping</h3>
          <p className="text-xs text-gray-500 mt-1">Gestión diaria de limpieza y mantenimiento de habitaciones</p>
        </div>
        <button onClick={fetchTasks} className="p-2 text-gray-400 hover:text-[#111] transition-colors">
          <i className="fa-solid fa-rotate-right"></i>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50/50">
        {tasks.map(room => {
          const isDirty = room.housekeepingStatus === 'DIRTY';
          const isClean = room.housekeepingStatus === 'CLEAN';
          const isMaintenance = room.housekeepingStatus === 'IN_SERVICE';
          
          const departingBookings = room.bookings || [];
          const hasCheckout = departingBookings.length > 0;

          let cardBorder = 'border-gray-200';
          if (isDirty) cardBorder = 'border-red-400 border-2';
          if (isClean) cardBorder = 'border-green-400';
          if (isMaintenance) cardBorder = 'border-amber-400 border-2';

          return (
            <div key={room.id} className={`bg-white rounded-xl shadow-sm p-6 border ${cardBorder} transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-2xl font-bold text-[#111]">#{room.number}</h4>
                  <p className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
                    {room.roomType?.name}
                  </p>
                </div>
                
                {/* Badge de Estado Visual */}
                <div className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isClean ? 'bg-green-50 text-green-600' : 
                  isDirty ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {room.housekeepingStatus}
                </div>
              </div>

              {/* Alerta de Check-out */}
              {hasCheckout ? (
                <div className="mb-4 bg-orange-50 border border-orange-100 p-3 rounded-lg flex gap-3 items-start">
                  <i className="fa-solid fa-suitcase-rolling text-orange-400 mt-0.5"></i>
                  <div>
                    <p className="text-xs font-semibold text-orange-800">Check-out Hoy</p>
                    <p className="text-[10px] text-orange-600 mt-1 line-clamp-1">{departingBookings[0].guestName}</p>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 flex gap-3 items-center text-gray-400">
                  <i className="fa-solid fa-moon"></i>
                  <span className="text-xs font-medium text-gray-500">Sin salidas programadas hoy</span>
                </div>
              )}

              {/* Botonera de Acciones Rápida */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-50">
                <button 
                  onClick={() => changeStatus(room.id, 'CLEAN')}
                  disabled={isClean}
                  className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                    isClean ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#111] text-white hover:bg-green-600'
                  }`}
                >
                  <i className="fa-solid fa-broom mr-2"></i> Limpiar
                </button>
                <button 
                  onClick={() => changeStatus(room.id, 'DIRTY')}
                  disabled={isDirty}
                  className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                    isDirty ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border text-[#111] border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                  }`}
                >
                  <i className="fa-solid fa-ban mr-2"></i> Sucia
                </button>
              </div>

            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 text-xs font-semibold uppercase tracking-widest">
            No hay habitaciones en el sistema.
          </div>
        )}
      </div>
    </div>
  );
};

export default HousekeepingPanel;
