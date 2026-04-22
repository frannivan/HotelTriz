import React, { useState } from 'react';
import { roomService } from '../../services/api';

const ManualBookingModal = ({ isOpen, onClose, allRooms, onSuccess, initialData, onSwitchToMaintenance }) => {
  const [formData, setFormData] = useState({
    guestName: '',
    checkIn: '',
    checkOut: '',
    roomId: '',
    totalPrice: ''
  });
  const [loading, setLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Pre-llenar si viene información del calendario
  React.useEffect(() => {
    if (initialData && isOpen) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        // Asegurar que las fechas estén en formato YYYY-MM-DD para el input type="date"
        checkIn: initialData.checkIn ? new Date(initialData.checkIn).toISOString().split('T')[0] : '',
        checkOut: initialData.checkOut ? new Date(initialData.checkOut).toISOString().split('T')[0] : ''
      }));
    } else if (!isOpen) {
      // Limpiar al cerrar
      setFormData({ guestName: '', checkIn: '', checkOut: '', roomId: '', totalPrice: '' });
      setConflictError(null);
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e, force = false) => {
    e.preventDefault();
    setLoading(true);
    setConflictError(null);

    try {
      await roomService.createAdminBooking({
        ...formData,
        status: 'CONFIRMED',
        force
      });
      setLoading(false);
      onSuccess(); // Cierra el modal y refresca
    } catch (err) {
      setLoading(false);
      const errorMsg = err.response?.data?.error || err.message;
      if (err.response?.data?.conflictType) {
        setConflictError(errorMsg);
      } else {
        alert(errorMsg || 'Error al procesar reserva');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#111]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-300">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-[#FAFAFA]">
          <h2 className="text-xl font-bold text-[#111] tracking-tight">Gestión de Habitación</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Selector Izquierda/Derecha (Pills Style) */}
        <div className="px-6 pt-6">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              type="button"
              className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-white text-[#111] shadow-sm transition-all"
            >
              Reserva Local
            </button>
            <button 
              type="button"
              onClick={() => onSwitchToMaintenance && onSwitchToMaintenance(formData)}
              className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg text-gray-400 hover:text-red-600 transition-all"
            >
              Bloqueo Técnico
            </button>
          </div>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre del Huésped</label>
            <input type="text" required value={formData.guestName} onChange={e => setFormData({...formData, guestName: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-[#111] outline-none focus:border-[#C5A059]" placeholder="Ej. Juan Pérez" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Check-in</label>
              <input type="date" required value={formData.checkIn} onChange={e => setFormData({...formData, checkIn: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-[#111] outline-none focus:border-[#C5A059]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Check-out</label>
              <input type="date" required value={formData.checkOut} onChange={e => setFormData({...formData, checkOut: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-[#111] outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Habitación</label>
              <select required value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#111] outline-none focus:border-[#C5A059]">
                <option value="">-- Seleccionar --</option>
                {allRooms.map(room => (
                  <option key={room.id} value={room.id}>{room.number} ({room.roomType?.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Precio Total ($)</label>
              <input type="number" required min="0" step="0.01" value={formData.totalPrice} onChange={e => setFormData({...formData, totalPrice: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-[#111] outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          {conflictError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
              <p className="text-red-700 text-xs font-medium leading-relaxed mb-3">
                {conflictError}
              </p>
              <button 
                type="button" 
                onClick={(e) => handleSubmit(e, true)}
                className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Ignorar Colisión y Forzar Reserva'}
              </button>
            </div>
          )}

          {!conflictError && (
            <div className="pt-4">
              <button type="submit" disabled={loading} className="w-full py-4 bg-[#111] hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="fa-solid fa-check"></i>}
                Crear Reserva Local
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ManualBookingModal;
