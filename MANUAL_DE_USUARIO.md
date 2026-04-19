# 🏨 Manual de Usuario: Sistema HotelTriz

Bienvenido al ecosistema **HotelTriz**, una plataforma integral de gestión y venta directa para su hotel boutique. Este manual está diseñado para instruir tanto al personal del hotel como a los administradores sobre cómo utilizar el sistema en su día a día de manera óptima.

---

## 1. Acceso al Sistema

HotelTriz posee dos perfiles de vista (Frontend y Backend). Por seguridad y facilidad de prueba en la etapa de desarrollo actual, la plataforma incluye un conmutador (switch) en la parte inferior de la pantalla para cambiar entre modos:

- **CLIENTE**: Vista pública, el "Motor de Reservas" que ven sus huéspedes en línea.
- **STAFF**: Panel administrativo seguro para dueños y recepcionistas.

*(Nota: En la fase de producción, este botón desaparecerá y el panel de Staff estará protegido por contraseña).*

---

## 2. Flujo de Venta: Motor de Reservas (Vista CLIENTE)

El motor de reservas está diseñado bajo un estricto "Minimalismo de Lujo" para favorecer la conversión de ventas. 

1. **Búsqueda de Disponibilidad**: 
   - El cliente ingresa las fechas deseadas (Check-in / Check-out) y el número de huéspedes.
   - El algoritmo interno descarta todas las habitaciones ocupadas o bloqueadas (incluso aquellas de Airbnb/Booking) y muestra únicamente las piezas 100% libres, eliminando el riesgo de *overbooking*.
2. **Selección**: 
   - El huésped presiona la tarjeta de la habitación elegida.
3. **Upselling (Experiencias Extra)**: 
   - Opcionalmente, se pueden marcar servicios adicionales como "Desayuno a la cama" o "Masajes" que incrementan el Valor Promedio de la Reserva de forma automática.
4. **Pago y Confirmación (Stripe)**: 
   - Tras hacer clic en "Confirmar Reserva", el cliente es desviado de manera segura a la terminal bancaria de **Stripe**.
   - Stripe procesa la tarjeta de crédito bajo grado de cumplimiento PCI-DSS.
   - Todo intento fallido o abandonado será purgado, pero si es un pago exitoso, el sistema devuelve al huésped a su hotel virtual mostrando la pantalla de éxito. La reserva queda formalmente asegurada.

---

## 3. Gestión y Recepción (Panel de STAFF)

Haga clic en el botón "STAFF" situado en la barra inferior para entrar a la oficina virtual de dirección. Se divide en dos pestañas clave.

### 3.1 Panel de Control (Dashboard)
Aquí encontrará el pulso vital de los ingresos del negocio.
- **Métricas Superiores**: Permite leer en un abrir y cerrar de ojos los *Ingresos Totales*, la *Tasa de Ocupación* en tiempo real, y el *Volumen de Transacciones*.
- **Historial de Operaciones**: Una bitácora que enlista a todos sus clientes con lujo de detalle: nombres, fechas completas, precio final abonado y el **estado** del cargo (*Confirmed*, *Cancelled*, *Pending*).

### 3.2 Puente Multicanal (iCal Sync)
Esta es la función más poderosa de HotelTriz. Permite que el inventario del hotel trabaje en piloto automático sin miedo a reservas duplicadas originadas desde Booking o Airbnb.

- **¿Qué es Importar?**: Si le entra una reserva en Airbnb, pegue el enlace *.ics* que otorga Airbnb en la caja designada. Al darle "Guardar" y "Sincronizar", HotelTriz escudriñará todo ese inventario externo y bloqueará de manera fantasma las fechas en el sistema base; si alguien entra a `hoteltriz.com`, verá esas recámaras como ocupadas de forma inteligente.
- **¿Qué es Exportar?**: Copie el enlace largo generado por HotelTriz en la sección superior ("URL de Calendario de HotelTriz"). Diríjase al panel anfitrión de Booking / Airbnb y péguelo allí. Cada que alguien compre vía Stripe directo en su web, Airbnb se actualizará de igual manera restando la disponibilidad.

---

## 4. Gestión Estructural de la Consola Maestra (`HOTELTRIZ_TERMINAL.html`) 💻

Para los encargados de TI o el gerente general, el panel externo **HotelTriz Terminal** funge como la llave de encendido general.

- **START BOTH (Recomendado)**: Un clic levanta simultáneamente la Base de Datos con el Servidor Backend, y acto seguido la Interfaz Visual Moderna (React). Espere unos segundos de preparación.
- **Bases de Datos locales**: La información viaja velozmente porque el motor base es local (`dev.db`). No requiere internet para despachar a sistemas adyacentes o probar el front. 

---
> [!TIP]
> Recuerde en todo momento que *HotelTriz* es un sistema propio: cada transacción registrada bajo estado CONFIRMED que se vea en el lado de reservas implica una inyección directa del flujo de caja a sus finanzas sin comisión para agencias ni intermediarios (0% OTAs fees).

---

## 5. Pruebas de Pago (Modo Test) 💳

Mientras el sistema esté en modo de prueba, puede usar las siguientes credenciales en la pasarela de Stripe para simular pagos exitosos sin cargo real:
- **Número**: `4242 4242 4242 4242`
- **Fecha**: Cualquier fecha futura (ej. `12/26`)
- **CVC**: `123`
- **Código Postal**: `12345` (o cualquiera de 5 dígitos).

---

## 6. Cómo Actualizar la Web de Internet (DuckDNS) 🚀

Para que los cambios realizados en esta computadora se reflejen en su sitio real (`hoteltriz.duckdns.org`), siga estos 3 pasos en orden:

1. **GIT PUSH**: Sube los cambios a la nube.
2. **SERVER DEPLOY**: El servidor descarga los cambios y se reinicia solo.
3. **SEED REMOTO (Opcional)**: Si tras actualizar ve que no hay habitaciones, presione este botón para inyectar los datos base al servidor de internet.

contraseña de Admin: hoteltriz2026
contraseña de Staff: hoteltriz2026

