import { ObjectId } from "mongodb";
import { obterDB } from "../db/conexao.js";
import { validarObrigatorios } from "../utils/validacao.js";
import { logErro } from "../utils/logger.js";

export class Usuario {
  static colecao = "usuarios";

  static async criar(dados) {
    try {
      validarObrigatorios(dados, ["nome", "email", "senha"]);
      const db = await obterDB();
      dados.criadoEm = new Date();
      const r = await db.collection(this.colecao).insertOne(dados);
      return { _id: r.insertedId, ...dados };
    } catch (e) {
      logErro(e);
      throw e;
    }
  }

  static async buscarPorId(id) {
    try {
      const db = await obterDB();
      return await db
        .collection(this.colecao)
        .findOne({ _id: new ObjectId(id) });
    } catch (e) {
      logErro(e);
      throw e;
    }
  }

  static async listar(filtro = {}, opcoes = {}) {
    try {
      const db = await obterDB();
      return await db.collection(this.colecao).find(filtro, opcoes).toArray();
    } catch (e) {
      logErro(e);
      throw e;
    }
  }

  static async atualizar(id, dados) {
    try {
      const db = await obterDB();
      dados.atualizadoEm = new Date();
      const r = await db
        .collection(this.colecao)
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: dados },
          { returnDocument: "after" }
        );
      return r.value;
    } catch (e) {
      logErro(e);
      throw e;
    }
  }

  static async remover(id) {
    try {
      const db = await obterDB();
      const r = await db
        .collection(this.colecao)
        .deleteOne({ _id: new ObjectId(id) });
      return r.deletedCount === 1;
    } catch (e) {
      logErro(e);
      throw e;
    }
  }
}
