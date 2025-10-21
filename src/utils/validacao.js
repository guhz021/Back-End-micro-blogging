export function validarObrigatorios(dados, campos) {
  const faltando = campos.filter(
    (c) =>
      dados[c] === undefined ||
      dados[c] === null ||
      String(dados[c]).trim() === ""
  );
  if (faltando.length) {
    const erro = new Error(
      `Campos obrigatórios ausentes: ${faltando.join(", ")}`
    );
    erro.codigo = "VALIDACAO_OBRIGATORIA";
    throw erro;
  }
}
