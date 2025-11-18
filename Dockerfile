FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production
COPY . .

RUN apk add --no-cache curl bash libc6-compat \
 && curl -L https://mirror.openshift.com/pub/openshift-v4/clients/oc/latest/linux/oc.tar.gz -o oc.tar.gz \
 && tar -xzf oc.tar.gz -C /usr/local/bin \
 && chmod +x /usr/local/bin/oc \
 && rm oc.tar.gz

ENV PATH="/usr/local/bin:${PATH}"

# ✅ Configura KUBECONFIG in /tmp per compatibilità UID random
ENV HOME=/tmp
ENV KUBECONFIG=$HOME/kubeconfig
RUN touch $HOME/kubeconfig && chmod 666 $HOME/kubeconfig

EXPOSE 8080

USER node

CMD ["node", "index.js"]