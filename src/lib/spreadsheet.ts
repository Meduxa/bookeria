import Papa from "papaparse";

// Pasted text from a web page or a spreadsheet is tab-separated; CSV files use
// commas or semicolons (Papa detects which).
export function textToTable(text: string): string[][] {
  const delimiter = text.includes("\t") ? "\t" : "";
  return Papa.parse<string[]>(text.trim(), { delimiter, skipEmptyLines: true }).data;
}

export async function fileToTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    // first sheet only; loaded on demand so pages stay light
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((r) =>
      r.map((c) =>
        c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c),
      ),
    );
  }
  return textToTable(await file.text());
}
