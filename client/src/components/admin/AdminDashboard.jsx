import React, { useState, useEffect } from 'react';
import { roomService } from '../../services/api';
import SyncSettings from './SyncSettings';
import TapeChart from './TapeChart';
import HousekeepingPanel from './HousekeepingPanel';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('bookings'); 
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsData = await roomService.getAdminStats();
      const bookingsData = await roomService.getAdminBookings();
      setStats(statsData);
      setBookings(bookingsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'CONFIRMED': return 'text-green-600 bg-green-50 border-green-100';
      case 'PENDING': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'CANCELLED': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400 font-semibold tracking-widest text-[10px] uppercase">Cargando...</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto bg-[#FAFAFA] min-h-screen">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-[#111]">Administración</h1>
          <div className="flex gap-6 mt-4 overflow-x-auto pb-2">
            <button 
              onClick={() => setActiveTab('bookings')} 
              className={`pb-2 text-[11px] font-semibold tracking-widest transition-all border-b-2 uppercase whitespace-nowrap ${activeTab === 'bookings' ? 'text-[#C5A059] border-[#C5A059]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              Reservas
            </button>
            <button 
              onClick={() => setActiveTab('calendar')} 
              className={`pb-2 text-[11px] font-semibold tracking-widest transition-all border-b-2 uppercase whitespace-nowrap ${activeTab === 'calendar' ? 'text-[#C5A059] border-[#C5A059]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              Calendario Gráfico
            </button>
            <button 
              onClick={() => setActiveTab('housekeeping')} 
              className={`pb-2 text-[11px] font-semibold tracking-widest transition-all border-b-2 uppercase whitespace-nowrap ${activeTab === 'housekeeping' ? 'text-[#C5A059] border-[#C5A059]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              Limpieza (Mucamas)
            </button>
            <button 
              onClick={() => setActiveTab('sync')} 
              className={`pb-2 text-[11px] font-semibold tracking-widest transition-all border-b-2 uppercase whitespace-nowrap ${activeTab === 'sync' ? 'text-[#C5A059] border-[#C5A059]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              Sincronización
            </button>
          </div>
        </div>
        <button onClick={fetchData} className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[11px] font-semibold tracking-wider text-[#111] uppercase shadow-sm">
          Refrescar
        </button>
      </div>

      {activeTab === 'bookings' && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Ingresos Totales</p>
              <h2 className="text-3xl font-bold text-[#111]">${stats?.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            </div>
            
            <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Ocupación</p>
              <h2 className="text-3xl font-bold text-[#111]">{stats?.occupancyRate?.toFixed(1)}%</h2>
              <p className="text-[10px] text-gray-500 mt-2 font-medium">
                {stats?.occupiedRooms} de {stats?.totalRooms} habitaciones
              </p>
            </div>

            <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Reservas</p>
              <h2 className="text-3xl font-bold text-[#111]">{stats?.totalBookings}</h2>
            </div>
          </div>

          {/* Bookings Table Refined */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-semibold text-[#111]">Historial de Reservas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider border-b border-gray-100 bg-white">
                    <th className="px-6 py-4">Huésped</th>
                    <th className="px-6 py-4">Fechas</th>
                    <th className="px-6 py-4">Habitación</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-[#111] text-sm">{booking.guestName}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{booking.guestEmail}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-medium text-[#111]">{new Date(booking.checkIn).toLocaleDateString()}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">al {new Date(booking.checkOut).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-semibold text-[#111]">{booking.room?.roomType?.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">ID: {booking.room?.number}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-semibold text-[#C5A059] text-sm">${booking.totalPrice.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookings.length === 0 && (
                <div className="p-16 text-center">
                  <div className="text-gray-400 font-semibold uppercase tracking-wider text-[11px]">No hay reservas</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'sync' && (
        <div className="max-w-3xl mx-auto">
          <SyncSettings />
        </div>
      )}

      {activeTab === 'calendar' && (
        <TapeChart />
      )}

      {activeTab === 'housekeeping' && (
        <HousekeepingPanel />
      )}
    </div>
  );
};

export default AdminDashboard;
