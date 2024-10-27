const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise'); // para verificação de conexão

const prisma = new PrismaClient();
require('dotenv').config();
const secretKey = process.env.JWT_SECRET;

const UserController = {
  // Função para registrar um novo usuário
  async register(req, res) {
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e senha são obrigatórios.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          nickname,
          password: hashedPassword,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      res.status(201).json({ sucesso: true, userId: newUser.id });
    } catch (error) {
      console.error('Erro ao registrar o usuário:', error);
      res.status(500).json({ sucesso: false, erro: 'Erro ao registrar usuário.' });
    }
  },

  // Função para fazer login do usuário
  async login(req, res) {
    const { nickname, password } = req.body;
  
    if (!nickname || !password) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e senha são obrigatórios.' });
    }
  
    try {
      const user = await prisma.user.findUnique({ where: { nickname } });
  
      if (!user) {
        return res.status(401).json({ sucesso: false, erro: 'Usuário não encontrado.' });
      }
  
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ sucesso: false, erro: 'Senha incorreta.' });
      }
  
      const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '30d' });
      
      // Inclua o token no JSON de resposta
      res.cookie('token', token, { httpOnly: true, maxAge: 60 * 60 * 1000 });
      res.status(200).json({ sucesso: true, message: 'Login bem-sucedido!', token });
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      res.status(500).json({ sucesso: false, erro: 'Erro ao fazer login.' });
    }
  },
  // Função para listar as conexões de banco de dados do usuário
  async getUserConnections(req, res) {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ sucesso: false, erro: 'Token não fornecido.' });
    }

    try {
      const decoded = jwt.verify(token, secretKey);
      const userId = decoded.userId;

      // Busca todas as conexões registradas pelo usuário no banco de dados
      const connections = await prisma.databaseCredential.findMany({
        where: { userId },
        select: {
          id: true,
          host: true,
          usuario: true,
          createdAt: true,
        }
      });

      res.status(200).json({ sucesso: true, connections });
    } catch (error) {
      console.error('Erro ao buscar conexões:', error);
      res.status(500).json({ sucesso: false, erro: 'Erro ao buscar conexões.' });
    }
  },

  // Função para salvar as credenciais do banco de dados do cliente com teste de conexão
  async saveDatabaseCredentials(req, res) {
    const { host, usuario, senha } = req.body;
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ sucesso: false, erro: 'Token não fornecido.' });
    }

    try {
      const decoded = jwt.verify(token, secretKey);
      const userId = decoded.userId;

      // Teste de conexão com o MySQL/MariaDB
      let connection;
      try {
        connection = await mysql.createConnection({
          host,
          user: usuario,
          password: senha,
        });
        await connection.connect();
      } catch (connectionError) {
        console.error('Erro ao conectar ao banco de dados:', connectionError);
        return res.status(400).json({ sucesso: false, erro: 'Falha na conexão com o banco de dados.', detalhes: connectionError.message });
      } finally {
        if (connection) await connection.end();
      }

      // Salva as credenciais no banco se a conexão foi bem-sucedida
      const credentials = await prisma.databaseCredential.create({
        data: {
          host,
          usuario,
          senha,
          userId,
          createdAt: new Date(),
        }
      });

      res.status(201).json({ sucesso: true, credentialsId: credentials.id, message: 'Conexão com o banco de dados bem-sucedida!' });
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      res.status(500).json({ sucesso: false, erro: 'Erro ao salvar credenciais.' });
    }
  }
};

module.exports = UserController;
