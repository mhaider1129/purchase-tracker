export const EXCEL_WORKBOOK_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Load the workbook writer only when an export is requested.
export const buildExcelWorkbookBlob = async (rows, { sheetName = 'Export', rtl = false } = {}) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: rtl }] });
  sheet.addRows(rows);
  sheet.eachRow((row, index) => {
    row.eachCell((cell) => {
      cell.alignment = { horizontal: rtl ? 'right' : 'left', vertical: 'top', wrapText: true };
      if (index === 1) cell.font = { bold: true };
    });
  });
  sheet.columns.forEach((column) => { column.width = 25; });
  sheet.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }];
  return new Blob([await workbook.xlsx.writeBuffer()], { type: EXCEL_WORKBOOK_MIME });
};
