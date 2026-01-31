export function getHojeLocal() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`; // YYYY-MM-DD
}

export function getMesAnoExtenso(mesAno: string) {
  // mesAno esperado: "YYYY-MM"
  const [anoStr, mesStr] = String(mesAno || "").split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  if (!ano || !mes || mes < 1 || mes > 12) return mesAno;
  return `${meses[mes - 1]} de ${ano}`;
}
