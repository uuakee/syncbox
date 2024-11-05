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

  async downloadAndParseM3U(req, res) {
    try {
        const { m3uUrl, type } = req.query;
        const userId = req.user.id;

        if (!m3uUrl) {
            return res.status(400).json({ sucesso: false, erro: 'URL do arquivo M3U é obrigatória.' });
        }

        console.log('M3U URL:', m3uUrl);  // Log da URL do M3U

        // Buscar o nickname do usuário no banco de dados pelo userId
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { nickname: true },
        });

        if (!user || !user.nickname) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário ou nickname não encontrado.' });
        }

        const nickname = user.nickname;
        console.log('Nickname do usuário:', nickname);  // Log do nickname do usuário

        // Busca a conexão de banco de dados mais recente do usuário
        const recentConnection = await prisma.databaseCredential.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        if (!recentConnection) {
            return res.status(404).json({ sucesso: false, erro: 'Nenhuma conexão de banco de dados encontrada.' });
        }

        const { host, usuario, senha } = recentConnection;
        console.log('Conexão de banco de dados encontrada:', { host, usuario });  // Log da conexão do banco

        // Portas para verificar a conexão
        const ports = [3306, 7999];
        let connection;
        let connected = false;
        let databaseName = '';
        let successfulPort = null;

        // Tenta conectar no banco em diferentes portas e verifica qual base de dados usar
        for (const port of ports) {
            try {
                connection = await mysql.createConnection({
                    host,
                    user: usuario,
                    password: senha,
                    port,
                });

                await connection.connect();
                console.log(`Conectado ao banco de dados na porta ${port}`);  // Log da conexão com sucesso

                // Verifica se a base de dados xui existe
                const [xuiResult] = await connection.execute("SHOW DATABASES LIKE 'xui'");
                if (xuiResult.length > 0) {
                    databaseName = 'xui';
                    connected = true;
                    successfulPort = port;  // Salva a porta usada com sucesso
                    break;
                }

                // Verifica se a base de dados xtream_iptvpro existe
                const [xtreamResult] = await connection.execute("SHOW DATABASES LIKE 'xtream_iptvpro'");
                if (xtreamResult.length > 0) {
                    databaseName = 'xtream_iptvpro';
                    connected = true;
                    successfulPort = port;  // Salva a porta usada com sucesso
                    break;
                }

            } catch (connectionError) {
                console.error(`Erro ao conectar ao banco de dados na porta ${port}:`, connectionError.message);
            } finally {
                if (connection) await connection.end();
            }
        }

        if (!connected) {
            return res.status(400).json({ sucesso: false, erro: 'Falha na conexão com o banco de dados em ambas as portas ou nenhuma base de dados compatível encontrada.' });
        }

        console.log(`Conectado ao banco de dados ${databaseName} na porta ${successfulPort}`);  // Log do banco de dados conectado e porta usada

        // Estabelece nova conexão com o banco correto na porta correta
        connection = await mysql.createConnection({
            host,
            user: usuario,
            password: senha,
            database: databaseName,
            port: successfulPort,  // Usa a porta onde a conexão foi bem-sucedida
        });

        // Buscar os bouquets do banco de dados
        const [bouquets] = await connection.execute('SELECT * FROM bouquets');
        console.log('Bouquets encontrados:', bouquets);  // Log dos bouquets encontrados

        // Cria diretório temporário para salvar o arquivo M3U
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        console.log('Diretório temporário verificado/criado:', tempDir);  // Log da criação do diretório

        // Cria nome do arquivo baseado no nickname e data
        const fileName = `m3u_${nickname}_${Date.now()}.m3u`;
        const filePath = path.join(tempDir, fileName);

 // Faz o download do arquivo M3U e salva no diretório temporário
const response = await axios.get(m3uUrl, { 
  responseType: 'stream',
  headers: {
      Host: new URL(m3uUrl).host // Adiciona o cabeçalho Host calculado a partir da URL
  }
}).catch(err => {
  console.error('Erro ao acessar a URL do M3U:', err.message);
  return res.status(500).json({ sucesso: false, erro: 'Erro ao acessar a URL do M3U.', detalhes: err.message });
});

