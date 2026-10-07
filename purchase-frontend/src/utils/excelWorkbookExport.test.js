import ExcelJS from 'exceljs';
import { buildExcelWorkbookBlob, EXCEL_WORKBOOK_MIME } from './excelWorkbookExport';

const readBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsArrayBuffer(blob);
});

test('writes a genuine XLSX with Arabic text, RTL, numeric values and literal formula-like text', async () => {
  const blob = await buildExcelWorkbookBlob([
    ['الطلب', 'المرحلة الحالية للموافقة'],
    [478, 'المستوى 4 – بانتظار أحمد'],
    [479, '=1+1'],
  ], { sheetName: 'طلبات الصيانة', rtl: true });
  expect(blob.type).toBe(EXCEL_WORKBOOK_MIME);
  const data = await readBlob(blob);
  expect(Array.from(new Uint8Array(data).slice(0, 2))).toEqual([80, 75]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheet = workbook.getWorksheet('طلبات الصيانة');
  expect(sheet.getCell('A2').value).toBe(478);
  expect(sheet.getCell('B1').value).toBe('المرحلة الحالية للموافقة');
  expect(sheet.getCell('B2').value).toBe('المستوى 4 – بانتظار أحمد');
  expect(sheet.getCell('B3').value).toBe('=1+1');
  expect(sheet.views[0].rightToLeft).toBe(true);
});
