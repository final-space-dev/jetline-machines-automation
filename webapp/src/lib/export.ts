import * as XLSX from "xlsx";

interface ExportColumn {
  key: string;
  header: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToExcel(data: any[], columns: ExportColumn[], filename: string) {
  const headers = columns.map((col) => col.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const keys = col.key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = item;
      for (const key of keys) {
        value = value?.[key];
      }
      if (value === null || value === undefined) return "";
      if (value instanceof Date) return value;
      return value;
    })
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split("T")[0]}.xlsx`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCSV(data: any[], columns: ExportColumn[], filename: string) {
  const headers = columns.map((col) => col.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const keys = col.key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = item;
      for (const key of keys) {
        value = value?.[key];
      }
      if (value === null || value === undefined) return "";
      if (value instanceof Date) return value.toISOString();
      return String(value);
    })
  );

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
