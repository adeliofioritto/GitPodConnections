# Usa immagine base Node.js LTS
FROM node:18-alpine

# Imposta la working directory
WORKDIR /usr/src/app

# Copia i file di definizione delle dipendenze
COPY package*.json ./

# Installa le dipendenze Node.js (solo produzione)
RUN npm install --production

# Copia il codice sorgente
COPY . .

# ✅ Installa oc CLI PRIMA di cambiare utente
RUN apk add --no-cache curl bash \
    && curl -L https://mirror.openshift.com/pub/openshift-v4/clients/oc/latest/linux/oc.tar.gz \
       | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/oc

# ✅ Assicura che oc sia nel PATH
ENV PATH="/usr/local/bin:${PATH}"

# Espone la porta 8080
EXPOSE 8080

# Imposta utente non root per compatibilità OpenShift
RUN chown -R node:node /usr/src/app
USER node

# Comando di avvio
CMD ["node", "index.js"]