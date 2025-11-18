FROM node:18-alpine

# Imposta la working directory
WORKDIR /usr/src/app

# Copia i file di definizione delle dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm install --production

# Copia il codice sorgente
COPY . .

# Installa oc CLI (come root)
RUN apk add --no-cache curl bash \
    && curl -L https://mirror.openshift.com/pub/openshift-v4/clients/oc/latest/linux/oc.tar.gz | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/oc

# Espone la porta 8080
EXPOSE 8080

# Imposta utente non root per compatibilità OpenShift
RUN chown -R node:node /usr/src/app
USER node

# Comando di avvio
CMD ["node", "index.js"]