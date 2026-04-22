import React, { useState } from 'react';
import { roomService } from '../../services/api';

const MaintenanceBlockModal = ({ isOpen, onClose, allRooms, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    roomId: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = !!(initialData && initialData.id);

  React.useEffect(() => {
    if (initialData && isOpen) {
      // Normalización inteligente de fechas
      const start = initialData.startDate || initialData.checkIn;
      const end = initialData.endDate || initialData.checkOut;

      setFormData({
        roomId: initialData.roomId || '',
        reason: initialData.reason || '',
        startDate: start ? new Date(start).toISOString().split('T')[0] : '',
        endDate: end ? new Date(end).toISOString().split('T')[0] : ''
      });
    } else if (!isOpen) {
      setFormData({ startDate: '', endDate: '', roomId: '', reason: '' });
      setError(null);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await roomService.updateMaintenanceBlock(initialData.id, formData);
      } else {
        await roomService.createMaintenanceBlock(formData);
      }
      setLoading(false);
      onSuccess();
    } catch (err) {
      setLoading(false);
      const serverError = err.response?.data?.error;
      const status = err.response?.status;
      setError(serverError || `Error ${status}: El servidor no pudo procesar la solicitud`);
      console.error('Submit Error:', err.response?.data || err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas liberar esta habitación y eliminar el bloqueo técnico?')) return;
    
    setLoading(true);
    try {
      await roomService.deleteMaintenanceBlock(initialData.id);
      setLoading(false);
      onSuccess();
    } catch (err) {
      setLoading(true);
      setError('Error al eliminar el bloqueo');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#111]/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border-4 border-red-500/20 animate-in zoom-in duration-300">
        
        {/* Header con estilo de advertencia */}
        <div className={`p-6 ${isEditing ? 'bg-gray-800' : 'bg-red-600'} text-white flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <i className={`fa-solid ${isEditing ? 'fa-pen-to-square' : 'fa-screwdriver-wrench'} text-xl`}></i>
            <h2 className="text-xl font-black uppercase tracking-tighter">
              {isEditing ? 'Gestionar Bloqueo' : 'Bloqueo de Mantenimiento'}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div className={`${isEditing ? 'bg-gray-50 border-gray-100 text-gray-600' : 'bg-red-50 border-red-100 text-red-800'} p-4 rounded-2xl border flex gap-4 items-start`}>
            <i className={`fa-solid ${isEditing ? 'fa-circle-info text-gray-400' : 'fa-triangle-exclamation text-red-600'} mt-1`}></i>
            <p className="text-[11px] font-medium leading-relaxed">
              {isEditing 
                ? "Puedes modificar las fechas del bloqueo o liberar la habitación para volver a ponerla a la venta."
                : "Este bloqueo inhabilitará la habitación para la venta pública. No afectará las métricas de ingresos."}
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Habitación</label>
            <select 
              required 
              disabled={isEditing}
              value={formData.roomId} 
              onChange={e => setFormData({...formData, roomId: e.target.value})} 
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-[#111] outline-none focus:border-red-500 transition-all appearance-none disabled:opacity-50"
            >
              <option value="">-- Seleccionar Habitación --</option>
              {allRooms.map(room => (
                <option key={room.id} value={room.id}>#{room.number} - {room.roomType?.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Inicio</label>
              <input 
                type="date" 
                required 
                value={formData.startDate} 
                onChange={e => setFormData({...formData, startDate: e.target.value})} 
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-[#111] outline-none focus:border-red-500 transition-all" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Fin</label>
              <input 
                type="date" 
                required 
                value={formData.endDate} 
                onChange={e => setFormData({...formData, endDate: e.target.value})} 
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-[#111] outline-none focus:border-red-500 transition-all" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Motivo / Descripción</label>
            <textarea 
              required
              rows="3"
              value={formData.reason} 
              onChange={e => setFormData({...formData, reason: e.target.value})} 
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-[#111] outline-none focus:border-red-500 transition-all resize-none" 
              placeholder="Ej: Fuga de agua, Pintura, Aire acondicionado dañado..."
            ></textarea>
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-lg text-center animate-pulse">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <button 
              type="submit" 
              disabled={loading} 
              className={`w-full py-4 ${isEditing ? 'bg-gray-800 hover:bg-[#111]' : 'bg-red-600 hover:bg-red-700'} text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <i className={`fa-solid ${isEditing ? 'fa-floppy-disk' : 'fa-lock'}`}></i>
                  {isEditing ? 'Guardar Cambios' : 'Confirmar Bloqueo Técnico'}
                </>
              )}
            </button>

            {isEditing && (
              <button 
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="w-full py-4 bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <i className="fa-solid fa-unlock"></i>
                Liberar Habitación
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaintenanceBlockModal;
