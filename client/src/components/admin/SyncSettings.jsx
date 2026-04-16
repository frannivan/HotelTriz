import React, { useState, useEffect } from 'react';
import { roomService } from '../../services/api';

const SyncSettings = () => {
  const [urls, setUrls] = useState({ airbnbIcalUrl: '', bookingIcalUrl: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [hotelId, setHotelId] = useState('');

  useEffect(() => {
    roomService.getAdminStats().then(data => {
      setUrls({
        airbnbIcalUrl: data.airbnbIcalUrl || '',
        bookingIcalUrl: data.bookingIcalUrl || ''
      });
      setHotelId('cm001'); // ID demo
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await roomService.updateSyncSettings(urls);
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Fallo al guardar la configuración.' });
    }
    setLoading(false);
  };

  const handleSyncNow = async () => {
    setLoading(true);
    try {
      const result = await roomService.triggerSync();
      const details = result.details.map(d => `${d.source}: ${d.newBlocks || d.error}`).join(' | ');
      setMessage({ type: 'success', text: `Sincronización: ${details}` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Fallo al disparar la sincronización.' });
    }
    setLoading(false);
  };

  const exportUrl = `${window.location.origin.replace('5173', '3001')}/api/public/calendar/${hotelId}.ics`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
        <h3 className="text-xl font-semibold text-[#111]">Opciones de Sincronización</h3>
        <span className="bg-gray-50 text-gray-500 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">iCal Sync</span>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Export Section */}
      <div className="mb-8 p-6 bg-[#FAFAFA] border border-gray-200 rounded-xl">
        <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-2 block">Copia esta URL en Airbnb / Booking</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            readOnly 
            value={exportUrl} 
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-mono text-gray-600 outline-none shadow-sm"
          />
          <button 
            onClick={() => { navigator.clipboard.writeText(exportUrl); alert('Copiado'); }}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 shadow-sm"
          >
            Copiar
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 font-medium">Esta URL permite que las OTAs vean sus reservas directas de HotelTriz.</p>
      </div>

      {/* Import Section */}
      <div className="space-y-5 mb-8">
        <div>
          <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-2 block">URL de Exportación de Airbnb</label>
          <input 
            type="text" 
            placeholder="https://www.airbnb.com/calendar/export/..." 
            value={urls.airbnbIcalUrl}
            onChange={(e) => setUrls({...urls, airbnbIcalUrl: e.target.value})}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none transition-all shadow-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-2 block">URL de Exportación de Booking.com</label>
          <input 
            type="text" 
            placeholder="https://admin.booking.com/hotel/..." 
            value={urls.bookingIcalUrl}
            onChange={(e) => setUrls({...urls, bookingIcalUrl: e.target.value})}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="flex-1 py-3 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-[#C5A059] transition-colors disabled:opacity-50 shadow-sm"
        >
          Guardar Configuración
        </button>
        <button 
          onClick={handleSyncNow}
          disabled={loading}
          className="px-6 py-3 bg-white border border-gray-200 text-[#111] text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Sincronizando...' : 'Sincronizar Ahora'}
        </button>
      </div>
    </div>
  );
};

export default SyncSettings;
