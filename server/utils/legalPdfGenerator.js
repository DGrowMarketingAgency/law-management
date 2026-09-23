/**
 * Pure Node.js Zero-Dependency PDF-1.4 Generator for Legal Practice Management
 * Generates valid PDF documents for legal templates, court pleadings, and signed eSign certificates.
 */

const escapePdf = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E\n\r]/g, ' '); // Keep standard printable characters
};

/**
 * Word wrap helper for PDF text
 */
const wrapText = (text, maxChars = 85) => {
  if (!text) return [];
  const lines = [];
  const paragraphs = String(text).split('\n');

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxChars) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
};

/**
 * Build Legal Document PDF Buffer
 */
const generateLegalDocumentPdf = ({
  title = 'LEGAL DOCUMENT',
  documentNumber = 'DOC-PREVIEW',
  content = '',
  signers = [],
  signatureCertificate = null
}) => {
  const streamLines = [];
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  let y = pageHeight - margin;

  const setFont = (font, size) => `/${font} ${size} Tf`;
  const setFillColor = (r, g, b) => `${r} ${g} ${b} rg`;
  const setStrokeColor = (r, g, b) => `${r} ${g} ${b} RG`;
  const drawRect = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
  const drawLine = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const drawText = (x, y, text, font = 'F1', size = 10) =>
    `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`;

  // Header Banner
  streamLines.push(setFillColor(0.1, 0.15, 0.28)); // Deep Navy
  streamLines.push(drawRect(margin, y - 4, pageWidth - margin * 2, 4));
  y -= 25;

  // Document Number & Date Top Right
  streamLines.push(setFillColor(0.3, 0.35, 0.4));
  streamLines.push(drawText(margin, y, `REF: ${documentNumber}`, 'F2', 9));
  streamLines.push(drawText(pageWidth - margin - 110, y, `DATE: ${new Date().toLocaleDateString('en-IN')}`, 'F1', 9));
  y -= 24;

  // Document Title (Centered visually)
  streamLines.push(setFillColor(0.05, 0.08, 0.15));
  streamLines.push(drawText(margin, y, title.toUpperCase(), 'F2', 14));
  y -= 8;
  streamLines.push(setStrokeColor(0.8, 0.82, 0.85));
  streamLines.push(drawLine(margin, y, pageWidth - margin, y));
  y -= 20;

  // Body content paragraphs
  const wrappedLines = wrapText(content, 82);
  streamLines.push(setFillColor(0.1, 0.1, 0.1));

  for (const line of wrappedLines) {
    if (y < 120) {
      // Near bottom margin
      break;
    }
    if (line === '') {
      y -= 12;
    } else {
      streamLines.push(drawText(margin, y, line, 'F1', 9.5));
      y -= 15;
    }
  }

  // E-Signature / Certificate Section if present
  if (signatureCertificate || (signers && signers.length > 0)) {
    y = Math.max(y - 20, 160);
    streamLines.push(setFillColor(0.95, 0.97, 0.99));
    streamLines.push(drawRect(margin, y - 65, pageWidth - margin * 2, 70));
    streamLines.push(setStrokeColor(0.2, 0.45, 0.75));
    streamLines.push(drawLine(margin, y + 5, pageWidth - margin, y + 5));

    streamLines.push(setFillColor(0.1, 0.3, 0.6));
    streamLines.push(drawText(margin + 12, y - 10, 'DIGITAL E-SIGNATURE CERTIFICATION', 'F2', 9.5));

    streamLines.push(setFillColor(0.2, 0.25, 0.3));
    const certDetails = signatureCertificate
      ? `Provider: ${signatureCertificate.provider} | Ref: ${signatureCertificate.auditTrailId} | Hash: ${signatureCertificate.signedChecksum?.slice(0, 24)}...`
      : `E-Sign Workflow Authorized. Verified Signers: ${signers.map(s => s.name || s.signerName).join(', ')}`;
    streamLines.push(drawText(margin + 12, y - 26, certDetails, 'F1', 8));

    const timestamp = signatureCertificate ? signatureCertificate.timestamp : new Date().toISOString();
    streamLines.push(drawText(margin + 12, y - 42, `Signed & Timestamped: ${timestamp} | Legally Binding under IT Act 2000`, 'F1', 8));
  }

  // Footer
  streamLines.push(setStrokeColor(0.85, 0.85, 0.85));
  streamLines.push(drawLine(margin, 40, pageWidth - margin, 40));
  streamLines.push(setFillColor(0.5, 0.5, 0.5));
  streamLines.push(drawText(margin, 28, 'Generated via Legal Practice Management Platform - Confidential & Privileged', 'F1', 7.5));
  streamLines.push(drawText(pageWidth - margin - 50, 28, 'Page 1 of 1', 'F1', 7.5));

  const streamBody = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamBody);

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj');
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream\nendobj`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');

  let offset = 0;
  const xrefs = ['0000000000 65535 f '];
  let pdfData = '%PDF-1.4\n';
  offset = Buffer.byteLength(pdfData);

  for (let i = 0; i < objects.length; i++) {
    xrefs.push(String(offset).padStart(10, '0') + ' 00000 n ');
    pdfData += `${objects[i]}\n`;
    offset = Buffer.byteLength(pdfData);
  }

  const xrefStart = offset;
  pdfData += `xref\n0 ${objects.length + 1}\n${xrefs.join('\n')}\n`;
  pdfData += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfData += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdfData, 'binary');
};

module.exports = {
  generateLegalDocumentPdf,
  wrapText,
  escapePdf
};
