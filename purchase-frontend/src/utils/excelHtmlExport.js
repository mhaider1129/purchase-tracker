const EXCEL_MIME_TYPE = 'application/vnd.ms-excel;charset=utf-8;';
const HTML_EXCEL_BOM = '\uFEFF';

const escapeHtml = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const buildExcelHtmlContent = (rows, options = {}) => {
  const { sheetName = 'Export', rtl = false } = options;
  const direction = rtl ? 'rtl' : 'ltr';
  const textAlign = rtl ? 'right' : 'left';

  const [headers = [], ...bodyRows] = rows;
  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');
  const bodyHtml = bodyRows
    .map((row) => (
      `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
    ))
    .join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    table { border-collapse: collapse; direction: ${direction}; }
    th, td { border: 1px solid #9ca3af; padding: 8px 10px; mso-number-format: '\\@'; text-align: center; vertical-align: middle; white-space: nowrap; }
    th { background: #dbeafe; font-weight: 700; text-align: center; }
    td.text-cell { text-align: ${textAlign}; white-space: normal; }
  </style>
</head>
<body dir="${direction}">
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
</body>
</html>`;
};

export const buildExcelHtmlBlob = (rows, options) => new Blob(
  [HTML_EXCEL_BOM, buildExcelHtmlContent(rows, options)],
  { type: EXCEL_MIME_TYPE },
);

export { escapeHtml };