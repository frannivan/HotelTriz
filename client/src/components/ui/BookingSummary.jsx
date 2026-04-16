import React from 'react';

const BookingSummary = ({ selectedRoom, selectedExtras, allExtras, searchData, onConfirm }) => {
  if (!selectedRoom) return null;

  const extras = allExtras.filter(e => selectedExtras.includes(e.id));
  
  const roomPrice = selectedRoom.basePrice;
  const extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
  const subtotal = roomPrice + extrasPrice;
  const tax = subtotal * 0.15; // IVA 15%
  const total = subtotal + tax;

  return (
    <div className="fixed bottom-0 right-0 m-6 w-[24rem] bg-white border border-gray-200 rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500 z-[100]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-[#111]">
          Su Estancia
        </h3>
        <span className="bg-[#FFFDF8] text-[#C5A059] border border-[#C5A059]/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Detalles</span>
      </div>

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

      <button 
        onClick={onConfirm}
        className="w-full py-4 bg-[#111] text-white rounded-xl font-medium text-sm outline-none transition-colors hover:bg-[#C5A059] flex items-center justify-center gap-2 group shadow-sm"
      >
        Confirmar Reserva
        <i className="fa-solid fa-chevron-right text-[10px] transition-transform group-hover:translate-x-1"></i>
      </button>
    </div>
  );
};

export default BookingSummary;
