# 🚀 Despliegue de HotelTriz en Ubuntu (VPS)

Este documento contiene los comandos exactos que debes copiar y pegar en la terminal de tu servidor Ubuntu para poner el hotel en vivo.

## PASO 1: Descargar el Código desde Github
Conéctate por SSH a tu servidor Ubuntu y ejecuta esto para bajar tu repositorio privado:
```bash
git clone https://github.com/frannivan/HotelTriz.git
cd HotelTriz
```

## PASO 2: Instalar Dependencias
Instalaremos las librerías necesarias tanto para el servidor como para la parte visual web.
```bash
# Entrar al backend e instalar
cd server
npm install
npm run build # (si tuvieras código de compilación propio, en Node suele bastar el 'npm install')
npx prisma generate
npx prisma db push

# Volver a la raíz y entrar al frontend
cd ../client
npm install
npm run build
cd ..
```

## PASO 3: Encender el Servidor con PM2
PM2 se asegurará de encender ambas piezas y mantenerlas vivas para siempre incluso si cierras la terminal.

```bash
# Instalar PM2 globalmente (si no lo tenías de tu proyecto Reyval)
sudo npm install -g pm2

# Encender el ecosistema (Basado en tu nuevo archivo ecosystem.config.js)
pm2 start ecosystem.config.js

# Guardar la configuración para que arranque si se reinicia la máquina de Ubuntu
pm2 save
pm2 startup
```

---

## 🎯 Resultado
HotelTriz estará corriendo en `http://LA_IP_DE_TU_SERVIDOR:3000`. 
Si usas NGINX, solo deberás hacer un "Reverse Proxy" apuntando tu dominio real (ej. `hoteltriz.com`) hacia el puerto `:3000`.
