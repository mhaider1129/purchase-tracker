import { buildExcelHtmlContent, escapeHtml } from './excelHtmlExport';

test('escapes values before placing them in the Excel HTML table', () => {
  expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('builds an Excel-readable table with centered headers and cells', () => {
  const html = buildExcelHtmlContent([
    ['الرقم', 'القسم'],
    [299, 'الصيانة'],
  ], { sheetName: 'طلبات الصيانة', rtl: true });

  expect(html).toContain('<th>الرقم</th>');
  expect(html).toContain('<td>الصيانة</td>');
  expect(html).toContain('text-align: center');
  expect(html).toContain('white-space: nowrap');
  expect(html).toContain('dir="rtl"');
});