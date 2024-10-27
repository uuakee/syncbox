# Use a imagem oficial do Node.js 21.7.1 como base
FROM node:21.7.1-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /src

# Copiar o arquivo package.json e yarn.lock
COPY package.json yarn.lock ./

# Instalar as dependências usando Yarn
RUN yarn install

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta 5000 (verifique se é a porta que seu servidor está utilizando)
EXPOSE 5000

RUN prisma generate

# Comando para iniciar o servidor Node.js
CMD ["yarn", "dev"]
