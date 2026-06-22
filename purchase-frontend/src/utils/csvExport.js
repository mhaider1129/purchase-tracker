export const UTF8_BOM = '\uFEFF';

export const toCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export const buildCsvContent = (rows) => rows
  .map((row) => row.map(toCsvValue).join(','))
  .join('\r\n');

export const buildExcelCsvBlob = (rows) => new Blob([UTF8_BOM, buildCsvContent(rows)], {
  type: 'text/csv;charset=utf-8;',
});