// Interrompe o fluxo se o download falhar
if (!response || response.status !== 200) {
  return;
}


        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on('finish', async () => {
            console.log('Arquivo M3U salvo em:', filePath);  // Log da finalização do download

            try {
                // Lê o conteúdo do arquivo M3U após o download
                let playlist = fs.readFileSync(filePath, 'utf8');
                console.log('Arquivo M3U lido com sucesso:', playlist.substring(0, 100));  // Log do início do conteúdo da playlist (mostra apenas os primeiros 100 caracteres)

                // Faz o parsing do conteúdo M3U
                const result = parser.parse(playlist);
                console.log('Resultado do parsing do M3U:', result);  // Log do resultado do parsing

                // Verifica o valor do parâmetro `type` e ajusta o filtro de categorias
                let prefix = 'FILMES | ';
                if (type === '2') {
                    prefix = 'SERIES | ';
                }

                // Mapeia as categorias com base no prefixo escolhido, ignorando maiúsculas/minúsculas
                const categoriesMap = {};
                result.items.forEach(item => {
                    const category = item.group.title;
                    if (category && category.toUpperCase().startsWith(prefix.toUpperCase())) {
                        if (!categoriesMap[category]) {
                            categoriesMap[category] = 1;
                        } else {
                            categoriesMap[category]++;
                        }
                    }
                });

                console.log('Categorias mapeadas:', categoriesMap);  // Log das categorias mapeadas

                // Transforma o objeto de categorias em um array com id e nome da categoria
                const categoriesWithId = Object.keys(categoriesMap).map((categoryName, index) => ({
                    id: index + 1,
                    category: categoryName,
                    count: categoriesMap[categoryName],
                }));

                // **Adicionar o id-category correto no final de cada linha #EXTINF**
                let playlistLines = playlist.split('\n');
                playlistLines = playlistLines.map(line => {
                    if (line.startsWith('#EXTINF')) {
                        const categoryMatch = line.match(/group-title="([^"]+)"/);
                        if (categoryMatch) {
                            const category = categoryMatch[1];
                            const matchedCategory = categoriesWithId.find(cat => cat.category === category);
                            if (matchedCategory) {
                                return `${line} id-category="${matchedCategory.id}"`;
                            }
                        }
                    }
                    return line;
                });

                // Salva novamente o arquivo M3U com as modificações
                fs.writeFileSync(filePath, playlistLines.join('\n'), 'utf8');
                console.log('Arquivo M3U modificado salvo com sucesso.');  // Log da finalização do processo de modificação

                // Fechar a conexão com o banco
                await connection.end();
                console.log('Conexão com o banco de dados fechada.');  // Log do fechamento da conexão

                // Retorna as categorias e os bouquets
                res.status(200).json({ 
                    sucesso: true, 
                    categories: categoriesWithId,
                    bouquets: bouquets, 
                    message: 'Arquivo M3U atualizado com o id-category correto.' 
                });
            } catch (error) {
                console.error('Erro ao processar o arquivo M3U:', error.message);
                if (!res.headersSent) {
                    res.status(500).json({ sucesso: false, erro: 'Erro ao processar o arquivo M3U.', detalhes: error.message });
                }
            }
        });

        writer.on('error', (error) => {
            console.error('Erro ao salvar o arquivo M3U:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ sucesso: false, erro: 'Erro ao salvar o arquivo M3U.', detalhes: error.message });
            }
        });
    } catch (error) {
        console.error('Erro geral:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ sucesso: false, erro: 'Erro ao baixar e processar o arquivo M3U.', detalhes: error.message });
        }
    }
},

 
  
