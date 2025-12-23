# SSGbot

Bot de Discord para SGames con funcionalidades de bienvenida, tickets, rangos y más.

## Despliegue en Railway

1. Crea una cuenta en [Railway](https://railway.app).
2. Conecta tu repositorio de GitHub.
3. Configura las variables de entorno en el dashboard de Railway:
   - `BOT_TOKEN`: Tu token de Discord.
   - `CLIENT_ID`: ID del cliente de Discord.
   - `ENLACE_SOPORTE`: Enlace de soporte.
   - `CANAL_BIENVENIDA_ID`: ID del canal de bienvenida.
   - `CANAL_LOGS_STAFF_ID`: ID del canal de logs.
   - `CANAL_ANUNCIOS_RANGO_ID`: ID del canal de anuncios de rango.
   - `CANAL_TOP_SUGESTION_ID`: ID del canal de top sugerencias.
   - `CANAL_CREACION_TICKET_ID`: ID del canal de creación de tickets.
   - `CATEGORIA_TICKETS_ID`: ID de la categoría de tickets.
   - `ROL_SOPORTE_ID`: ID del rol de soporte.
   - `CATEGORIA_SUGESTION_ID`: ID de la categoría de sugerencias.
   - Roles de rangos (ROL_NOVATO_I, etc.).
   - `GROQ_API_KEY`, `GROQ_API_KEY2`, etc.: Tus claves de API Groq.
   - `PORT`: Puerto asignado por Railway (opcional, por defecto 5000).

4. Railway detectará automáticamente el `Dockerfile` y construirá la aplicación en un contenedor.

## Instalación local

1. Clona el repositorio.
2. Instala dependencias: `npm install`.
3. Copia `.env` y configura las variables.
4. Ejecuta: `npm start`.