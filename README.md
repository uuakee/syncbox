# Install

1. sudo apt update && sudo apt upgrade -y

2. sudo apt install mysql-server -y

3. Crie um usuário no banco de dados
```
CREATE DATABASE nome_do_banco_de_dados;
CREATE USER 'nome_do_usuario'@'localhost' IDENTIFIED BY 'senha_segura';
GRANT ALL PRIVILEGES ON nome_do_banco_de_dados.* TO 'nome_do_usuario'@'localhost';
FLUSH PRIVILEGES;
```

4. sudo apt install -y nodejs npm
