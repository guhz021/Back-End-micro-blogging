const http = require('http');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

const PORT = 3000;
const url = 'mongodb://localhost:27017';
const dbName = 'microblog';
let db;

// Função para log de erros
function logError(err) {
  const msg = `[${new Date().toISOString()}] ${err.message}\n`;
  fs.appendFileSync('./logs/errors.log', msg);
}

// Função para extrair hashtags do texto
function extractHashtags(text) {
  const matches = text.match(/#\w+/g);
  return matches ? matches.map(tag => tag.toLowerCase().substring(1)) : [];
}

MongoClient.connect(url)
  .then(client => {
    console.log('Conectado ao MongoDB');
    db = client.db(dbName);
    startServer();
  })
  .catch(err => {
    logError(err);
    console.error('Erro ao conectar no MongoDB');
  });

function startServer() {
  http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    // Criar usuário
    if (req.method === 'POST' && req.url === '/usuarios') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const { nome, email } = JSON.parse(body);
          if (!nome || !email) {
            res.writeHead(400);
            return res.end('Nome e email são obrigatórios');
          }
          const result = await db.collection('usuarios').insertOne({ nome, email });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          logError(err);
          res.writeHead(500);
          res.end('Erro ao criar usuário');
        }
      });
    }

    // Listar usuários
    else if (req.method === 'GET' && req.url === '/usuarios') {
      try {
        const users = await db.collection('usuarios').find().toArray();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao buscar usuários');
      }
    }

    // Criar post
    else if (req.method === 'POST' && req.url === '/posts') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const { conteudo, autorId } = JSON.parse(body);
          if (!conteudo || !autorId) {
            res.writeHead(400);
            return res.end('Conteúdo e autorId são obrigatórios');
          }

          const hashtags = extractHashtags(conteudo);
          // Salva hashtags na coleção separada (evita duplicatas)
          for (const tag of hashtags) {
            await db.collection('hashtags').updateOne(
              { nome: tag },
              { $setOnInsert: { nome: tag } },
              { upsert: true }
            );
          }
      
          const post = {
            conteudo,
            autorId: new ObjectId(autorId),
            data: new Date(),
            hashtags
          };

          const result = await db.collection('posts').insertOne(post);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          logError(err);
          res.writeHead(500);
          res.end('Erro ao criar post');
        }
      });
    }

    // Listar todos os posts
    else if (req.method === 'GET' && req.url === '/posts') {
      try {
        const posts = await db.collection('posts').find().toArray();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao buscar posts');
      }
    }

    // Listar posts por autorId
    else if (req.method === 'GET' && req.url.startsWith('/posts/usuario/')) {
      const autorId = req.url.split('/posts/usuario/')[1];
      try {
        const posts = await db.collection('posts')
          .find({ autorId: new ObjectId(autorId) }).toArray();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao buscar posts por autor');
      }
    }

    // **Corrigido**: Listar posts por hashtag
    else if (req.method === 'GET' && req.url.startsWith('/posts/hashtag/')) {
      const hashtag = decodeURIComponent(req.url.split('/posts/hashtag/')[1]).toLowerCase();
      try {
        const posts = await db.collection('posts')
          .find({ hashtags: hashtag }).toArray();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao buscar posts por hashtag');
      }
    }

    // Listar hashtags
    else if (req.method === 'GET' && req.url === '/hashtags') {
      try {
        const hashtags = await db.collection('hashtags').find().toArray();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hashtags));
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao buscar hashtags');
      }
    }

    // Excluir post por ID
    else if (req.method === 'DELETE' && req.url.startsWith('/posts/')) {
      const postId = req.url.split('/posts/')[1];
      try {
        const result = await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
        if (result.deletedCount === 0) {
          res.writeHead(404);
          res.end('Post não encontrado');
        } else {
          res.writeHead(200);
          res.end('Post excluído com sucesso');
        }
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao excluir post');
      }
    }

    // Excluir usuário por ID
    else if (req.method === 'DELETE' && req.url.startsWith('/usuarios/')) {
      const usuarioId = req.url.split('/usuarios/')[1];
      try {
        const result = await db.collection('usuarios').deleteOne({ _id: new ObjectId(usuarioId) });
        if (result.deletedCount === 0) {
          res.writeHead(404);
          res.end('Usuário não encontrado');
        } else {
          res.writeHead(200);
          res.end('Usuário excluído com sucesso');
        }
      } catch (err) {
        logError(err);
        res.writeHead(500);
        res.end('Erro ao excluir usuário');
      }
    }

    // Rota não encontrada
    else {
      res.writeHead(404);
      res.end('Rota não encontrada');
    }
  }).listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}
