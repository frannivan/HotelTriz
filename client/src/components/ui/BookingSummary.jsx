import React, { useState } from 'react';

const BookingSummary = ({ selectedRoom, selectedExtras, allExtras, searchData, onConfirm, onClose }) => {
  const [formData, setFormData] = useState({ guestName: '', guestEmail: '' });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!selectedRoom) return null;

  const extras = allExtras.filter(e => selectedExtras.includes(e.id));
  
  const roomPrice = selectedRoom.basePrice;
  const extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
  const subtotal = roomPrice + extrasPrice;
  const tax = subtotal * 0.15; // IVA 15%
  const total = subtotal + tax;

  const handleConfirmClick = (e) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      setLoading(true);
      onConfirm(formData);
    }
  };

  return (
    <div className="fixed bottom-0 right-0 m-6 w-[24rem] bg-white border border-gray-200 rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500 z-[100]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-[#111]">
          {step === 1 ? 'Su Estancia' : 'Tus Datos'}
        </h3>
        <div className="flex items-center gap-2">
          <span className="bg-[#FFFDF8] text-[#C5A059] border border-[#C5A059]/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Paso {step} de 2
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      {step === 1 ? (
        <>
          <div className="space-y-4 mb-6 border-b border-gray-100 pb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider">Alojamiento</span>
              <span className="font-semibold text-[#111] text-sm">{selectedRoom.name}</span>
            </div>
            <div className="flex justify-between items-center text-right">
              <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider">Periodo</span>
              <div>
                <span className="font-semibold text-[#111] text-xs block">{searchData.checkIn}</span>
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">al {searchData.checkOut}</span>
              </div>
            </div>
            
            {extras.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] uppercase font-semibold text-[#C5A059] tracking-wider block mb-2 border-b border-gray-50 pb-1">Servicios Añadidos</span>
                {extras.map(e => (
                  <div key={e.id} className="flex justify-between items-center mb-1.5">
                    <span className="text-gray-600 text-xs font-medium">+ {e.name}</span>
                    <span className="text-[#111] font-semibold text-xs">${e.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 mb-8">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500 font-semibold uppercase tracking-wider">Subtotal</span>
              <span className="text-[#111] font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500 font-semibold uppercase tracking-wider">Impuestos (15%)</span>
              <span className="text-[#111] font-semibold">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-4 mt-2 border-t border-gray-100">
              <span className="text-[#111] font-semibold text-sm uppercase tracking-wider">Total Final</span>
              <span className="text-2xl font-bold text-[#C5A059]">${total.toFixed(2)}</span>
            </div>
          </div>
        </>
      ) : (
        <form id="guest-form" onSubmit={handleConfirmClick} className="space-y-4 mb-8">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre Completo</label>
            <input 
              type="text" 
              required 
              value={formData.guestName} 
              onChange={e => setFormData({...formData, guestName: e.target.value})} 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#111] outline-none focus:border-[#C5A059] transition-colors" 
              placeholder="Ej. Juan Pérez" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              required 
              value={formData.guestEmail} 
              onChange={e => setFormData({...formData, guestEmail: e.target.value})} 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#111] outline-none focus:border-[#C5A059] transition-colors" 
              placeholder="correo@ejemplo.com" 
            />
          </div>
          <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            * El pago no se realizará en línea en este momento. Deberá liquidar su reserva directamente en recepción el día de su llegada.
          </p>
        </form>
      )}

      <div className="flex gap-2">
        {step === 2 && (
          <button 
            type="button"
            onClick={() => setStep(1)}
            disabled={loading}
            className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-50 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
          </button>
        )}
        <button 
          form={step === 2 ? "guest-form" : undefined}
          type={step === 2 ? "submit" : "button"}
          onClick={step === 1 ? handleConfirmClick : undefined}
          disabled={loading}
          className="flex-1 py-4 bg-[#111] text-white rounded-xl font-medium text-sm outline-none transition-colors hover:bg-[#C5A059] flex items-center justify-center gap-2 group shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : step === 1 ? (
            <>Continuar <i className="fa-solid fa-chevron-right text-[10px] transition-transform group-hover:translate-x-1"></i></>
          ) : (
            <>Finalizar Reserva</>
          )}
        </button>
      </div>
    </div>
  );
};

export default BookingSummary;
