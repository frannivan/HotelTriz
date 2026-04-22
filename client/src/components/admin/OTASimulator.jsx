import React, { useState, useEffect } from 'react';
import axios from 'axios';

const OTASimulator = () => {
  const [activeTab, setActiveTab] = useState('BOOKING'); // BOOKING, AIRBNB
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  
  const [bookingData, setBookingData] = useState({
    guestName: '',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    roomId: ''
  });

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || '/api'}/admin/housekeeping`);
        setRooms(res.data);
        if (res.data.length > 0) {
          setBookingData(prev => ({ ...prev, roomId: res.data[0].id }));
        }
      } catch (err) {
        console.error("Error cargando habitaciones para simulador", err);
      }
    };
    fetchRooms();
  }, []);

  const handleSimulate = async () => {
    setLoading(true);
    setSuccess(null);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/admin/simulate-external-booking`, {
        ...bookingData,
        source: activeTab
      });
      setSuccess(`¡Éxito! La reserva de ${activeTab} se ha inyectado en HotelTriz.`);
      setLoading(false);
    } catch (err) {
      alert("Error en la simulación");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header del Simulador */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Laboratorio de OTAs</h1>
            <p className="text-sm text-gray-500 mt-1 uppercase font-bold tracking-widest">Entorno de Pruebas de Sincronización</p>
          </div>
          <button onClick={() => window.location.hash = ''} className="text-xs font-bold text-gray-400 hover:text-black uppercase">
            Cerrar Simulador
          </button>
        </div>

        {/* Switcher de Plataforma */}
        <div className="flex rounded-2xl overflow-hidden shadow-sm mb-8">
          <button 
            onClick={() => setActiveTab('BOOKING')}
            className={`flex-1 py-6 font-black text-center transition-all ${activeTab === 'BOOKING' ? 'bg-[#003580] text-white scale-105 z-10' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
          >
            <i className="fa-solid fa-hotel mr-2"></i> Booking.com Mockup
          </button>
          <button 
            onClick={() => setActiveTab('AIRBNB')}
            className={`flex-1 py-6 font-black text-center transition-all ${activeTab === 'AIRBNB' ? 'bg-[#FF385C] text-white scale-105 z-10' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
          >
            <i className="fa-solid fa-house-user mr-2"></i> Airbnb Mockup
          </button>
        </div>

        {/* Interfaz de Simulación de Reserva */}
        <div className={`bg-white rounded-3xl shadow-xl overflow-hidden border-t-8 ${activeTab === 'BOOKING' ? 'border-[#003580]' : 'border-[#FF385C]'}`}>
          
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-8">
              Simular Reserva desde {activeTab === 'BOOKING' ? 'Booking.com' : 'Airbnb'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              
              {/* Columna Izquierda: Datos del Huésped */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Nombre del Huésped (Ficticio)</label>
                  <input 
                    type="text" 
                    value={bookingData.guestName}
                    onChange={e => setBookingData({...bookingData, guestName: e.target.value})}
                    placeholder="Ej: John Doe"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Habitación a Bloquear</label>
                  <select 
                    value={bookingData.roomId}
                    onChange={e => setBookingData({...bookingData, roomId: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-sm font-bold"
                  >
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>Habitación #{room.number} ({room.roomType?.name})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Columna Derecha: Fechas */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Check-in</label>
                    <input 
                      type="date" 
                      value={bookingData.checkIn}
                      onChange={e => setBookingData({...bookingData, checkIn: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Check-out</label>
                    <input 
                      type="date" 
                      value={bookingData.checkOut}
                      onChange={e => setBookingData({...bookingData, checkOut: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 text-xs font-bold"
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                  <p className="text-[10px] text-yellow-800 leading-tight">
                    <i className="fa-solid fa-circle-info mr-2"></i>
                    Esta acción simula un "Webhook" de red. HotelTriz recibirá la información como si llegara por el cable de internet directamente desde los servidores de {activeTab}.
                  </p>
                </div>
              </div>

            </div>

            {success && (
              <div className="mb-8 p-4 bg-green-500 text-white rounded-2xl text-center font-bold text-sm animate-in fade-in zoom-in duration-300">
                <i className="fa-solid fa-check-circle mr-2"></i> {success}
              </div>
            )}

            <button 
              onClick={handleSimulate}
              disabled={loading || !bookingData.guestName}
              className={`w-full py-6 rounded-2xl text-white font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
                loading ? 'bg-gray-400' : (activeTab === 'BOOKING' ? 'bg-[#003580] hover:bg-[#002b66]' : 'bg-[#FF385C] hover:bg-[#e31c5f]')
              } disabled:opacity-50`}
            >
              {loading ? 'Sincronizando...' : `🚀 Lanzar Reserva de ${activeTab === 'BOOKING' ? 'Booking' : 'Airbnb'}`}
            </button>

          </div>

        </div>

        {/* Footer del Laboratorio */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-gray-400">
          <div className="p-6 border border-gray-200 rounded-3xl">
            <h4 className="text-[10px] font-black uppercase mb-2 tracking-widest text-gray-900">¿Qué probar?</h4>
            <ul className="text-xs space-y-2 leading-relaxed italic">
              <li>- Simula una entrada para HOY y ve al Dashboard.</li>
              <li>- Simula una salida para HOY y revisa Housekeeping.</li>
              <li>- Intenta reservar la misma habitación desde la web pública.</li>
            </ul>
          </div>
          <div className="p-6 border border-gray-200 rounded-3xl flex items-center justify-center text-center">
            <p className="text-[10px] font-black uppercase opacity-60">
              HotelTriz Developer Tools<br/>V 2.0 (Build Sim-OTA)
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OTASimulator;
