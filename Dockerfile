# Usa immagine base Node.js LTS
FROM node:18-alpine

# Imposta la working directory
WORKDIR /usr/src/app

# Copia i file di definizione delle dipendenze
COPY package*.json ./

# Installa le dipendenze (incluso dotenv, pg, node-cron, uuid)
RUN npm install --production

# Copia il codice sorgente
COPY . .

# Espone la porta 8080
EXPOSE 8080

# Imposta utente non root per compatibilità OpenShift
RUN chown -R node:node /usr/src/app
USER node

# Comando di avvio
CMD ["node", "index.js"]
