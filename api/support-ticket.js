const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const sanitizeText = (value, maxLength = 2000) => {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const getBase64Payload = (dataUrl) => {
  const value = String(dataUrl ?? "");
  const commaIndex = value.indexOf(",");

  if (commaIndex === -1) return value.trim();

  return value.slice(commaIndex + 1).trim();
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return res.status(500).json({
      error: "Configuração de envio ausente.",
    });
  }

  try {
    const body = req.body ?? {};

    const nome = sanitizeText(body.nome, 120);
    const email = sanitizeText(body.email, 180).toLowerCase();
    const whatsapp = sanitizeText(body.whatsapp, 40);
    const mensagem = sanitizeText(body.mensagem, 5000);
    const userId = sanitizeText(body.userId, 120);
    const userEmail = sanitizeText(body.userEmail, 180);
    const pageUrl = sanitizeText(body.pageUrl, 500);
    const userAgent = sanitizeText(body.userAgent, 500);
    const createdAt = sanitizeText(body.createdAt, 80);

    if (!nome) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido." });
    }

    if (!mensagem || mensagem.length < 10) {
      return res.status(400).json({
        error: "Descreva sua dúvida ou problema com mais detalhes.",
      });
    }

    const attachment = body.attachment ?? null;
    const attachments = [];

    if (attachment) {
      const attachmentName = sanitizeText(attachment.name, 180) || "anexo";
      const attachmentType = sanitizeText(attachment.type, 80);
      const attachmentSize = Number(attachment.size ?? 0);

      if (!ALLOWED_ATTACHMENT_TYPES.has(attachmentType)) {
        return res.status(400).json({
          error: "Tipo de anexo não permitido.",
        });
      }

      if (!Number.isFinite(attachmentSize) || attachmentSize > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({
          error: "O anexo deve ter no máximo 3MB.",
        });
      }

      const content = getBase64Payload(attachment.content);

      if (!content) {
        return res.status(400).json({
          error: "Anexo inválido.",
        });
      }

      attachments.push({
        filename: attachmentName,
        content,
      });
    }

    const subject = `Novo suporte FluxMoney — ${nome}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin: 0 0 16px;">Novo ticket de suporte FluxMoney</h2>

        <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>WhatsApp:</strong> ${escapeHtml(whatsapp || "Não informado")}</p>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

        <p><strong>Mensagem:</strong></p>
        <div style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
          ${escapeHtml(mensagem)}
        </div>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

        <p><strong>User ID:</strong> ${escapeHtml(userId || "Não informado")}</p>
        <p><strong>Email logado:</strong> ${escapeHtml(userEmail || "Não informado")}</p>
        <p><strong>URL:</strong> ${escapeHtml(pageUrl || "Não informado")}</p>
        <p><strong>Data:</strong> ${escapeHtml(createdAt || new Date().toISOString())}</p>
        <p><strong>User Agent:</strong> ${escapeHtml(userAgent || "Não informado")}</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FluxMoney Suporte <contato@suporte.fluxmoneyapp.com.br>",
        to: ["contato@fluxmoneyapp.com.br"],
        reply_to: email,
        subject,
        html,
        attachments,
      }),
    });

    const resendData = await resendResponse.json().catch(() => null);

    if (!resendResponse.ok) {
      console.error("RESEND_SUPPORT_TICKET_ERROR", resendData);

      return res.status(502).json({
        error: "Não foi possível enviar o ticket agora.",
      });
    }

    return res.status(200).json({
      ok: true,
      id: resendData?.id ?? null,
    });
  } catch (err) {
    console.error("SUPPORT_TICKET_ERROR", err);

    return res.status(500).json({
      error: "Erro interno ao enviar suporte.",
    });
  }
};