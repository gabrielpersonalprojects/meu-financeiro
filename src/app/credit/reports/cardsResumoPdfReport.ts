import html2pdf from "html2pdf.js";

type CardsResumoOption = {
  value: string;
  label: string;
};

type PrintCardsResumoPdfReportParams = {
  cardsResumoAgrupado: any[];
  cardsResumoFiltradas: any[];
  cardsResumoTotalGeral: number;
  cardsResumoMes: string;
  cardsResumoCartao: string;
  cardsResumoCategoria: string;
  cardsResumoTag: string;
  cardsResumoBusca: string;
  cardsResumoCartoesOptions: CardsResumoOption[];
  formatarMoeda: (value: number) => string;
  formatarData: (value: any) => string;
  categoriaResumoCartoesLabel: (value: any) => string;
  toastCompact: (message: string, kind?: "error") => unknown;
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

  if (!cleanMonth) {
    return "Todos os meses";
  }

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

export const printCardsResumoPdfReport = ({
  cardsResumoAgrupado,
  cardsResumoFiltradas,
  cardsResumoTotalGeral,
  cardsResumoMes,
  cardsResumoCartao,
  cardsResumoCategoria,
  cardsResumoTag,
  cardsResumoBusca,
  cardsResumoCartoesOptions,
  formatarMoeda,
  formatarData,
  categoriaResumoCartoesLabel,
  toastCompact,
}: PrintCardsResumoPdfReportParams) => {
  const mesLabel = getMonthLabel(cardsResumoMes);

  const cartaoLabel =
    cardsResumoCartoesOptions.find(
      (option) =>
        String(option.value ?? "").trim() ===
        String(cardsResumoCartao ?? "todos").trim()
    )?.label ?? "Todos os cartões";

  const categoriaLabel =
    cardsResumoCategoria === "todas"
      ? "Todas as categorias"
      : cardsResumoCategoria;

  const tagLabel =
    cardsResumoTag === "todas" ? "Todas as tags" : cardsResumoTag;

  const buscaLabel = String(cardsResumoBusca ?? "").trim()
    ? String(cardsResumoBusca ?? "").trim()
    : "Sem busca aplicada";

  const gruposHtml = (cardsResumoAgrupado ?? [])
    .map((grupo: any) => {
      const itensHtml = (grupo.itens ?? [])
        .map((item: any) => {
          const descricao = escapeHtml(item?.descricao ?? "Lançamento");
          const data = escapeHtml(formatarData(item?.data));
          const categoria = escapeHtml(
            categoriaResumoCartoesLabel(item?.categoria)
          );
          const tag = escapeHtml(String(item?.tag ?? "").trim());
          const valor = escapeHtml(
            formatarMoeda(Math.abs(Number(item?.valor ?? 0)))
          );

          return `
            <tr>
              <td>
                <strong>${descricao}</strong>
                <div class="muted">
                  ${data}${categoria ? ` • ${categoria}` : ""}${tag ? ` • ${tag}` : ""}
                </div>
              </td>
              <td class="value">${valor}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="card-group">
          <div class="card-group-header">
            <div>
              <h2>${escapeHtml(grupo.cartaoNome)}</h2>
              <div class="muted">
                ${escapeHtml(String(grupo.perfil ?? "").toUpperCase())}
                ${grupo.cartaoCategoria ? ` • ${escapeHtml(grupo.cartaoCategoria)}` : ""}
              </div>
            </div>

            <div class="group-total">
              ${escapeHtml(formatarMoeda(Number(grupo.total ?? 0)))}
            </div>
          </div>

          <table>
            <tbody>
              ${itensHtml}
            </tbody>
          </table>
        </section>
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
  grid-template-columns: 1.15fr 0.7fr 1fr 1.35fr;
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

.filters-title {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: 4px;
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
        .card-group {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 16px;
          background: #ffffff;
        }

        .card-group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
        }

        .card-group-header h2 {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
        }

        .group-total {
          font-size: 15px;
          font-weight: 900;
          color: #4600ac;
          white-space: nowrap;
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
  padding: 9px 14px;
  border-bottom: 1px solid #edf2f7;
  vertical-align: top;
  font-size: 11px;
  break-inside: avoid;
  page-break-inside: avoid;
}

tr:last-child td {
  border-bottom: none;
}

        .value {
          width: 120px;
          text-align: right;
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
        }

        .muted {
          color: #64748b;
          font-size: 10px;
          margin-top: 3px;
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
          <h1>Relatório de cartões</h1>
          <p>Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
        </div>
      </header>

<section class="summary">
  <div class="summary-card">
    <div class="summary-row">
      <span>Total filtrado</span>
      <strong>${escapeHtml(formatarMoeda(cardsResumoTotalGeral))}</strong>
    </div>
  </div>

  <div class="summary-card">
    <div class="summary-row">
      <span>Itens</span>
      <strong>${cardsResumoFiltradas.length}</strong>
    </div>
  </div>

  <div class="summary-card">
    <div class="summary-row">
      <span>Mês</span>
      <strong>${escapeHtml(mesLabel)}</strong>
    </div>
  </div>

  <div class="summary-card">
    <div class="summary-row">
      <span>Cartão</span>
      <strong>${escapeHtml(cartaoLabel)}</strong>
    </div>
  </div>
</section>

<section class="filters">

  <div class="filter-chip">
    <strong>Categoria</strong>
    <span>${escapeHtml(categoriaLabel)}</span>
  </div>

  <div class="filter-chip">
    <strong>Tag</strong>
    <span>${escapeHtml(tagLabel)}</span>
  </div>

  <div class="filter-chip">
    <strong>Busca</strong>
    <span>${escapeHtml(buscaLabel)}</span>
  </div>
</section>

      ${
        gruposHtml ||
        "<p>Nenhum lançamento encontrado para os filtros selecionados.</p>"
      }

      <footer class="footer">
        Relatório gerado pelo FluxMoney com base nos filtros selecionados no resumo de cartões.
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
    toastCompact("Não foi possível preparar o relatório.", "error");
    return;
  }

  const fileMonth = String(cardsResumoMes ?? "").trim() || "todos-os-meses";
  const fileCard = slugify(cartaoLabel) || "todos-os-cartoes";

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
        filename: `relatorio-cartoes-fluxmoney-${fileMonth}-${fileCard}.pdf`,
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
          avoid: ["tr", "td", ".card-group-header", ".summary", ".filters"],
        },
      } as any;

      return html2pdf()
        .set(pdfOptions)
        .from(pdfElement)
        .save();
    })
    .catch(() => {
      toastCompact("Não foi possível gerar o PDF agora.", "error");
    })
    .finally(() => {
      document.body.removeChild(container);
    });
};