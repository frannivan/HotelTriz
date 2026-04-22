import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

export const roomService = {
  getAll: async () => {
    const response = await api.post('/availability', { checkIn: new Date().toISOString(), checkOut: new Date(Date.now() + 86400000).toISOString(), guests: 1 });
    return response.data;
  },
  search: async (searchData) => {
    const response = await api.post('/availability', searchData);
    return response.data;
  },
  getExtras: async () => {
    const response = await api.get('/extra-services');
    return response.data;
  },
  createBooking: async (bookingData) => {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    // Devuelve el objeto completo que incluye { url: "...", booking: {...} }
    return response.json();
  },

  confirmPayment: async (sessionId, bookingId) => {
    const response = await fetch(`${API_URL}/payments/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, booking_id: bookingId }),
    });
    if (!response.ok) throw new Error('Error al confirmar el pago');
    return response.json();
  },
  // Métodos Administrativos (Fase 3 & Auth)
  createAdminBooking: async (bookingData) => {
    try {
      const response = await api.post('/admin/bookings/new', bookingData);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 409) {
        throw error.response.data; // Lanzar objeto de conflicto { error, conflictType }
      }
      throw new Error('Error de red al crear reserva');
    }
  },
  confirmAdminBooking: async (id) => {
    const response = await api.patch(`/admin/bookings/${id}/status`, { status: 'CONFIRMED' });
    return response.data;
  },
  loginAdmin: async (password) => {
    const response = await api.post('/admin/login', { password });
    return response.data;
  },
  getAdminStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
  getAdminBookings: async () => {
    const response = await api.get('/admin/bookings');
    return response.data;
  },
  // Gestión de estado general y limpieza
  updateRoomStatus: async (id, status) => {
    const response = await api.patch(`/admin/rooms/${id}`, { status });
    return response.data;
  },
  updateHousekeepingStatus: async (id, housekeepingStatus) => {
    const response = await api.patch(`/admin/rooms/${id}/housekeeping`, { housekeepingStatus });
    return response.data;
  },
  // Módulo Housekeeping (Limpieza)
  getHousekeepingTasks: async () => {
    const response = await api.get('/admin/housekeeping');
    return response.data;
  },
  // Gestión Profesional de Bloqueos Técnicos
  getMaintenanceBlocks: async () => {
    const response = await api.get('/admin/maintenance-blocks');
    return response.data;
  },
  createMaintenanceBlock: async (blockData) => {
    const response = await api.post('/admin/maintenance-blocks', blockData);
    return response.data;
  },
  updateMaintenanceBlock: async (id, blockData) => {
    const response = await api.patch(`/admin/maintenance-blocks/${id}`, blockData);
    return response.data;
  },
  deleteMaintenanceBlock: async (id) => {
    const response = await api.delete(`/admin/maintenance-blocks/${id}`);
    return response.data;
  },
  // Métodos de Sincronización (Fase 4)
  getSyncSettings: async () => {
    const response = await api.get('/admin/stats'); // Reutilizamos temporalmente para obtener el hotel inicial
    return response.data;
  },
  updateSyncSettings: async (settings) => {
    const response = await api.post('/admin/sync/settings', settings);
    return response.data;
  },
  triggerSync: async () => {
    const response = await api.post('/admin/sync/trigger');
    return response.data;
  },
  // Nuevos Métodos para Gestión de Reservas
  getCancellationReasons: async () => {
    const response = await api.get('/admin/cancellation-reasons');
    return response.data;
  },
  updateBookingPos: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/update-pos`, data);
    return response.data;
  },
  cancelBooking: async (id, data) => {
    const response = await api.post(`/admin/bookings/${id}/cancel`, data);
    return response.data;
  },
  updateBookingStatus: async (id, status) => {
    const response = await api.patch(`/admin/bookings/${id}/status`, { status });
    return response.data;
  }
};

export default api;
