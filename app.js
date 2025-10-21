import "dotenv/config";
import { conectar, fechar } from "./src/db/conexao.js";
import { Usuario } from "./src/classes/Usuario.js";
import { Postagem } from "./src/classes/Postagem.js";
import { Comentario } from "./src/classes/Comentario.js";

async function main() {
  await conectar();

  // === USUÁRIO ===
  const u = await Usuario.criar({
    nome: "Ana",
    email: "ana@mail.com",
    senha: "123",
  });
  const u1 = await Usuario.buscarPorId(u._id);
  const uList = await Usuario.listar();
  const uUpd = await Usuario.atualizar(u._id, { nome: "Ana Atualizada" });
  const uDel = await Usuario.remover(u._id);

  // Recria usuário para relacionamentos
  const autor = await Usuario.criar({
    nome: "João",
    email: "joao@mail.com",
    senha: "abc",
  });

  // === POSTAGEM ===
  const p = await Postagem.criar({
    usuarioId: autor._id,
    titulo: "Olá",
    conteudo: "Primeiro post #microblog",
  });
  const p1 = await Postagem.buscarPorId(p._id);
  const pListAll = await Postagem.listar();
  const pListAutor = await Postagem.listar({ usuarioId: autor._id });
  const pUpd = await Postagem.atualizar(p._id, {
    titulo: "Atualizado",
    conteudo: "Conteúdo editado #tag",
  });

  // === COMENTÁRIO ===
  const c = await Comentario.criar({
    postagemId: p._id,
    usuarioId: autor._id,
    texto: "Legal!",
  });
  const c1 = await Comentario.buscarPorId(c._id);
  const cListPost = await Comentario.listar({ postagemId: p._id });
  const cUpd = await Comentario.atualizar(c._id, { texto: "Muito legal!" });
  const cDel = await Comentario.remover(c._id);

  // Limpeza final
  const pDel = await Postagem.remover(p._id);
  const autorDel = await Usuario.remover(autor._id);

  console.log({
    usuarios: {
      criado: u,
      buscarPorId: u1,
      listaAntes: uList,
      atualizado: uUpd,
      removido: uDel,
    },
    postagens: {
      criado: p,
      buscarPorId: p1,
      listaTodas: pListAll,
      listaPorAutor: pListAutor,
      atualizado: pUpd,
      removido: pDel,
    },
    comentarios: {
      criado: c,
      buscarPorId: c1,
      listaDaPostagem: cListPost,
      atualizado: cUpd,
      removido: cDel,
    },
  });

  await fechar();
}

main().catch(async (e) => {
  console.error(e);
  await fechar();
  process.exit(1);
});
