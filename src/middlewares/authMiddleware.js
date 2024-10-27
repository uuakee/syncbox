const jwt = require('jsonwebtoken');
require('dotenv').config();

const secretKey = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ sucesso: false, erro: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = { id: decoded.userId }; // Adiciona o ID do usuário ao objeto req.user
    next(); // Chama o próximo middleware ou rota
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return res.status(401).json({ sucesso: false, erro: 'Token inválido.' });
  }
};

module.exports = authMiddleware;
