# Usar una imagen base de Node.js LTS
FROM node:20

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto (Railway asigna dinámicamente, pero por defecto 5000)
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["./start.sh"]