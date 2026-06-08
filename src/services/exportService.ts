const CARD_NUMBER_HEADER_PATTERN = /(kort|card)/i;

function normalizeString(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function ensureXlsxExtension(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return 'export.xlsx';
  return trimmed.toLowerCase().endsWith('.xlsx') ? trimmed : `${trimmed}.xlsx`;
}

function shouldForceText(header: string, value: string): boolean {
  if (!CARD_NUMBER_HEADER_PATTERN.test(header)) return false;
  const digits = value.replace(/\D+/g, '');
  return digits.length >= 16;
}

export function formatCsvCell(header: string, value: string | undefined | null): string {
  let cellValue = normalizeString(value);
  if (shouldForceText(header, cellValue)) {
    if (!cellValue.startsWith("'")) {
      cellValue = `'${cellValue}`;
    }
  }

  const needsQuotes = /[;\n"]/.test(cellValue);
  if (needsQuotes) {
    const escaped = cellValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return cellValue;
}

export function buildCsvContent(
  rows: Array<Record<string, string>>,
  headers?: string[]
): string {
  if (rows.length === 0) return '';
  const columns = headers && headers.length > 0 ? headers : Object.keys(rows[0]);
  const lines = [
    columns.join(';'),
    ...rows.map(row => columns.map(h => formatCsvCell(h, row[h])).join(';')),
  ];
  // BOM for Excel UTF-8 compatibility
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadCsv(
  rows: Array<Record<string, string>>,
  filename: string,
  headers?: string[]
): void {
  if (rows.length === 0) return;
  const csvContent = buildCsvContent(rows, headers);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 0);
  };

  const handlePrint = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
      const afterPrint = () => {
        win.removeEventListener('afterprint', afterPrint);
        cleanup();
      };
      win.addEventListener('afterprint', afterPrint);
      setTimeout(() => {
        win.removeEventListener('afterprint', afterPrint);
        cleanup();
      }, 1000);
    } catch {
      cleanup();
    }
  };

  try {
    if ('srcdoc' in iframe) {
      iframe.srcdoc = html;
      iframe.onload = handlePrint;
      return;
    }
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = handlePrint;
  } catch {
    cleanup();
  }
}

export async function downloadXlsx(
  rows: Array<Record<string, string>>,
  filename: string,
  headers?: string[],
  sheetName: string = 'Export'
): Promise<void> {
  if (rows.length === 0) return;
  const XLSXModule = await import('xlsx');
  const XLSX = (XLSXModule as any).default ?? XLSXModule;
  const columns = headers && headers.length > 0 ? headers : Object.keys(rows[0]);
  const data = [
    columns,
    ...rows.map(row => columns.map(h => normalizeString(row[h]))),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const cardColumnIndexes = columns
    .map((header, index) => (CARD_NUMBER_HEADER_PATTERN.test(header) ? index : -1))
    .filter(index => index >= 0);

  if (cardColumnIndexes.length > 0) {
    for (let r = 1; r < data.length; r += 1) {
      for (const c of cardColumnIndexes) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[addr];
        if (!cell) continue;
        cell.t = 's';
        cell.z = '@';
        cell.v = normalizeString(data[r][c]);
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = ensureXlsxExtension(filename);
  link.click();
  URL.revokeObjectURL(url);
}
