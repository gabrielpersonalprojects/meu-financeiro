import html2pdf from "html2pdf.js";

type PrintTransacoesPdfReportParams = {
  transacoes: any[];
  filtroMes: string;
  contaLabel: string;
  lancamentoLabel: string;
  categoriaLabel: string;
  tipoGastoLabel: string;
  buscaLabel: string;
  organizacaoLabel: string;
  totalReceitas: number;
  totalDespesas: number;
  saldoTotal: number;
  formatarMoeda: (value: number) => string;
  formatarData: (value: any) => string;
  getContaLabelByTransaction: (transaction: any) => string;
  toastCompact?: (message: string, kind?: "error") => unknown;
};

const escapeHtml = (value: any) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getMonthLabel = (monthValue: string) => {
  const cleanMonth = String(monthValue ?? "").trim();

  if (!cleanMonth) return "Todos os meses";

  try {
    return new Date(`${cleanMonth}-01T12:00:00`).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return cleanMonth;
  }
};

const slugify = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const getTipoLabel = (tipo: any) => {
  const safeTipo = String(tipo ?? "").toLowerCase();

  if (safeTipo === "receita") return "Receita";
  if (safeTipo === "despesa") return "Despesa";
  if (safeTipo === "transferencia") return "Transferência";

  return "Lançamento";
};

const getTipoClass = (tipo: any) => {
  const safeTipo = String(tipo ?? "").toLowerCase();

  if (safeTipo === "receita") return "type-income";
  if (safeTipo === "despesa") return "type-expense";
  if (safeTipo === "transferencia") return "type-transfer";

  return "type-neutral";
};

const getTipoBadgeSvg = (tipoLabel: string, tipoClass: string) => {
  const label = escapeHtml(String(tipoLabel ?? "").toUpperCase());

  const styles =
    tipoClass === "type-income"
      ? {
          fill: "#ecfdf5",
          stroke: "#a7f3d0",
          color: "#047857",
        }
      : tipoClass === "type-expense"
      ? {
          fill: "#fff1f2",
          stroke: "#fecdd3",
          color: "#be123c",
        }
      : tipoClass === "type-transfer"
      ? {
          fill: "#eef2ff",
          stroke: "#c7d2fe",
          color: "#4f46e5",
        }
      : {
          fill: "#f8fafc",
          stroke: "#e2e8f0",
          color: "#475569",
        };

  return `
    <svg class="type-badge-svg" width="112" height="28" viewBox="0 0 112 28" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="110" height="26" rx="13" fill="${styles.fill}" stroke="${styles.stroke}" stroke-width="1" />
      <text
        x="56"
        y="14"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="Arial, sans-serif"
        font-size="9"
        font-weight="900"
        letter-spacing="0.7"
        fill="${styles.color}"
      >${label}</text>
    </svg>
  `;
};

const getValorTransacao = (tx: any) => {
  const tipo = String(tx?.tipo ?? "").toLowerCase();
  const valor = Number(tx?.valor ?? 0);

  if (tipo === "despesa") return -Math.abs(valor);
  if (tipo === "receita") return Math.abs(valor);

  return valor;
};

