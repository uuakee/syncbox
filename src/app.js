const express = require('express');
const app = express();
const router = require('./routes');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Configuração de CORS
app.use(cors({
    origin: "http://localhost:3000", // Substitua pelo domínio do seu frontend em produção
    credentials: true // Habilita o envio de cookies
  }));
app.use(cookieParser());

app.use(express.json());


// Usa o router principal
app.use('/v1',router);



module.exports = app;
