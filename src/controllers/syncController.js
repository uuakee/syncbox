const fs = require('fs');
const path = require('path');
const parser = require('iptv-playlist-parser');
const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

const SyncController = {
  async getCategoriesMovies(req, res) {
    try {
      const userId = req.user.id;
      const recentConnection = await prisma.databaseCredential.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!recentConnection) {
        return res.status(404).json({ sucesso: false, erro: 'Nenhuma conexão de banco de dados encontrada.' });
      }

      const { host, usuario, senha } = recentConnection;
      const connection = await mysql.createConnection({
        host,
        user: usuario,
        password: senha,
        database: 'xui',
      });

      const [rows] = await connection.execute(
        'SELECT * FROM streams_categories WHERE category_type = ?',
        ['movie']
      );

      await connection.end();

      const categoriesWithId = rows.map((category, index) => ({
        id: index + 1,
        ...category,
      }));

      res.status(200).json({ sucesso: true, categories: categoriesWithId });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao buscar categorias de filmes.' });
    }
  },

  async getBouquets(req, res) {
    try {
      const userId = req.user.id;
      const recentConnection = await prisma.databaseCredential.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!recentConnection) {
        return res.status(404).json({ sucesso: false, erro: 'Nenhuma conexão de banco de dados encontrada.' });
      }

      const { host, usuario, senha } = recentConnection;
      const connection = await mysql.createConnection({
        host,
        user: usuario,
        password: senha,
        database: 'xui',
      });

      const [rows] = await connection.execute('SELECT * FROM bouquets');
      await connection.end();

      const bouquetsWithId = rows.map((bouquet, index) => ({
        id: index + 1,
        ...bouquet,
      }));

      res.status(200).json({ sucesso: true, bouquets: bouquetsWithId });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao buscar bouquets.' });
    }
  },

  async getCategoriesMoviesM3U(req, res) {
    try {
      const { m3uUrl } = req.query;

      if (!m3uUrl) {
        return res.status(400).json({ sucesso: false, erro: 'URL do arquivo M3U é obrigatória.' });
      }

      const response = await axios.get(m3uUrl);
      const m3uContent = response.data;
      const lines = m3uContent.split('\n');
      const categories = {};

      lines.forEach((line) => {
        if (line.startsWith('#EXTINF')) {
          const groupTitleMatch = line.match(/group-title="(FILMES \| |Filmes \| )([^"]*)"/);

          if (groupTitleMatch) {
            const category = groupTitleMatch[2].trim();
            categories[category] = (categories[category] || 0) + 1;
          }
        }
      });

      const categoriesWithCounts = Object.keys(categories).map((categoryName, index) => ({
        id: index + 1,
        category: categoryName,
        movieCount: categories[categoryName],
      }));

      res.status(200).json({ sucesso: true, categories: categoriesWithCounts });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao buscar categorias no M3U.' });
    }
  },

  async getCategoriesSeriesM3U(req, res) {
    try {
      const { m3uUrl } = req.query;

      if (!m3uUrl) {
        return res.status(400).json({ sucesso: false, erro: 'URL do arquivo M3U é obrigatória.' });
      }

      const response = await axios.get(m3uUrl);
      const m3uContent = response.data;
      const lines = m3uContent.split('\n');
      const categories = {};

      lines.forEach((line) => {
        if (line.startsWith('#EXTINF')) {
          const groupTitleMatch = line.match(/group-title="(Séries \| |Series \| )([^"]*)"/);

          if (groupTitleMatch) {
            const category = groupTitleMatch[2].trim();
            categories[category] = (categories[category] || 0) + 1;
          }
        }
      });

      const categoriesWithCounts = Object.keys(categories).map((categoryName, index) => ({
        id: index + 1,
        category: categoryName,
        seriesCount: categories[categoryName],
      }));

      res.status(200).json({ sucesso: true, categories: categoriesWithCounts });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao buscar categorias de séries no M3U.' });
    }
  },

  async getDownloadM3U(req, res) {
    try {
      const { m3uUrl } = req.query;

      if (!m3uUrl) {
        return res.status(400).json({ sucesso: false, erro: 'URL do arquivo M3U é obrigatória.' });
      }

      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      const fileName = `downloaded_${Date.now()}.m3u`;
      const filePath = path.join(tempDir, fileName);
      const response = await axios.get(m3uUrl, { responseType: 'stream' });

      if (response.status !== 200) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao acessar o arquivo M3U.' });
      }

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      writer.on('finish', () => {
        res.status(200).json({ sucesso: true, message: 'Arquivo M3U baixado com sucesso.', filePath });
      });

      writer.on('error', (error) => {
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar o arquivo M3U.' });
      });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao baixar o arquivo M3U.' });
    }
  },

  async testM3UParser(req, res) {
    try {
      const tempDir = path.join(__dirname, '../temp');

      if (!fs.existsSync(tempDir)) {
        return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo M3U encontrado na pasta temporária.' });
      }

      const files = fs.readdirSync(tempDir);
      const recentFile = files
        .filter(file => file.endsWith('.m3u'))
        .map(file => ({
          file,
          time: fs.statSync(path.join(tempDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time)[0];

      if (!recentFile) {
        return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo M3U encontrado.' });
      }

      const filePath = path.join(tempDir, recentFile.file);
      const playlist = fs.readFileSync(filePath, 'utf8');
      const result = parser.parse(playlist);
      const filteredResult = result.items.filter(item => item.group.title.includes('Filmes | '));

      res.status(200).json({ sucesso: true, message: 'Parsing do arquivo M3U concluído com sucesso.', data: filteredResult });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao fazer parsing do arquivo M3U.' });
    }
  },
};

module.exports = SyncController;
