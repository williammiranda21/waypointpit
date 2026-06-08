import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve(process.cwd(), '..', 'PIT_Summary_Report_Template.xlsx');
const wb = XLSX.readFile(file, { cellStyles: true, sheetStubs: true, cellNF: true, cellFormula: true });

// 1) Dump PitRawData fully — what column headers does it use?
const raw = wb.Sheets['PitRawData'];
console.log('=== PitRawData ===');
console.log('range:', raw['!ref']);
console.log('cells in row 1-3:');
for (const key of Object.keys(raw).slice(0, 80).filter((k) => k.startsWith('!') === false)) {
  const v = raw[key].v;
  console.log(`  ${key}: v=${(v === undefined ? 'undef' : JSON.stringify(v)).slice(0, 60)}  t=${raw[key].t}`);
}

// 2) Print *every* cell ref + value in PitRawData (it should be tiny — one or a few rows)
console.log('\nAll PitRawData cells:');
const allKeys = Object.keys(raw).filter((k) => !k.startsWith('!'));
console.log(`total cells: ${allKeys.length}`);
const sample = allKeys.slice(0, 30);
sample.forEach((k) => console.log(`  ${k}: ${JSON.stringify(raw[k].v) ?? 'undef'}`));

// 3) Look at how All_AC references PitRawData via formula
const allAC = wb.Sheets['All_AC'];
console.log('\n=== Formula examples from All_AC ===');
const acKeys = Object.keys(allAC).filter((k) => !k.startsWith('!') && allAC[k].f);
acKeys.slice(0, 20).forEach((k) => console.log(`  ${k}: f=${allAC[k].f}`));

// 4) Look at remaining sheets briefly
const remaining = ['Vets_AC', 'Vets_AO', 'Vets_TOTALS', 'Additional_Homeless_Populations'];
for (const name of remaining) {
  const sh = wb.Sheets[name];
  if (!sh) continue;
  console.log(`\n--- ${name} ---`);
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false, blankrows: false });
  rows.slice(0, 50).forEach((row, r) => {
    const cells = (row ?? [])
      .map((v, c) =>
        v !== null && v !== undefined && v !== '' ? `${XLSX.utils.encode_col(c)}: ${String(v).slice(0, 60)}` : null,
      )
      .filter(Boolean);
    if (cells.length > 0) console.log(`R${r + 1}  ${cells.join(' | ')}`);
  });
}

// 5) DO_NOT_EDIT first 60 rows
console.log('\n--- DO_NOT_EDIT (head) ---');
const dne = wb.Sheets['DO_NOT_EDIT'];
const dneRows = XLSX.utils.sheet_to_json(dne, { header: 1, defval: null, raw: false, blankrows: false });
dneRows.slice(0, 30).forEach((row, r) => {
  const cells = (row ?? [])
    .map((v, c) =>
      v !== null && v !== undefined && v !== '' ? `${XLSX.utils.encode_col(c)}: ${String(v).slice(0, 60)}` : null,
    )
    .filter(Boolean);
  if (cells.length > 0) console.log(`R${r + 1}  ${cells.join(' | ')}`);
});
console.log(`(${dneRows.length} total rows)`);
