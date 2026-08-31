import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const input = path.join(root, "docs", "nimble-whatsapp-api.md");
const htmlPath = path.join(root, "docs", ".nimble-whatsapp-api.print.html");
const output = path.join(root, "docs", "fluxmoney-nimble-api-whatsapp.pdf");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const escape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (value) => escape(value).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const lines = readFileSync(input, "utf8").split(/\r?\n/);
let html = "";
let code = false;
let codeLines = [];
let list = false;
let table = false;
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (line.startsWith("```")) {
    if (!code) { code = true; codeLines = []; }
    else { html += `<pre><code>${escape(codeLines.join("\n"))}</code></pre>`; code = false; }
    continue;
  }
  if (code) { codeLines.push(line); continue; }
  if (list && !/^\s*- /.test(line)) { html += "</ul>"; list = false; }
  if (table && !line.startsWith("|")) { html += "</tbody></table>"; table = false; }
  const heading = line.match(/^(#{1,4})\s+(.+)$/);
  if (heading) { const level = heading[1].length; html += `<h${level}>${inline(heading[2])}</h${level}>`; continue; }
  if (/^\s*- /.test(line)) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inline(line.replace(/^\s*- /, ""))}</li>`; continue; }
  if (line.startsWith("|")) {
    if (/^\|[\s:|-]+\|$/.test(line)) continue;
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    if (!table) { html += `<table><thead><tr>${cells.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>`; table = true; }
    else html += `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`;
    continue;
  }
  if (line.startsWith(">")) { html += `<aside>${inline(line.replace(/^>\s?/, ""))}</aside>`; continue; }
  if (line.trim()) html += `<p>${inline(line)}</p>`;
}
if (list) html += "</ul>";
if (table) html += "</tbody></table>";

const document = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm 14mm 17mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:9.2pt;line-height:1.38}h1{font-size:22pt;color:#173f5f;border-bottom:3px solid #21a179;padding-bottom:8px}h2{font-size:15pt;color:#173f5f;border-bottom:1px solid #bdd8d0;padding-bottom:4px;break-after:avoid}h3{font-size:11.5pt;color:#176b5b;break-after:avoid}h4{font-size:10pt}p{margin:5px 0}ul{margin:5px 0 8px;padding-left:20px}li{margin:2px 0}code{font-family:Consolas,monospace;background:#eef4f3;padding:1px 3px;border-radius:3px}pre{font-size:7.2pt;line-height:1.28;background:#102331;color:#f4fbfa;padding:9px;border-radius:6px;white-space:pre-wrap;word-break:break-word;break-inside:avoid}pre code{background:none;padding:0}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:7.4pt}th{background:#173f5f;color:white}th,td{border:1px solid #aebdc5;padding:4px;vertical-align:top}tr{break-inside:avoid}aside{display:block;background:#edf8f4;border-left:4px solid #21a179;padding:6px 9px;margin:5px 0;font-weight:600}h1,h2,h3,pre,table{break-inside:avoid}footer{position:fixed;bottom:-10mm;right:0;font-size:7pt;color:#687783}
</style></head><body>${html}<footer>FluxMoney + Nimble · versão 26/08/2026</footer></body></html>`;
writeFileSync(htmlPath, document, "utf8");
const result = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${output}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "inherit" });
if (process.env.KEEP_PRINT_HTML !== "1") unlinkSync(htmlPath);
if (result.status !== 0) process.exit(result.status || 1);
