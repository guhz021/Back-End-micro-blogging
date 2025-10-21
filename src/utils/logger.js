import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "logs");
const arquivo = path.join(dir, "errors.txt");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export function logErro(err) {
  const linha = `[${new Date().toISOString()}] ${String(err?.stack || err)}\n`;
  fs.appendFileSync(arquivo, linha);
}
