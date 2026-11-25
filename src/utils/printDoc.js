import { fmtMinSec } from "./clock.js";
// Shared plumbing for the printable exports.
//
// Rather than pull in a PDF library, we render a self-contained HTML document
// into a hidden iframe and trigger the browser's print dialog — every platform's
// dialog offers "Save as PDF", including mobile Safari and Chrome. Keeps the
// prototype dep-free.
//
// The athlete's race plan (planPdf.js) and the crew sheet (crewPdf.js) are two
// documents for two readers, but they should look like they came from the same
// organisation, so the escaping, the formatters and the stylesheet live here.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function fmtPace(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return "—";
  return `${fmtMinSec(minPerKm)}/km`;
}

export function fmtDuration(min) {
  if (min == null || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

// Print-document stylesheet. Light theme by design — this is paper, not the app.
export const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 28px 26px; }
  h1 { font-family: Arial, sans-serif; font-size: 24px; margin: 0 0 2px; }
  h2 { font-family: Arial, sans-serif; font-size: 15px; letter-spacing: 0.4px; text-transform: uppercase; color: #8a6d20; border-bottom: 1.5px solid #d8cfa8; padding-bottom: 5px; margin: 26px 0 10px; }
  .sub { font-family: 'Courier New', monospace; font-size: 12px; color: #666; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { font-family: Arial, sans-serif; text-align: left; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr.total td { font-family: Arial, sans-serif; font-weight: bold; border-top: 1.5px solid #ccc; border-bottom: none; }
  .muted { color: #999; font-size: 11px; }
  .warn { color: #c0392b; font-weight: bold; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .grid div { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 5px 0; font-size: 12.5px; }
  .grid div span:first-child { color: #888; font-family: Arial, sans-serif; font-size: 11px; }
  .recs { padding-left: 18px; }
  .recs li { margin-bottom: 10px; font-size: 13px; }
  .rationale { font-size: 12.5px; color: #444; margin-top: 8px; line-height: 1.5; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
`;

/*
  Render `html` into a hidden iframe and open the print dialog.

  The iframe is torn down on afterprint, with a timed fallback for the browsers
  that never fire it (and for a user who dismisses the dialog).
*/
export function printDocument(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
  // Give the iframe a tick to lay out before printing; clean up after the dialog.
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.onafterprint = cleanup;
    iframe.contentWindow.print();
    setTimeout(cleanup, 60000); // fallback cleanup if onafterprint never fires
  }, 300);
}
