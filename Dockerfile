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
RUN apk add --no-cache curl bash libc6-compat \
 && curl -L https://mirror.openshift.com/pub/openshift-v4/clients/oc/latest/linux/oc.tar.gz -o oc.tar.gz \
 && tar -xzf oc.tar.gz -C /usr/local/bin \
 && chmod +x /usr/local/bin/oc \
 && rm oc.tar.gz

# ✅ Assicura che oc sia nel PATH
ENV PATH="/usr/local/bin:${PATH}"

# ✅ Configura KUBECONFIG per utente non root
ENV KUBECONFIG=/usr/src/app/.kube/config
RUN mkdir -p /usr/src/app/.kube \
 && touch /usr/src/app/.kube/config \
 && chown -R node:node /usr/src/app/.kube \
 && chmod 700 /usr/src/app/.kube \
 && chmod 600 /usr/src/app/.kube/config
 
# Espone la porta 8080
EXPOSE 8080

# Imposta utente non root per compatibilità OpenShift
RUN chown -R node:node /usr/src/app
USER node

# Comando di avvio
CMD ["node", "index.js"]