import { buildCsvContent, UTF8_BOM, toCsvValue } from './csvExport';

test('escapes csv values that contain separators, quotes, or newlines', () => {
  expect(toCsvValue('Arabic, English')).toBe('"Arabic, English"');
  expect(toCsvValue('He said "مرحبا"')).toBe('"He said ""مرحبا"""');
  expect(toCsvValue('line 1\nline 2')).toBe('"line 1\nline 2"');
});

test('builds csv content with CRLF rows for Excel compatibility', () => {
  expect(buildCsvContent([
    ['الرقم', 'القسم'],
    [299, 'الصيانة'],
  ])).toBe('الرقم,القسم\r\n299,الصيانة');
});

test('exports the UTF-8 BOM used by Excel to detect Arabic correctly', () => {
  expect(UTF8_BOM.charCodeAt(0)).toBe(0xfeff);
});