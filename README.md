# Tutorial de Instação

1. Faça a atualização dos pacotes do Ubuntu
```
sudo apt update && sudo apt upgrade -y
```

2. Instalar o MySQL
```
sudo apt install mysql-server -y
sudo mysql -u root -p
```

3. Crie o banco que será utilizado pela API
```
CREATE DATABASE nome_do_banco_de_dados;
CREATE USER 'nome_do_usuario'@'localhost' IDENTIFIED BY 'senha_segura';
GRANT ALL PRIVILEGES ON nome_do_banco_de_dados.* TO 'nome_do_usuario'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

4. Crie um ```.env``` para configurar o ambiente da API
```
DATABASE_URL="mysql://nome_do_usuario:senha_segura@localhost:3306/nome_do_banco_de_dados"
PORT=1936
JWT_SECRET=e927fbbfd1ecb9a6c92b0b9d64c739d9a8fc45fa234b6c15a4b56a239f3ac2c4c7a9f79ddf5c6e1c5675bc83c4b4e23c9d9b2c8b4d8dfd9a8fd8f8e3b0b6a4c5
```

5. Instale o NVM (Node Version Manager)
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 21
```

6. Clone e configuração do repositório do Github
```
git clone https://github.com/uuakee/syncbox.git
cd syncbox/
npm install
npx prisma migrate deploy
```

7. Instalação e configuração do Nginx
```
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/dominio
```

8. Adicione a seguinte configuração neste arquivo
```
server {
    listen 80;
    server_name dominio;

    location / {
        proxy_pass http://localhost:1936;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

9. Ativa a configuração e reinicia o Nginx
```
sudo ln -s /etc/nginx/sites-available/api.ecosentry.cloud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

10. Instalação do Certificado SSL
```
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d DOMINIO
```

11. Deixe o servidor rodando 24hrs
```
sudo npm install -g pm2
cd syncbox/
pm2 start src/server.js --name "financy-api"
```

# Pronto API instalada e pronta para operar.

