// app/app.js
require('dotenv').config(); // lê .env
const path = require('path');
const http = require('http');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const { URL } = require('url'); // para ler querystring

// ====== Logs ======
const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
function logError(err) {
  const msg = `[${new Date().toISOString()}] ${err?.stack || err?.message || String(err)}\n`;
  fs.appendFileSync(path.join(LOG_DIR, 'errors.log'), msg);
}

// ====== Config ======
const PORT = Number(process.env.PORT) || 3000;
const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'microblog';
let db;

// ====== Utils ======
function extractHashtags(text) {
  const matches = text.match(/#\w+/g);
  return matches ? matches.map(tag => tag.toLowerCase().substring(1)) : [];
}

// pega o que vem após um prefixo da URL, remove querystring e barra final
function getIdFromUrl(prefix, url) {
  return decodeURIComponent(url.split(prefix)[1] || '')
    .split('?')[0]
    .replace(/\/+$/, '')
    .trim();
}

function ensureValidObjectId(id, res) {
  if (!ObjectId.isValid(id)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ID inválido (esperado ObjectId de 24 hex).');
    return false;
  }
  return true;
}

// ====== Conexão Mongo ======
const client = new MongoClient(mongoUrl);
client.connect()
  .then(async () => {
    console.log('✅ Conectado ao MongoDB');
    db = client.db(dbName);

    // índice único para email (idempotente)
    try {
      await db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
    } catch (_) {}

    startServer();
  })
  .catch((err) => {
    logError(err);
    console.error('❌ Erro ao conectar no MongoDB:', err.message);
    process.exit(1);
  });

// ====== HTTP Server ======
function startServer() {
  http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    // --------- ROTAS ---------

    // Criar usuário
    if (req.method === 'POST' && req.url === '/usuarios') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { nome, email } = JSON.parse(body || '{}');
          if (!nome || !email) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Nome e email são obrigatórios.');
          }
          const result = await db.collection('usuarios').insertOne({ nome, email });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          logError(err);
          const msg = err?.code === 11000 ? 'Email já cadastrado.' : 'Erro ao criar usuário.';
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(msg);
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
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao buscar usuários.');
      }
    }

    // Criar post (valida autor e salva autorNome)
    else if (req.method === 'POST' && req.url === '/posts') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { conteudo, autorId } = JSON.parse(body || '{}');
          if (!conteudo || !autorId) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Conteúdo e autorId são obrigatórios.');
          }
          if (!ensureValidObjectId(autorId, res)) return;

          const user = await db.collection('usuarios').findOne({ _id: new ObjectId(autorId) });
          if (!user) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Usuário não encontrado.');
          }

          const hashtags = extractHashtags(conteudo);
          // upsert das hashtags (sem duplicar)
          for (const tag of hashtags) {
            await db.collection('hashtags').updateOne(
              { nome: tag },
              { $setOnInsert: { nome: tag } },
              { upsert: true }
            );
          }

          const post = {
            conteudo,
            autorId: user._id,
            autorNome: user.nome, // grava também o nome para facilitar
            data: new Date(),
            hashtags
          };

          const result = await db.collection('posts').insertOne(post);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          logError(err);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Erro ao criar post.');
        }
      });
    }

    // --- Buscar 1 post via QUERY: GET /posts?id=<id>
    else if (req.method === 'GET' && req.url.startsWith('/posts?')) {
      const parsed = new URL(req.url, 'http://localhost');
      const id = parsed.searchParams.get('id');
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Parâmetro id é obrigatório.');
      }
      if (!ensureValidObjectId(id, res)) return;

      try {
        const found = await db.collection('posts').aggregate([
          { $match: { _id: new ObjectId(id) } },
          {
            $lookup: {
              from: 'usuarios',
              localField: 'autorId',
              foreignField: '_id',
              as: 'autor'
            }
          },
          { $unwind: '$autor' },
          {
            $project: {
              _id: 1,
              conteudo: 1,
              data: 1,
              hashtags: 1,
              autorId: 1,
              autorNome: { $ifNull: ['$autorNome', '$autor.nome'] }
            }
          }
        ]).toArray();

        if (!found.length) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Post não encontrado.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(found[0]));
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao buscar post por id (query).');
      }
    }

    // Listar posts por autorId
    else if (req.method === 'GET' && req.url.startsWith('/posts/usuario/')) {
      const autorId = getIdFromUrl('/posts/usuario/', req.url);
      if (!ensureValidObjectId(autorId, res)) return;

      try {
        const posts = await db.collection('posts').aggregate([
          { $match: { autorId: new ObjectId(autorId) } },
          { $sort: { data: -1 } },
          {
            $lookup: {
              from: 'usuarios',
              localField: 'autorId',
              foreignField: '_id',
              as: 'autor'
            }
          },
          { $unwind: '$autor' },
          {
            $project: {
              _id: 1,
              conteudo: 1,
              data: 1,
              hashtags: 1,
              autorId: 1,
              autorNome: { $ifNull: ['$autorNome', '$autor.nome'] }
            }
          }
        ]).toArray();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao buscar posts por autor.');
      }
    }

    // Listar posts por hashtag
    else if (req.method === 'GET' && req.url.startsWith('/posts/hashtag/')) {
      const hashtag = getIdFromUrl('/posts/hashtag/', req.url).toLowerCase();

      try {
        const posts = await db.collection('posts').aggregate([
          { $match: { hashtags: hashtag } },
          { $sort: { data: -1 } },
          {
            $lookup: {
              from: 'usuarios',
              localField: 'autorId',
              foreignField: '_id',
              as: 'autor'
            }
          },
          { $unwind: '$autor' },
          {
            $project: {
              _id: 1,
              conteudo: 1,
              data: 1,
              hashtags: 1,
              autorId: 1,
              autorNome: { $ifNull: ['$autorNome', '$autor.nome'] }
            }
          }
        ]).toArray();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao buscar posts por hashtag.');
      }
    }

    // Buscar 1 post por _id (rota): GET /posts/:id
    else if (
      req.method === 'GET' &&
      req.url.startsWith('/posts/') &&
      !req.url.startsWith('/posts/usuario/') &&
      !req.url.startsWith('/posts/hashtag/')
    ) {
      const postId = getIdFromUrl('/posts/', req.url);
      if (!ensureValidObjectId(postId, res)) return;

      try {
        const found = await db.collection('posts').aggregate([
          { $match: { _id: new ObjectId(postId) } },
          {
            $lookup: {
              from: 'usuarios',
              localField: 'autorId',
              foreignField: '_id',
              as: 'autor'
            }
          },
          { $unwind: '$autor' },
          {
            $project: {
              _id: 1,
              conteudo: 1,
              data: 1,
              hashtags: 1,
              autorId: 1,
              autorNome: { $ifNull: ['$autorNome', '$autor.nome'] }
            }
          }
        ]).toArray();

        if (!found.length) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Post não encontrado.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(found[0]));
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao buscar post por id (rota).');
      }
    }

    // Listar todos os posts (com autorNome)
    else if (req.method === 'GET' && req.url === '/posts') {
      try {
        const posts = await db.collection('posts').aggregate([
          { $sort: { data: -1 } },
          {
            $lookup: {
              from: 'usuarios',
              localField: 'autorId',
              foreignField: '_id',
              as: 'autor'
            }
          },
          { $unwind: '$autor' },
          {
            $project: {
              _id: 1,
              conteudo: 1,
              data: 1,
              hashtags: 1,
              autorId: 1,
              autorNome: { $ifNull: ['$autorNome', '$autor.nome'] }
            }
          }
        ]).toArray();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao buscar posts.');
      }
    }

    // Excluir post por ID
    else if (req.method === 'DELETE' && req.url.startsWith('/posts/')) {
      const postId = getIdFromUrl('/posts/', req.url);
      if (!ensureValidObjectId(postId, res)) return;

      try {
        const result = await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
        if (!result.deletedCount) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Post não encontrado.');
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Post excluído com sucesso.');
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao excluir post.');
      }
    }

    // Excluir usuário por ID
    else if (req.method === 'DELETE' && req.url.startsWith('/usuarios/')) {
      const usuarioId = getIdFromUrl('/usuarios/', req.url);
      if (!ensureValidObjectId(usuarioId, res)) return;

      try {
        const result = await db.collection('usuarios').deleteOne({ _id: new ObjectId(usuarioId) });
        if (!result.deletedCount) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Usuário não encontrado.');
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Usuário excluído com sucesso.');
      } catch (err) {
        logError(err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao excluir usuário.');
      }
    }

    // 404
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Rota não encontrada');
    }
  }).listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}
