import React from 'react';

const RoomCard = ({ roomType }) => {
  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#C5A059]/30 hover:shadow-lg h-full flex flex-col">
      {/* Badge de Precio */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm border border-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
        <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider block leading-3">Desde</span>
        <span className="text-lg font-bold text-[#111]">${roomType.basePrice}</span>
      </div>

      {/* Imagen sin gradiente oscuro */}
      <div className="relative h-56 overflow-hidden bg-gray-100">
        <img 
          src={roomType.imageUrl || 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&q=80&w=800'} 
          alt={roomType.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      {/* Contenido */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-semibold mb-2 text-[#111] transition-colors group-hover:text-[#C5A059]">
          {roomType.name}
        </h3>
        
        <p className="text-gray-500 text-xs leading-relaxed mb-6 line-clamp-2 flex-grow">
          {roomType.description}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-gray-500">
              <i className="fa-solid fa-user-group text-[10px] text-[#C5A059]"></i>
              <span className="text-[11px] font-semibold uppercase">x{roomType.capacity}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <i className="fa-solid fa-wifi text-[10px] text-[#C5A059]"></i>
              <span className="text-[11px] font-semibold uppercase">WiFi</span>
            </div>
          </div>
          
          <button className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#111] group-hover:text-[#C5A059] transition-all">
            Detalles <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
