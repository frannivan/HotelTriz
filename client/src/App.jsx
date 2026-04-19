import React, { useState, useEffect } from 'react';
import { roomService } from './services/api';
import RoomCard from './components/ui/RoomCard';
import BookingSummary from './components/ui/BookingSummary';
import AdminDashboard from './components/admin/AdminDashboard';

function App() {
  const [view, setView] = useState('client'); 
  const [roomTypes, setRoomTypes] = useState([]);
  const [allExtras, setAllExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [showExtras, setShowExtras] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);

  const [search, setSearch] = useState({
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    guests: 1
  });

  const fetchRooms = async (searchData = search) => {
    setLoading(true);
    try {
      const data = await roomService.search(searchData);
      setRoomTypes(data);
      setLoading(false);
    } catch (err) {
      setError('No se pudieron cargar las habitaciones.');
      setLoading(false);
    }
  };

  const fetchExtras = async () => {
    try {
      const data = await roomService.getExtras();
      setAllExtras(data);
    } catch (err) {
      console.error('Error fetching extras:', err);
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('hotelTrizAdminAuth') === 'true'
  );
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const sessionId = params.get('session_id');
    const bookingId = params.get('booking_id');
    const cancelled = params.get('payment_cancelled');

    if (sessionId && bookingId) {
      setLoading(true);
      roomService.confirmPayment(sessionId, bookingId)
        .then(() => {
          setBookingStatus('success');
          setLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(() => {
          setBookingStatus('error');
          setLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (cancelled) {
      setBookingStatus('cancelled');
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchRooms();
      fetchExtras();
    } else {
      fetchRooms();
      fetchExtras();
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRooms(search);
    setSelectedRoom(null);
    setSelectedExtras([]);
  };

  const toggleExtra = (id) => {
    setSelectedExtras(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const confirmBooking = async (formData) => {
    const subtotal = selectedRoom.basePrice + allExtras.filter(e => selectedExtras.includes(e.id)).reduce((sum, e) => sum + e.price, 0);
    const total = subtotal * 1.15;

    setLoading(true);
    try {
      const payload = {
        guestName: formData.guestName,
        guestEmail: formData.guestEmail,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        roomId: selectedRoom.rooms[0].id,
        extraServices: selectedExtras,
        totalPrice: total
      };

      // Si tenemos endpoints backend especiales para admin vs public, usamos el de reservas publicas.
      // Aquí estamos llamando a roomService.createBooking que hace el POST.
      const res = await roomService.createBooking(payload);
      
      if (res.url) {
        // Redirigir a Stripe Checkout
        window.location.href = res.url;
      } else {
        setBookingStatus('success');
        setLoading(false);
        setSelectedRoom(null);
        setSelectedExtras([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error de conexión. La habitación ya no está disponible.');
      setLoading(false);
    }
  };

  if (bookingStatus === 'success') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#111] flex items-center justify-center p-6 text-center">
        <div className="max-w-md animate-in zoom-in duration-700 bg-white p-10 border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-[#C5A059] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#C5A059]/30">
            <i className="fa-solid fa-check text-2xl text-white"></i>
          </div>
          <h1 className="text-2xl font-bold mb-3 tracking-tight">¡Reserva Confirmada!</h1>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            Hemos recibido su pago correctamente. Los detalles de su estancia han sido enviados a su correo electrónico. ¡Le esperamos!
          </p>
          <button 
            onClick={() => { setBookingStatus(null); setView('client'); }}
            className="px-6 py-3 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-[#C5A059] transition-colors shadow-md"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  if (bookingStatus === 'error' || bookingStatus === 'cancelled') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#111] flex items-center justify-center p-6 text-center">
        <div className="max-w-md animate-in zoom-in duration-700 bg-white p-10 border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-xmark text-2xl text-red-600"></i>
          </div>
          <h1 className="text-2xl font-bold mb-3 tracking-tight">
            {bookingStatus === 'cancelled' ? 'Pago Cancelado' : 'Error en el Pago'}
          </h1>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            {bookingStatus === 'cancelled' ? 'Ha cancelado el proceso de pago. La reserva no ha sido confirmada.' : 'No hemos podido verificar su pago con Stripe. Por favor intente de nuevo.'}
          </p>
          <button 
            onClick={() => { setBookingStatus(null); setView('client'); }}
            className="px-6 py-3 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-[#C5A059] transition-colors shadow-md"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full animate-in zoom-in duration-500 bg-white p-8 border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-12 h-12 bg-[#111] rounded-xl flex items-center justify-center mx-auto mb-6 shadow-md">
            <i className="fa-solid fa-lock text-white text-lg"></i>
          </div>
          <h1 className="text-xl font-bold mb-2 tracking-tight text-[#111]">Acceso Administrativo</h1>
          <p className="text-gray-500 text-xs mb-6">Ingrese su contraseña maestra para continuar</p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const res = await roomService.loginAdmin(password);
              if (res.token) {
                localStorage.setItem('hotelTrizAdminAuth', 'true');
                setIsAuthenticated(true);
                setView('admin');
              }
            } catch (err) {
              setLoginError('Contraseña incorrecta');
            }
            setLoading(false);
          }}>
            <input 
              type="password" 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#111] outline-none focus:border-[#C5A059] mb-4 text-center tracking-[0.5em]"
              placeholder="••••••••"
              autoFocus
            />
            {loginError && <p className="text-red-500 text-[10px] uppercase font-bold tracking-wider mb-4">{loginError}</p>}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#111] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#C5A059] transition-colors"
            >
              {loading ? 'Verificando...' : 'Desbloquear'}
            </button>
            <button 
              type="button"
              onClick={() => setView('client')}
              className="mt-6 text-[10px] font-bold text-gray-400 hover:text-[#111] uppercase tracking-wider"
            >
              Volver a la Web
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111] font-sans selection:bg-[#C5A059]/30 pb-20">


      {view === 'admin' ? (
        <AdminDashboard />
      ) : (
        <>
          {/* Navbar Modern */}
          <nav className="relative w-full z-50 border-b border-gray-100 bg-white">
            <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold tracking-tight text-[#111]">HOTEL<span className="text-[#C5A059]">TRIZ</span></span>
              </div>
              
              <div className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-widest text-gray-500 uppercase">
                <a href="#habitaciones" className="hover:text-[#C5A059] transition-colors">Habitaciones</a>
                <a href="#servicios" className="hover:text-[#C5A059] transition-colors">Servicios</a>
                <button onClick={() => document.getElementById('habitaciones').scrollIntoView({ behavior: 'smooth' })} className="bg-[#111] text-white px-6 py-2.5 rounded-md hover:bg-[#C5A059] transition-colors shadow-sm">
                  RESERVAR
                </button>
              </div>
            </div>
          </nav>

          {/* Hero Section Refined */}
          <header className="relative pt-24 pb-16 bg-white border-b border-gray-100">
            <div className="max-w-6xl mx-auto px-6 text-center">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-8 text-[#111]">
                Una experiencia inolvidable.
              </h1>
              
              <div className="max-w-4xl mx-auto p-2 bg-white border border-gray-200/60 rounded-2xl shadow-sm">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
                  <div className="flex-1 w-full grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-start px-5 py-3 hover:bg-gray-50 rounded-xl transition-colors">
                      <label className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Entrada</label>
                      <input type="date" className="bg-transparent border-none outline-none text-[#111] w-full text-sm font-medium" value={search.checkIn} onChange={(e) => setSearch({...search, checkIn: e.target.value})} />
                    </div>
                    <div className="flex flex-col items-start px-5 py-3 hover:bg-gray-50 rounded-xl transition-colors border-l border-gray-100">
                      <label className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Salida</label>
                      <input type="date" className="bg-transparent border-none outline-none text-[#111] w-full text-sm font-medium" value={search.checkOut} onChange={(e) => setSearch({...search, checkOut: e.target.value})} />
                    </div>
                  </div>
                  <div className="w-full md:w-32 flex flex-col items-start px-5 py-3 hover:bg-gray-50 rounded-xl transition-colors border-l border-gray-100">
                    <label className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Huéspedes</label>
                    <select className="bg-transparent border-none outline-none text-[#111] w-full text-sm font-medium" value={search.guests} onChange={(e) => setSearch({...search, guests: e.target.value})}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full md:w-auto px-8 py-4 bg-[#C5A059] rounded-xl font-medium text-white text-sm uppercase tracking-wider hover:bg-[#B38D46] transition-colors shadow-sm">
                    Buscar
                  </button>
                </form>
              </div>
            </div>
          </header>

          {/* Grid de Habitaciones */}
          <section id="habitaciones" className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-10">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-semibold tracking-tight text-[#111]">Habitaciones Disponibles</h2>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-4 py-1.5 rounded-md">{roomTypes.length} resultados</span>
              </div>
              
              {loading ? (
                <div className="space-y-6">
                  {[1, 2].map(i => <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {roomTypes.map(roomType => (
                    <div key={roomType.id} onClick={() => { setSelectedRoom(roomType); setShowExtras(true); }} className={`cursor-pointer transition-all duration-300 rounded-2xl ${selectedRoom?.id === roomType.id ? 'ring-2 ring-[#C5A059] p-1 shadow-md bg-white' : ''}`}>
                      <RoomCard roomType={roomType} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel de Extras Rediseñado */}
            <div id="servicios" className="space-y-8">
              <h3 className="text-xl font-semibold tracking-tight text-[#111] border-b border-gray-200 pb-4">Añadir Servicios</h3>
              <div className="space-y-4">
                {allExtras.map(extra => (
                  <div 
                    key={extra.id} 
                    onClick={() => toggleExtra(extra.id)}
                    className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${selectedExtras.includes(extra.id) ? 'bg-[#FFFDF8] border-[#C5A059] shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-[15px]">{extra.name}</h4>
                      <span className="text-[#C5A059] font-medium text-sm">${extra.price}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{extra.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {selectedRoom && (
            <BookingSummary 
              selectedRoom={selectedRoom}
              selectedExtras={selectedExtras}
              allExtras={allExtras}
              searchData={search}
              onConfirm={confirmBooking}
              onClose={() => setSelectedRoom(null)}
            />
          )}

          {/* Footer with Hidden Admin Login Trigger */}
          <footer className="max-w-6xl mx-auto px-6 mt-16 pt-8 border-t border-gray-200 pb-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400">
            <p>© {new Date().getFullYear()} HotelTriz. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-[#C5A059] transition-colors">Términos</a>
              <a href="#" className="hover:text-[#C5A059] transition-colors">Privacidad</a>
              {/* Candado secreto */}
              <button onClick={() => isAuthenticated ? setView('admin') : setView('login')} className="text-gray-200 hover:text-gray-400 transition-colors ml-4 outline-none">
                <i className="fa-solid fa-lock text-[10px]"></i>
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
