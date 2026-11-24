# ShipNow API - imagen de producción
# Imagen base: Node 22 (LTS), variante "slim" (Debian liviano; compatible con módulos nativos como bcrypt)
FROM node:22-slim

# Valores por defecto NO sensibles. Todo lo demás (base de datos, secretos) llega por variables de entorno.
ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# 1) Dependencias primero: Docker reutiliza esta capa mientras no cambien package.json / package-lock.json.
#    "npm ci" instala exactamente lo del lockfile y "--omit=dev" deja afuera mocha, chai, etc.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Código de la aplicación. Solo "src": los tests, el .env y el resto no entran a la imagen.
COPY src ./src

# 3) Carpetas que genera la app (logs y archivos subidos), con permisos para el usuario sin privilegios.
RUN mkdir -p logs uploads && chown node:node logs uploads

# No ejecutar como root
USER node

# Puerto por defecto de la API (se cambia con la variable PORT)
EXPOSE 8080

# Docker consulta el health check de la API para saber si el contenedor está sano.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Es lo mismo que "npm start" (node src/server.js), pero ejecutado directo para que Node reciba
# la señal SIGTERM de Docker y pueda apagarse ordenadamente.
CMD ["node", "src/server.js"]
