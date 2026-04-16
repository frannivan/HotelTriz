# 🛠️ Manual Técnico: HotelTriz (v1.0)

Este documento contiene todas las especificaciones técnicas para el desarrollo y mantenimiento de **HotelTriz**, el motor de reservas directas de alto rendimiento.

---

## 1. Stack Tecnológico (The Tech Stack)

| Capa | Tecnología | Razón de Elección |
| :--- | :--- | :--- |
| **Frontend** | React.js (Vite) | Velocidad de carga y ecosistema robusto. |
| **Backend** | Node.js (Express) | Escalabilidad y manejo eficiente de APIs. |
| **Estilado** | Tailwind CSS | Diseño "Premium" rápido y consistente. |
| **Base de Datos** | SQLite (Local) / Postgres (Supabase) | SQLite para desarrollo rápido local; Postgres para producción. |
| **ORM** | Prisma | Flexibilidad total para saltar entre SQLite y Postgres. |
| **Autenticación** | Supabase Auth | Seguridad de nivel industrial "Out of the box". |

---

## 2. Arquitectura del Proyecto (Monorepo)

```text
HotelTriz/
├── client/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/  # Componentes reutilizables
│   │   ├── pages/       # Vistas principales (Home, Booking, Admin)
│   │   ├── hooks/       # Lógica compartida
│   │   └── services/    # Llamadas a API y Supabase Client
├── server/              # Backend (Node.js + Express)
│   ├── src/
│   │   ├── controllers/ # Lógica de negocio
│   │   ├── routes/      # Endpoints de la API
│   │   └── middleware/  # Seguridad y validación
│   └── prisma/          # Esquema de DB y migraciones
├── MANUAL_TECNICO.md    # Este documento
└── PLAN_ESTRATEGICO.md  # Visión de negocio
```

---

## 3. Configuración de Supabase

Para que el sistema funcione, se requiere la siguiente configuración en el dashboard de Supabase:

### 3.1 Base de Datos (Tablas Críticas)
*   `hotels`: Configuración general de cada instancia.
*   `room_types`: Definición de tipos (Suite, Estándar, etc.).
*   `rooms`: Inventario físico de habitaciones.
*   `bookings`: Registro de reservas, fechas y estados.

### 3.2 Seguridad (RLS - Row Level Security)
Se deben activar políticas para que:
1.  **Clientes**: Solo puedan leer disponibilidad y crear reservas.
2.  **Staff**: Tenga acceso total a la gestión del hotel asignado.

### 3.3 Variables de Entorno (`.env`)
Para el desarrollo local (SQLite), Prisma usará un archivo local. Para cuando conectemos Supabase, necesitarás:

```env
# Ambiente Local (SQLite)
DATABASE_URL="file:./dev.db"

# Producción / Supabase (Postgres)
# DATABASE_URL="postgres://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Frontend
VITE_SUPABASE_URL="https://[YOUR_PROJECT_ID].supabase.co"
VITE_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
```

---

## 4. Estándares de Desarrollo

1.  **UI Premium**: Uso obligatorio de componentes de **Tailwind CSS**. Evitar colores planos sin contraste; preferir degradados sutiles, bordes redondeados y micro-interacciones.
2.  **Rendimiento**: Carga diferida (Lazy Loading) de imágenes de habitaciones para optimizar el SEO.
3.  **Seguridad**: Validaciones estrictas tanto en el frontend como en el backend para evitar sobre-reservas.

---

## 5. Guía de Inicio Rápido (Local)

1.  Clonar el repositorio.
2.  Ejecutar `npm install` en ambas carpetas (`client` y `server`).
3.  Ejecutar `npx prisma db push` para mapear la base local SQLite.
4.  Correr `npm run dev` en frontend y backend para iniciar el entorno.

---

## 6. Guía de Despliegue en Producción (Ubuntu / PM2)

Para entornos VPS (como AWS, DigitalOcean o locales), HotelTriz está optimizado para correr usando PM2, evitando sobrecarga de memoria en el servidor.

### Pasos de Instalación:

**1. Conexión SSH al Servidor**
```bash
ssh -i /ruta/a/tu/llave.pem ubuntu@DIRECCION_IP
```

**2. Descarga del Proyecto en el Home**
```bash
cd /home/ubuntu
git clone https://github.com/frannivan/HotelTriz.git
```

**3. Compilar Backend (Puerto 3031)**
```bash
cd /home/ubuntu/HotelTriz/server
npm install
npx prisma generate
npx prisma db push
```

**4. Compilar Frontend (Puerto 3030)**
```bash
cd /home/ubuntu/HotelTriz/client
npm install
npm run build
```

**5. Encendido Inmortal con PM2**
```bash
cd /home/ubuntu/HotelTriz
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
