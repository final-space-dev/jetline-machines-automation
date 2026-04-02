"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  Search,
  SlidersHorizontal,
  X,
  Save,
} from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Storage keys for persisting state
const COLUMN_VISIBILITY_STORAGE_KEY = "jetline-table-column-visibility";
const SAVED_VIEWS_STORAGE_KEY = "jetline-table-saved-views";
const ACTIVE_VIEW_STORAGE_KEY = "jetline-table-active-view";

// Saved view interface
interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  columnVisibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  globalFilter: string;
}

// Helper to get/set column visibility from localStorage
function getStoredColumnVisibility(tableId: string): VisibilityState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${COLUMN_VISIBILITY_STORAGE_KEY}-${tableId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setStoredColumnVisibility(tableId: string, visibility: VisibilityState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${COLUMN_VISIBILITY_STORAGE_KEY}-${tableId}`, JSON.stringify(visibility));
}

// Helper functions for saved views
function getSavedViews(tableId: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`${SAVED_VIEWS_STORAGE_KEY}-${tableId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setSavedViews(tableId: string, views: SavedView[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${SAVED_VIEWS_STORAGE_KEY}-${tableId}`, JSON.stringify(views));
}

function getActiveViewId(tableId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${ACTIVE_VIEW_STORAGE_KEY}-${tableId}`);
  } catch {
    return null;
  }
}

function setActiveViewId(tableId: string, viewId: string | null): void {
  if (typeof window === "undefined") return;
  if (viewId) {
    localStorage.setItem(`${ACTIVE_VIEW_STORAGE_KEY}-${tableId}`, viewId);
  } else {
    localStorage.removeItem(`${ACTIVE_VIEW_STORAGE_KEY}-${tableId}`);
  }
}

// Fuzzy filter function for semantic search
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fuzzyFilter: FilterFn<any> = (row, columnId, value) => {
  const cellValue = row.getValue(columnId);
  if (cellValue === null || cellValue === undefined) return false;
  const searchValue = String(value).toLowerCase();
  const cellString = String(cellValue).toLowerCase();
  return cellString.includes(searchValue);
};

// Global filter that searches across all columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalFilter: FilterFn<any> = (row, _columnId, filterValue) => {
  const search = String(filterValue).toLowerCase();
  return row.getAllCells().some((cell) => {
    const value = cell.getValue();
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(search);
  });
};

// Multi-select filter function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const multiSelectFilter: FilterFn<any> = (row, columnId, filterValue) => {
  if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) return true;
  const cellValue = row.getValue(columnId);
  return filterValue.includes(String(cellValue));
};