async importM3UDataToXUI(req, res) {
  try {
    const { selectedCategories, bouquetId } = req.body; // IDs das categorias e do bouquet selecionados pelo cliente
    const userId = req.user.id;
    
    const tmdbApiKey = 'eccd65f46c3e9745bfd11d9b8346bff5'; // Coloque sua chave da API do TMDb aqui
    
    console.log("Iniciando importM3UDataToXUI...");
    
    // Buscar o nickname do usuário no banco de dados pelo userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });
    
    if (!user || !user.nickname) {
      console.log("Usuário ou nickname não encontrado.");
      return res.status(404).json({ sucesso: false, erro: 'Usuário ou nickname não encontrado.' });
    }
    
    const nickname = user.nickname;
    console.log(`Nickname do usuário: ${nickname}`);
    
    // Busca a conexão de banco de dados mais recente do usuário
    const recentConnection = await prisma.databaseCredential.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!recentConnection) {
      console.log("Nenhuma conexão de banco de dados encontrada.");
      return res.status(404).json({ sucesso: false, erro: 'Nenhuma conexão de banco de dados encontrada.' });
    }
    
    const { host, usuario, senha } = recentConnection;
    console.log('Conexão de banco de dados encontrada:', { host, usuario });
    
    // Portas para verificar a conexão
    const ports = [3306, 7999];
    let connection;
    let connected = false;
    let databaseName = '';
    let successfulPort = null;
    let categoryTable = 'streams_categories'; // Tabela padrão para a porta 3306
    let moviePropertiesColumn = 'movie_properties'; // Coluna padrão para a porta 3306
    
    // Tenta conectar no banco em diferentes portas e verifica qual base de dados usar
    for (const port of ports) {
      try {
        connection = await mysql.createConnection({
          host,
          user: usuario,
          password: senha,
          port,
        });

        await connection.connect();
        console.log(`Conectado ao banco de dados na porta ${port}`);

        // Verifica se a base de dados xui existe
        const [xuiResult] = await connection.execute("SHOW DATABASES LIKE 'xui'");
        if (xuiResult.length > 0) {
          databaseName = 'xui';
          connected = true;
          successfulPort = port;
          if (port === 7999) {
            categoryTable = 'stream_categories'; // Para a porta 7999
            moviePropertiesColumn = 'movie_propeties'; // Coluna correta para a porta 7999
          }
          break;
        }

        // Verifica se a base de dados xtream_iptvpro existe
        const [xtreamResult] = await connection.execute("SHOW DATABASES LIKE 'xtream_iptvpro'");
        if (xtreamResult.length > 0) {
          databaseName = 'xtream_iptvpro';
          connected = true;
          successfulPort = port;
          if (port === 7999) {
            categoryTable = 'stream_categories'; // Para a porta 7999
            moviePropertiesColumn = 'movie_propeties'; // Coluna correta para a porta 7999
          }
          break;
        }

      } catch (connectionError) {
        console.error(`Erro ao conectar ao banco de dados na porta ${port}:`, connectionError.message);
      } finally {
        if (connection) await connection.end();
      }
    }

    if (!connected) {
      console.log('Falha na conexão com o banco de dados em ambas as portas ou nenhuma base de dados compatível encontrada.');
      return res.status(400).json({ sucesso: false, erro: 'Falha na conexão com o banco de dados em ambas as portas ou nenhuma base de dados compatível encontrada.' });
    }

    console.log(`Conectado ao banco de dados ${databaseName} na porta ${successfulPort}`);

    // Estabelece nova conexão com o banco correto na porta correta
    connection = await mysql.createConnection({
      host,
      user: usuario,
      password: senha,
      database: databaseName,
      port: successfulPort,
    });

    console.log("Conexão ao banco de dados estabelecida.");
    
    // Consulta para obter todos os gêneros da API do TMDb
    const genreResponse = await axios.get(`https://api.themoviedb.org/3/genre/movie/list`, {
      params: {
        api_key: tmdbApiKey,
        language: 'pt-BR'
      },
    });
    
    const genreMap = genreResponse.data.genres.reduce((map, genre) => {
      map[genre.id] = genre.name;
      return map;
    }, {});
    
    // Busca o último arquivo M3U do cliente com base no nickname e na data mais recente
    const tempDir = path.join(__dirname, '../temp');
    const files = fs.readdirSync(tempDir);
    const recentFile = files
      .filter(file => file.includes(`m3u_${nickname}`))
      .map(file => ({
        file,
        time: fs.statSync(path.join(tempDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];
    
    if (!recentFile) {
      console.log("Nenhum arquivo M3U encontrado para o usuário.");
      return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo M3U encontrado para o usuário.' });
    }
    
    console.log(`Arquivo M3U encontrado: ${recentFile.file}`);
    
    // Lê o conteúdo do arquivo M3U mais recente
    const filePath = path.join(tempDir, recentFile.file);
    const playlist = fs.readFileSync(filePath, 'utf8');
    const result = parser.parse(playlist);
    
    console.log("Arquivo M3U parseado com sucesso.");
    
    // Mapeia os itens para encontrar o id-category diretamente no campo 'raw'
    const categoryMap = result.items.reduce((map, item) => {
      if (item.raw) {  // Verifica se 'raw' existe
        const categoryMatch = item.raw.match(/id-category="(\d+)"/);
        if (categoryMatch) {
          const categoryId = categoryMatch[1];
          const groupTitle = item.group.title.replace(/['"]/g, ""); // Remove aspas de 'Filmes | Guerra'

          // Garantir que o id-category não seja adicionado ao nome do filme
          let movieName = item.name.replace(/id-category="\d+"/, '').replace('id-category', '').trim();  // Remove qualquer id-category do nome
    
          // Remove o ano do título do filme, que geralmente está entre parênteses
          movieName = movieName.replace(/\(\d{4}\)/, '').trim();
    
          if (!map[categoryId]) {
            map[categoryId] = {
              groupTitle: groupTitle,
              movies: [],
            };
          }
    
          map[categoryId].movies.push({
            stream_display_name: movieName,
            stream_source: [item.url],
            stream_icon: item.tvg.logo,
          });
        }
      } else {
        console.log(`Item sem categoria ou group.title:`, item);
      }
      return map;
    }, {});
    
    console.log("Mapeamento de categorias concluído.", categoryMap);
    
    if (Object.keys(categoryMap).length === 0) {
      console.log("Nenhuma categoria foi mapeada.");
      return res.status(400).json({ sucesso: false, erro: 'Nenhuma categoria foi mapeada do M3U.' });
    }
    
    let movieIds = [];
    // Iterar pelo mapa de categorias e inserir apenas as selecionadas no banco de dados
    for (const [categoryId, categoryData] of Object.entries(categoryMap)) {
      if (selectedCategories.includes(parseInt(categoryId))) {
        console.log(`Inserindo categoria: ${categoryData.groupTitle} com id-category: ${categoryId}`);
        
        // Monta a query para inserção de categorias (sem aspas em torno dos valores)
        let query = `INSERT INTO ${categoryTable} (category_type, category_name, parent_id, cat_order`;
        let queryValues = ['movie', categoryData.groupTitle, 0, 0]; // Removido as aspas simples dos valores
        
        if (successfulPort !== 7999) {
          query += `, is_adult) VALUES (?, ?, ?, ?, '0')`;
        } else {
          query += `) VALUES (?, ?, ?, ?)`;
        }
    
        // Inserir categoria na tabela streams_categories ou stream_categories
        const [result] = await connection.execute(query, queryValues);
        
        const category_id = result.insertId;
    
        // Inserir todos os filmes da categoria na tabela streams
        for (const movie of categoryData.movies) {
          // Buscar informações do filme na API do TMDb com linguagem pt-BR
          const tmdbResponse = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
              api_key: tmdbApiKey,
              query: movie.stream_display_name,
              language: 'pt-BR'
            },
          });
    
          let movieInfo = tmdbResponse.data.results[0] || {};
    
          // Mapeia os ids dos gêneros para os nomes correspondentes
          const genreNames = movieInfo.genre_ids ? movieInfo.genre_ids.map(id => genreMap[id]).join(", ") : "";
    
          const movieProperties = {
            kinopoisk_url: "",
            tmdb_id: movieInfo.id || "",
            name: movie.stream_display_name,
            o_name: movie.stream_display_name,
            cover_big: movieInfo.poster_path ? `https://image.tmdb.org/t/p/w500${movieInfo.poster_path}` : movie.stream_icon,
            movie_image: movieInfo.poster_path ? `https://image.tmdb.org/t/p/w500${movieInfo.poster_path}` : movie.stream_icon,
            release_date: movieInfo.release_date || "",
            episode_run_time: "",
            youtube_trailer: "",
            director: "",
            actors: "",
            cast: movieInfo.cast || "",
            description: movieInfo.overview || "",
            plot: movieInfo.overview || "",
            age: "",
            mpaa_rating: "",
            rating_count_kinopoisk: 0,
            country: "",
            genre: genreNames,
            duration_secs: 0,
            duration: "00:00:00",
            video: [],
            audio: [],
            bitrate: 0,
            rating: movieInfo.vote_average || ""
          };
    
          // **Verifica se a porta é 7999 ou 3306**
          let categoryIdValue;
          if (successfulPort === 7999) {
            categoryIdValue = category_id;  // Para a porta 7999, valor simples
          } else {
            categoryIdValue = JSON.stringify([category_id]);  // Para a porta 3306, valor como array
          }

          const [movieResult] = await connection.execute(
            `INSERT INTO streams (type, category_id, stream_display_name, stream_source, stream_icon, added, ${moviePropertiesColumn})
            VALUES ('2', ?, ?, ?, ?, ?, ?)`,
            [categoryIdValue, movie.stream_display_name, JSON.stringify(movie.stream_source), movie.stream_icon, new Date(), JSON.stringify(movieProperties)]
          );
          
          movieIds.push(movieResult.insertId);
        }
      }
    }
    
    // Atualizar o bouquet com os novos filmes
    if (movieIds.length > 0) {
      for (const movieId of movieIds) {
        await connection.execute(
          `UPDATE bouquets SET bouquet_movies = JSON_ARRAY_APPEND(bouquet_movies, '$', ?) WHERE id = ?`,
          [movieId, bouquetId]
        );
      }
    }
    
    console.log("Fechando conexão com o banco de dados.");
    await connection.end();
    
    res.status(200).json({ sucesso: true, message: 'Categorias e filmes inseridos com sucesso no banco de dados.' });
  } catch (error) {
    console.log("Erro durante o processo:", error);
    res.status(500).json({ sucesso: false, erro: 'Erro ao importar categorias e filmes para o banco de dados.', detalhes: error.message });
  }
},

async importM3UDataToXUIForSeries(req, res) {
  try {
    const { selectedCategories, bouquetId } = req.body;
    const userId = req.user.id;
    const tmdbApiKey = 'eccd65f46c3e9745bfd11d9b8346bff5';

    console.log("Iniciando importM3UDataToXUIForSeries...");

    // Buscar o nickname do usuário no banco de dados pelo userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });

    if (!user || !user.nickname) {
      console.log("Usuário ou nickname não encontrado.");
      return res.status(404).json({ sucesso: false, erro: 'Usuário ou nickname não encontrado.' });
    }

    const nickname = user.nickname;
    console.log(`Nickname do usuário: ${nickname}`);

    // Busca a conexão de banco de dados mais recente do usuário
    const recentConnection = await prisma.databaseCredential.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentConnection) {
      console.log("Nenhuma conexão de banco de dados encontrada.");
      return res.status(404).json({ sucesso: false, erro: 'Nenhuma conexão de banco de dados encontrada.' });
    }

    const { host, usuario, senha } = recentConnection;
    console.log('Conexão de banco de dados encontrada:', { host, usuario });

    const ports = [3306, 7999];
    let connection;
    let connected = false;
    let databaseName = '';
    let successfulPort = null;
    let categoryTable = 'streams_categories';

    for (const port of ports) {
      try {
        connection = await mysql.createConnection({ host, user: usuario, password: senha, port });
        await connection.connect();
        console.log(`Conectado ao banco de dados na porta ${port}`);

        const [xuiResult] = await connection.execute("SHOW DATABASES LIKE 'xui'");
        if (xuiResult.length > 0) {
          databaseName = 'xui';
          connected = true;
          successfulPort = port;
          if (port === 7999) categoryTable = 'stream_categories';
          break;
        }

        const [xtreamResult] = await connection.execute("SHOW DATABASES LIKE 'xtream_iptvpro'");
        if (xtreamResult.length > 0) {
          databaseName = 'xtream_iptvpro';
          connected = true;
          successfulPort = port;
          if (port === 7999) categoryTable = 'stream_categories';
          break;
        }
      } catch (connectionError) {
        console.error(`Erro ao conectar ao banco de dados na porta ${port}:`, connectionError.message);
      } finally {
        if (connection) await connection.end();
      }
    }

    if (!connected) {
      console.log('Falha na conexão com o banco de dados em ambas as portas ou nenhuma base de dados compatível encontrada.');
      return res.status(400).json({ sucesso: false, erro: 'Falha na conexão com o banco de dados em ambas as portas ou nenhuma base de dados compatível encontrada.' });
    }

    console.log(`Conectado ao banco de dados ${databaseName} na porta ${successfulPort}`);
    connection = await mysql.createConnection({
      host,
      user: usuario,
      password: senha,
      database: databaseName,
      port: successfulPort,
    });

    console.log("Conexão ao banco de dados estabelecida.");

    const tempDir = path.join(__dirname, '../temp');
    const files = fs.readdirSync(tempDir);
    const recentFile = files.filter(file => file.includes(`m3u_${nickname}`))
                            .map(file => ({ file, time: fs.statSync(path.join(tempDir, file)).mtime.getTime() }))
                            .sort((a, b) => b.time - a.time)[0];

    if (!recentFile) {
      console.log("Nenhum arquivo M3U encontrado para o usuário.");
      return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo M3U encontrado para o usuário.' });
    }

    console.log(`Arquivo M3U encontrado: ${recentFile.file}`);
    const filePath = path.join(tempDir, recentFile.file);
    const playlistContent = fs.readFileSync(filePath, 'utf8');
    const result = parser.parse(playlistContent);
    console.log("Arquivo M3U parseado com sucesso.");

    const filteredCategories = result.items.filter(item => {
      const categoryMatch = item.raw.match(/id-category="(\d+)"/);
      return categoryMatch && selectedCategories.includes(parseInt(categoryMatch[1]));
    });

    if (filteredCategories.length === 0) {
      console.log("Nenhuma categoria foi mapeada.");
      return res.status(400).json({ sucesso: false, erro: 'Nenhuma categoria foi mapeada do M3U.' });
    }

    const uniqueCategories = new Map();
    for (const item of filteredCategories) {
      const categoryMatch = item.raw.match(/id-category="(\d+)"/);
      if (categoryMatch) {
        const categoryId = categoryMatch[1];
        const groupTitle = item.group.title.replace(/['"]/g, "");
        uniqueCategories.set(categoryId, groupTitle);
      }
    }

    async function ensureCategoryExists(connection, groupTitle) {
      const [existingCategory] = await connection.execute(
        `SELECT id FROM streams_categories WHERE category_name = ? AND category_type = 'series'`,
        [groupTitle]
      );

      if (existingCategory.length === 0) {
        const insertCategoryQuery = `
          INSERT INTO streams_categories (category_type, category_name, parent_id, cat_order, is_adult)
          VALUES ('series', ?, 0, 0, '0')
        `;
        const [insertResult] = await connection.execute(insertCategoryQuery, [groupTitle]);
        return insertResult.insertId;
      } else {
        return existingCategory[0].id;
      }
    }

    async function insertSeriesToStreamsSeries(connection, seriesName, categoryId) {
      const [existingSeries] = await connection.execute(
        `SELECT id FROM streams_series WHERE title = ? AND category_id = ?`,
        [seriesName, `[${categoryId}]`]
      );

      if (existingSeries.length > 0) {
        console.log(`Série '${seriesName}' já existe no streams_series com ID: ${existingSeries[0].id}`);
        return existingSeries[0].id;
      }

      console.log(`Inserindo série '${seriesName}' no streams_series`);

      const insertSeriesQuery = `
        INSERT INTO streams_series (title, category_id, cover, cover_big, plot, year)
        VALUES (?, ?, '', '', '', YEAR(CURDATE()))
      `;
      const [result] = await connection.execute(insertSeriesQuery, [seriesName, `[${categoryId}]`]);

      console.log(`Série '${seriesName}' inserida com sucesso com ID: ${result.insertId}`);
      return result.insertId;
    }

    async function insertEpisodesForSeries(connection, seriesData, categoryId, seriesId) {
      const insertedEpisodeIds = [];

      for (const episode of seriesData) {
        try {
          const displayName = episode.stream_display_name || episode.tvg?.name;
          if (!displayName) continue;

          const seriesName = displayName.replace(/S\d+E\d+/i, "").trim();
          const seasonMatch = displayName.match(/S(\d+)E(\d+)/i);
          if (!seasonMatch) continue;

          const seasonNumber = seasonMatch[1];
          const episodeNumber = seasonMatch[2];

          const insertEpisodeQuery = `
            INSERT INTO streams (type, category_id, stream_display_name, stream_source, target_container, added, series_no, year)
            VALUES ('5', ?, ?, ?, 'mp4', NOW(), ?, YEAR(CURDATE()))
          `;

          const [insertResult] = await connection.execute(insertEpisodeQuery, [
            `[${categoryId}]`, // Ajuste para incluir o ID entre colchetes
            displayName,
            JSON.stringify([episode.url]),
            seasonNumber
          ]);

          const streamId = insertResult.insertId;
          insertedEpisodeIds.push({ streamId, seasonNumber, episodeNumber });
        } catch (error) {
          console.error(`Erro ao inserir episódio ${displayName || "desconhecido"}:`, error.message);
        }
      }

      for (const ep of insertedEpisodeIds) {
        const insertEpisodeToSeriesQuery = `
          INSERT INTO streams_episodes (season_num, episode_num, series_id, stream_id)
          VALUES (?, ?, ?, ?)
        `;
        await connection.execute(insertEpisodeToSeriesQuery, [
          ep.seasonNumber,
          ep.episodeNumber,
          seriesId,
          ep.streamId
        ]);
      }
    }

    const allInsertedEpisodeIds = [];
    for (const [categoryId, groupTitle] of uniqueCategories) {
      const categoryDbId = await ensureCategoryExists(connection, groupTitle);
      const seriesEpisodes = filteredCategories.filter(item => {
        const categoryMatch = item.raw.match(/id-category="(\d+)"/);
        return categoryMatch && parseInt(categoryMatch[1]) === parseInt(categoryId);
      });

      const seriesName = seriesEpisodes[0]?.tvg?.name.replace(/S\d+E\d+/i, "").trim();
      const seriesMainEntryId = await insertSeriesToStreamsSeries(connection, seriesName, categoryDbId);
      await insertEpisodesForSeries(connection, seriesEpisodes, categoryDbId, seriesMainEntryId);
    }

    console.log("Fechando conexão com o banco de dados.");
    await connection.end();

    res.status(200).json({ sucesso: true, message: 'Categorias de séries e episódios inseridos e associados ao bouquet com sucesso.' });
  } catch (error) {
    console.log("Erro durante o processo:", error);
    res.status(500).json({ sucesso: false, erro: 'Erro ao importar categorias de séries para o banco de dados.', detalhes: error.message });
  }
}
};

module.exports = SyncController;
