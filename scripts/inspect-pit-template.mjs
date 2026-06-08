import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve(process.cwd(), '..', 'PIT_Summary_Report_Template.xlsx');
const wb = XLSX.readFile(file, { cellStyles: true, sheetStubs: true });

console.log('=== Sheets ===');
for (const name of wb.SheetNames) {
  const sh = wb.Sheets[name];
  const ref = sh['!ref'] ?? 'EMPTY';
  console.log(`- ${name}  (range=${ref})`);
}

console.log('\n=== Sheet snapshots ===');
for (const name of wb.SheetNames) {
  const sh = wb.Sheets[name];
  console.log(`\n--- ${name} ---`);
  // Print top 80 rows with non-empty cells
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false, blankrows: false });
  rows.slice(0, 100).forEach((row, r) => {
    const cells = (row ?? []).map((v, c) => (v !== null && v !== undefined && v !== '' ? `${XLSX.utils.encode_col(c)}: ${String(v).slice(0, 60)}` : null)).filter(Boolean);
    if (cells.length > 0) console.log(`R${r + 1}  ${cells.join(' | ')}`);
  });
  if (rows.length > 100) console.log(`... (${rows.length - 100} more rows)`);
}