// Multi-select filter popover component
function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 w-[150px] justify-between", value.length > 0 && "border-primary")}>
          <span className="truncate">
            {label}
            {value.length > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-medium">
                {value.length}
              </span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <Input
          placeholder={`Search ${label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-[200px] overflow-auto space-y-1">
          {filteredOptions.map((option) => {
            const checked = value.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) {
                      onChange([...value, option.value]);
                    } else {
                      onChange(value.filter((v) => v !== option.value));
                    }
                  }}
                />
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
          {filteredOptions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No options found</p>
          )}
        </div>
        {value.length > 0 && (
          <button
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center pt-2 border-t mt-2"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface BulkAction {
  value: string;
  label: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  filterColumns?: { key: string; label: string; options: { value: string; label: string }[] }[];
  exportFileName?: string;
  pageSize?: number;
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  tableId?: string;
  enableRowSelection?: boolean;
  onBulkAction?: (selectedIds: string[], action: string) => void;
  bulkActions?: BulkAction[];
  getRowClassName?: (row: TData) => string;
  externalColumnFilters?: ColumnFiltersState;
  onExternalColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  onFilteredDataChange?: (filteredData: TData[]) => void;
  hideViewsToolbar?: boolean;
  externalColumnVisibility?: VisibilityState;
  onExternalColumnVisibilityChange?: (v: VisibilityState) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  filterColumns = [],
  exportFileName = "export",
  pageSize = 25,
  isLoading = false,
  onRowClick,
  tableId = "default",
  enableRowSelection = false,
  onBulkAction,
  bulkActions = [],
  getRowClassName,
  externalColumnFilters,
  onExternalColumnFiltersChange,
  onFilteredDataChange,
  hideViewsToolbar = false,
  externalColumnVisibility,
  onExternalColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columnFilters = externalColumnFilters ?? internalColumnFilters;
  const setColumnFilters = onExternalColumnFiltersChange ?? setInternalColumnFilters;
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>(
    () => getStoredColumnVisibility(tableId) || {}
  );
  const columnVisibility = externalColumnVisibility ?? internalColumnVisibility;
  const setColumnVisibility = React.useCallback((updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    const next = typeof updater === "function" ? updater(columnVisibility) : updater;
    if (onExternalColumnVisibilityChange) {
      onExternalColumnVisibilityChange(next);
    } else {
      setInternalColumnVisibility(next);
      setStoredColumnVisibility(tableId, next);
    }
  }, [columnVisibility, onExternalColumnVisibilityChange, tableId]);
  const [globalFilterValue, setGlobalFilterValue] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});

  // Saved views state
  const [savedViews, setSavedViewsState] = React.useState<SavedView[]>(() => getSavedViews(tableId));
  const [activeViewId, setActiveViewIdState] = React.useState<string | null>(() => getActiveViewId(tableId));
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");

  // Get the active view
  const activeView = React.useMemo(
    () => savedViews.find((v) => v.id === activeViewId) || null,
    [savedViews, activeViewId]
  );

  // Save current view state
  const saveView = (name: string) => {
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      columnVisibility,
      columnFilters,
      sorting,
      globalFilter: globalFilterValue,
    };
    const updated = [...savedViews, newView];
    setSavedViewsState(updated);
    setSavedViews(tableId, updated);
    setActiveViewIdState(newView.id);
    setActiveViewId(tableId, newView.id);
    setShowSaveDialog(false);
    setNewViewName("");
  };

  // Load a saved view
  const loadView = (view: SavedView) => {
    setColumnVisibility(view.columnVisibility);
    setColumnFilters(view.columnFilters);
    setSorting(view.sorting);
    setGlobalFilterValue(view.globalFilter);
    setActiveViewIdState(view.id);
    setActiveViewId(tableId, view.id);
  };

  // Delete a saved view
  const deleteView = (viewId: string) => {
    const updated = savedViews.filter((v) => v.id !== viewId);
    setSavedViewsState(updated);
    setSavedViews(tableId, updated);
    if (activeViewId === viewId) {
      setActiveViewIdState(null);
      setActiveViewId(tableId, null);
    }
  };

  // Reset to default view (clear all customizations)
  const resetToDefault = () => {
    setColumnVisibility({});
    setColumnFilters([]);
    setSorting([]);
    setGlobalFilterValue("");
    setActiveViewIdState(null);
    setActiveViewId(tableId, null);
  };

  // Check if current state differs from active view (for "modified" indicator)
  const isViewModified = React.useMemo(() => {
    if (!activeView) return false;
    return (
      JSON.stringify(columnVisibility) !== JSON.stringify(activeView.columnVisibility) ||
      JSON.stringify(columnFilters) !== JSON.stringify(activeView.columnFilters) ||
      JSON.stringify(sorting) !== JSON.stringify(activeView.sorting) ||
      globalFilterValue !== activeView.globalFilter
    );
  }, [activeView, columnVisibility, columnFilters, sorting, globalFilterValue]);

  // Add checkbox column if row selection is enabled
  const allColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;
    const selectCol: ColumnDef<TData, TValue> = {
      id: "select",
      header: ({ table: t }) => (
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={t.getIsAllPageRowsSelected()}
          onChange={(e) => t.toggleAllPageRowsSelected(e.target.checked)}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={row.getIsSelected()}
          onChange={(e) => {
            e.stopPropagation();
            row.toggleSelected(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [selectCol, ...columns];
  }, [columns, enableRowSelection]);

  const noPagination = pageSize >= 10000;

  const table = useReactTable({
    data,
    columns: allColumns,
    filterFns: {
      fuzzy: fuzzyFilter,
      global: globalFilter,
      multiSelect: multiSelectFilter,
    },
    defaultColumn: {
      filterFn: multiSelectFilter,
    },
    globalFilterFn: globalFilter,
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    ...(!noPagination && { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilterValue,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: globalFilterValue,
    },
    ...(!noPagination && {
      initialState: {
        pagination: { pageSize },
      },
    }),
  });

  // Notify parent of filtered data changes
  const filteredRows = table.getFilteredRowModel().rows;
  React.useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(filteredRows.map((r) => r.original));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows.length, onFilteredDataChange]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && Object.keys(rowSelection).length > 0) {
        setRowSelection({});
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [rowSelection]);

  // Get selected row IDs for bulk actions
  const selectedRowIds = React.useMemo(() => {
    return table.getSelectedRowModel().rows
      .map((row) => (row.original as Record<string, unknown>)?.id as string)
      .filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, table]);

  const handleExportCSV = () => {
    const visibleColumns = table.getAllColumns().filter((col) => col.getIsVisible());
    const headers = visibleColumns.map((col) => col.id);
    const rows = table.getFilteredRowModel().rows.map((row) =>
      visibleColumns.map((col) => {
        const value = row.getValue(col.id);
        if (value === null || value === undefined) return "";
        if (value instanceof Date) return value.toISOString();
        return String(value);
      })
    );

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const visibleColumns = table.getAllColumns().filter((col) => col.getIsVisible());
    const headers = visibleColumns.map((col) => col.id);
    const rows = table.getFilteredRowModel().rows.map((row) =>
      visibleColumns.map((col) => {
        const value = row.getValue(col.id);
        if (value === null || value === undefined) return "";
        if (value instanceof Date) return value;
        return value;
      })
    );

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${exportFileName}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const activeFilters = columnFilters.length + (globalFilterValue ? 1 : 0);

  const clearFilters = () => {
    setColumnFilters([]);
    setGlobalFilterValue("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar Row 1: Search + Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilterValue}
            onChange={(e) => setGlobalFilterValue(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {filterColumns.map((filter) => {
          const filterValue = (table.getColumn(filter.key)?.getFilterValue() as string[]) ?? [];
          return (
            <MultiSelectFilter
              key={filter.key}
              label={filter.label}
              options={filter.options}
              value={filterValue}
              onChange={(val) => {
                table.getColumn(filter.key)?.setFilterValue(val.length > 0 ? val : undefined);
              }}
            />
          );
        })}

        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
            <X className="h-4 w-4 mr-1" />
            Clear ({activeFilters})
          </Button>
        )}
      </div>

      {/* Toolbar Row 2: Views (left) + Columns/Export (right) */}
      {!hideViewsToolbar && <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* View tabs */}
          <Button
            variant={!activeViewId ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={resetToDefault}
          >
            All
          </Button>
          {savedViews.map((view) => (
            <div key={view.id} className="flex items-center group">
              <Button
                variant={activeViewId === view.id ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => loadView(view)}
              >
                {view.name}
                {activeViewId === view.id && isViewModified && (
                  <span className="text-amber-500 ml-0.5">*</span>
                )}
              </Button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5 -ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="h-3 w-3 mr-1" />
            Save view
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {/* Column Visibility */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <SlidersHorizontal className="h-3 w-3 mr-1" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => {
                          column.toggleVisibility(!!value);
                          setTimeout(() => {
                            const updated = { ...columnVisibility, [column.id]: !!value };
                            if (updated[column.id]) delete updated[column.id];
                            setStoredColumnVisibility(tableId, updated);
                          }, 0);
                        }}
                      />
                      <span className="capitalize text-xs">{column.id.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}</span>
                    </label>
                  ))}
              </div>
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center pt-2 border-t mt-2"
                onClick={() => {
                  setColumnVisibility({});
                  setStoredColumnVisibility(tableId, {});
                  toast.success("Columns reset to default");
                }}
              >
                Show all columns
              </button>
            </PopoverContent>
          </Popover>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>}

      {/* Bulk action bar */}
      {enableRowSelection && selectedRowIds.length > 0 && bulkActions.length > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
          <span className="text-sm font-medium text-blue-900">{selectedRowIds.length} selected</span>
          <div className="flex items-center gap-1">
            {bulkActions.map((action) => (
              <Button
                key={action.value}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onBulkAction?.(selectedRowIds, action.value);
                  toast.success(`Applied "${action.label}" to ${selectedRowIds.length} machines`);
                  setRowSelection({});
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-blue-700" onClick={() => setRowSelection({})}>
            <X className="h-3 w-3 mr-1" />
            Deselect all
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() && "cursor-pointer select-none hover:bg-muted/50",
                      (header.column.columnDef.meta as { align?: string } | undefined)?.align === "right" && "text-right"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-muted-foreground text-xs">
                            {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "even:bg-blue-50/40",
                    onRowClick && "cursor-pointer hover:bg-blue-50/60",
                    getRowClassName?.(row.original)
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1 px-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Search className="h-8 w-8" />
                    <p className="text-sm font-medium">No results found</p>
                    {activeFilters > 0 && (
                      <Button variant="link" size="sm" onClick={clearFilters}>
                        Clear all filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length === data.length
            ? `${data.length} rows`
            : `Showing ${table.getFilteredRowModel().rows.length} of ${data.length}`}
          {Object.keys(rowSelection).length > 0 && (
            <span className="ml-2 font-medium text-foreground">
              · {Object.keys(rowSelection).length} selected
            </span>
          )}
        </p>

        {!noPagination && (
          <div className="flex items-center gap-2">
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 250].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Save View Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save your current table configuration including filters, columns, and sorting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="view-name">View name</Label>
              <Input
                id="view-name"
                placeholder="e.g., Low Utilization Machines"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newViewName.trim()) {
                    saveView(newViewName.trim());
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveView(newViewName.trim())} disabled={!newViewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
