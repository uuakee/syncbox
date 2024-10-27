# Use a imagem oficial do Node.js como base
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /src

# Copiar o arquivo package.json e yarn.lock
COPY package.json yarn.lock ./

# Instalar as dependências usando Yarn
RUN yarn install

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta 3000 (verifique se é a porta que seu servidor está utilizando)
EXPOSE 5000

# Comando para iniciar o servidor Node.js
CMD ["node", "server.js"]