export const printTransacoesPdfReport = ({
  transacoes,
  filtroMes,
  contaLabel,
  lancamentoLabel,
  categoriaLabel,
  tipoGastoLabel,
  buscaLabel,
  organizacaoLabel,
  totalReceitas,
  totalDespesas,
  saldoTotal,
  formatarMoeda,
  formatarData,
  getContaLabelByTransaction,
  toastCompact,
}: PrintTransacoesPdfReportParams) => {
  const mesLabel = getMonthLabel(filtroMes);
  const transacoesSafe = Array.isArray(transacoes) ? transacoes : [];

  const rowsHtml = transacoesSafe
    .map((tx: any) => {
      const tipo = String(tx?.tipo ?? "").toLowerCase();
      const tipoLabel = getTipoLabel(tipo);
      const tipoClass = getTipoClass(tipo);
      const valor = getValorTransacao(tx);
      const valorAbs = Math.abs(Number(valor ?? 0));
      const valorPrefix = tipo === "receita" ? "+" : tipo === "despesa" ? "-" : "";
      const conta = getContaLabelByTransaction(tx);
      const categoria = String(tx?.categoria ?? "").trim();
      const tipoGasto = String(tx?.tipoGasto ?? "").trim();
      const tag = String(tx?.tag ?? tx?.tagCC ?? tx?.payload?.tag ?? "").trim();

const meta = [
  formatarData(tx?.data),
  tx?._reportMeta || conta,
  categoria,
  tipoGasto,
  tag,
]
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .join(" • ");

      return `
        <tr>
          <td>
<div class="transaction-title">
  ${getTipoBadgeSvg(tipoLabel, tipoClass)}
  <strong>${escapeHtml(tx?.descricao ?? "Lançamento")}</strong>
</div>
            <div class="muted">${escapeHtml(meta)}</div>
          </td>

          <td class="value ${tipoClass}">
            ${escapeHtml(`${valorPrefix}${formatarMoeda(valorAbs)}`)}
          </td>
        </tr>
      `;
    })
    .join("");

  const reportHtml = `
    <div class="pdf-page">
      <style>
        * {
          box-sizing: border-box;
        }

        .pdf-page {
          width: 794px;
          min-height: 1123px;
          padding: 34px;
          font-family: Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }

        .brand {
          display: flex;
          align-items: center;
        }

        .brand-logo {
          height: 46px;
          width: auto;
          display: block;
        }

        .report-title {
          text-align: right;
        }

        .report-title h1 {
          margin: 0;
          font-size: 18px;
          color: #0f172a;
        }

        .report-title p {
          margin: 5px 0 0;
          font-size: 11px;
          color: #64748b;
        }

        .summary {
          display: grid;
          grid-template-columns: 1.1fr 1fr 1fr 0.75fr;
          gap: 12px;
          margin-bottom: 18px;
        }

        .summary-card {
          border: 1px solid #4600ac;
          border-radius: 16px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #220055 0%, #4600ac 100%);
          box-shadow: 0 8px 24px rgba(70, 0, 172, 0.18);
          min-height: 70px;
        }

        .summary-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 3px;
        }

        .summary-card span {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.78);
          font-weight: 800;
          margin: 0;
          white-space: nowrap;
        }

        .summary-card strong {
          font-size: 17px;
          color: #ffffff;
          font-weight: 900;
          line-height: 1.1;
          white-space: nowrap;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 18px;
          background: #ffffff;
        }

        .filter-chip {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 2px;
          min-height: 46px;
          padding: 8px 14px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 11px;
          color: #334155;
        }

        .filter-chip strong {
          color: #4600ac;
          font-weight: 800;
          font-size: 10px;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .filter-chip span {
          color: #475569;
          font-size: 11px;
          line-height: 1.15;
          white-space: nowrap;
        }

        .transactions-card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          background: #ffffff;
        }

        .transactions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
        }

        .transactions-header h2 {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
        }

        .transactions-header span {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        td {
          padding: 10px 14px;
          border-bottom: 1px solid #edf2f7;
          vertical-align: top;
          font-size: 11px;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        tr:last-child td {
          border-bottom: none;
        }

.transaction-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
  line-height: 1;
}

.type-badge-svg {
  display: block;
  flex: 0 0 auto;
}

        .type-income {
          color: #047857;
        }

        .type-expense {
          color: #be123c;
        }

        .type-transfer {
          color: #4f46e5;
        }

        .type-neutral {
          color: #475569;
        }

        .type-pill.type-income {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
        }

        .type-pill.type-expense {
          background: #fff1f2;
          border: 1px solid #fecdd3;
        }

        .type-pill.type-transfer {
          background: #eef2ff;
          border: 1px solid #c7d2fe;
        }

        .value {
          width: 130px;
          text-align: right;
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
          font-size: 12px;
        }

        .muted {
          color: #64748b;
          font-size: 10px;
          margin-top: 3px;
        }

        .empty-state {
          padding: 28px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }

        .footer {
          margin-top: 22px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          color: #94a3b8;
          font-size: 9px;
          text-align: center;
        }
      </style>

      <header class="header">
        <div class="brand">
          <img class="brand-logo" src="/logo_tela_do_app.svg" alt="FluxMoney" />
        </div>

        <div class="report-title">
          <h1>Relatório de transações</h1>
          <p>Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
        </div>
      </header>

      <section class="summary">
        <div class="summary-card">
          <div class="summary-row">
            <span>Saldo atual</span>
            <strong>${escapeHtml(formatarMoeda(saldoTotal))}</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-row">
            <span>Receitas</span>
            <strong>${escapeHtml(formatarMoeda(totalReceitas))}</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-row">
            <span>Despesas</span>
            <strong>${escapeHtml(formatarMoeda(totalDespesas))}</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-row">
            <span>Itens</span>
            <strong>${transacoesSafe.length}</strong>
          </div>
        </div>
      </section>

      <section class="filters">
        <div class="filter-chip">
          <strong>Mês</strong>
          <span>${escapeHtml(mesLabel)}</span>
        </div>

        <div class="filter-chip">
          <strong>Conta</strong>
          <span>${escapeHtml(contaLabel)}</span>
        </div>

        <div class="filter-chip">
          <strong>Lançamento</strong>
          <span>${escapeHtml(lancamentoLabel)}</span>
        </div>

        <div class="filter-chip">
          <strong>Categoria</strong>
          <span>${escapeHtml(categoriaLabel)}</span>
        </div>

        <div class="filter-chip">
          <strong>Tipo gasto</strong>
          <span>${escapeHtml(tipoGastoLabel)}</span>
        </div>

        <div class="filter-chip">
          <strong>Busca</strong>
          <span>${escapeHtml(buscaLabel)}</span>
        </div>

        <div class="filter-chip">
          <strong>Organização</strong>
          <span>${escapeHtml(organizacaoLabel)}</span>
        </div>
      </section>

      <section class="transactions-card">
        <div class="transactions-header">
          <span>${transacoesSafe.length} lançamentos encontrados</span>
        </div>

        ${
          rowsHtml
            ? `<table><tbody>${rowsHtml}</tbody></table>`
            : `<div class="empty-state">Nenhum lançamento encontrado para os filtros selecionados.</div>`
        }
      </section>

      <footer class="footer">
        Relatório gerado pelo FluxMoney com base nos filtros selecionados na tela de transações.
      </footer>
    </div>
  `;

  const container = document.createElement("div");

  container.innerHTML = reportHtml;
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";

  document.body.appendChild(container);

  const pdfElement = container.querySelector(".pdf-page") as HTMLElement | null;

  if (!pdfElement) {
    document.body.removeChild(container);
    toastCompact?.("Não foi possível preparar o relatório.", "error");
    return;
  }

  const fileMonth = String(filtroMes ?? "").trim() || "todos-os-meses";
  const fileConta = slugify(contaLabel) || "geral";

  const images = Array.from(pdfElement.querySelectorAll("img"));

  Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }

          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  )
    .then(() => {
      const pdfOptions = {
        margin: 0,
        filename: `relatorio-transacoes-fluxmoney-${fileMonth}-${fileConta}.pdf`,
        image: {
          type: "jpeg",
          quality: 0.98,
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
        },
        jsPDF: {
          unit: "px",
          format: [794, 1123],
          orientation: "portrait",
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: ["tr", "td", ".transactions-header", ".summary", ".filters"],
        },
      } as any;

      return html2pdf().set(pdfOptions).from(pdfElement).save();
    })
    .catch(() => {
      toastCompact?.("Não foi possível gerar o PDF agora.", "error");
    })
    .finally(() => {
      document.body.removeChild(container);
    });
};