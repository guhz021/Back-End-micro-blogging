import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

let cliente;
let db;

export async function conectar() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  const nome = process.env.MONGODB_DB;
  if (!uri || !nome)
    throw new Error("MONGODB_URI ou MONGODB_DB ausentes no .env");
  cliente = new MongoClient(uri);
  await cliente.connect();
  db = cliente.db(nome);
  return db;
}

export async function obterDB() {
  if (!db) await conectar();
  return db;
}

export async function fechar() {
  if (cliente) await cliente.close();
  cliente = null;
  db = null;
}
