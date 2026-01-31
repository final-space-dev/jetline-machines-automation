"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
  Header,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  GripVertical,
  Save,
  Bookmark,
  Trash2,
  Check,
} from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
import { cn } from "@/lib/utils";

// Storage keys for persisting state
const COLUMN_ORDER_STORAGE_KEY = "jetline-table-column-order";
const SAVED_VIEWS_STORAGE_KEY = "jetline-table-saved-views";
const ACTIVE_VIEW_STORAGE_KEY = "jetline-table-active-view";

// Saved view interface
interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  columnOrder: string[];
  columnVisibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  globalFilter: string;
}

// Helper to get/set column order from localStorage
function getStoredColumnOrder(tableId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${COLUMN_ORDER_STORAGE_KEY}-${tableId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setStoredColumnOrder(tableId: string, order: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${COLUMN_ORDER_STORAGE_KEY}-${tableId}`, JSON.stringify(order));
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

// Sortable header cell component
function SortableHeaderCell<TData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        header.column.getCanSort() && "cursor-pointer select-none hover:bg-muted/50",
        isDragging && "z-50 bg-muted"
      )}
    >
      <div className="flex items-center gap-1">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3" />
        </div>

        {/* Header content */}
        <div
          className="flex items-center gap-2 flex-1"
          onClick={header.column.getToggleSortingHandler()}
        >
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
          {header.column.getIsSorted() && (
            <span className="text-muted-foreground">
              {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
            </span>
          )}
        </div>
      </div>
    </TableHead>
  );
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
  enableColumnReorder?: boolean;
  enableRowSelection?: boolean;
  onBulkAction?: (selectedIds: string[], action: string) => void;
  bulkActions?: BulkAction[];
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
  enableColumnReorder = true,
  enableRowSelection = false,
  onBulkAction,
  bulkActions = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilterValue, setGlobalFilterValue] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});

  // Saved views state
  const [savedViews, setSavedViewsState] = React.useState<SavedView[]>(() => getSavedViews(tableId));
  const [activeViewId, setActiveViewIdState] = React.useState<string | null>(() => getActiveViewId(tableId));
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");

  // Column order state - initialize from localStorage or use default column order
  const defaultColumnOrder = React.useMemo(
    () => {
      const base = columns.map((col) => (col as { accessorKey?: string; id?: string }).accessorKey || (col as { id?: string }).id || "");
      return enableRowSelection ? ["select", ...base] : base;
    },
    [columns, enableRowSelection]
  );

  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    const stored = getStoredColumnOrder(tableId);
    if (stored) {
      // Remove "select" from stored - we pin it first ourselves
      const cleaned = stored.filter((id) => id !== "select");
      const validStored = cleaned.filter((id) => defaultColumnOrder.includes(id));
      const newColumns = defaultColumnOrder.filter((id) => id !== "select" && !validStored.includes(id));
      const base = [...validStored, ...newColumns];
      return enableRowSelection ? ["select", ...base] : base;
    }
    return defaultColumnOrder;
  });

  // Save column order to localStorage when it changes (exclude "select" from storage)
  React.useEffect(() => {
    if (columnOrder.length > 0) {
      setStoredColumnOrder(tableId, columnOrder.filter((id) => id !== "select"));
    }
  }, [columnOrder, tableId]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for column reordering (keep "select" pinned first)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Don't allow dragging the select column
    if (active.id === "select" || over.id === "select") return;
    setColumnOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Reset column order to default
  const resetColumnOrder = () => {
    setColumnOrder(defaultColumnOrder);
  };

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
      columnOrder,
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
    // Filter column order to only include columns that exist
    const validColumnOrder = view.columnOrder.filter((id) => defaultColumnOrder.includes(id));
    const newColumns = defaultColumnOrder.filter((id) => !validColumnOrder.includes(id));
    setColumnOrder([...validColumnOrder, ...newColumns]);
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
    setColumnOrder(defaultColumnOrder);
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
      JSON.stringify(columnOrder) !== JSON.stringify(activeView.columnOrder) ||
      JSON.stringify(columnVisibility) !== JSON.stringify(activeView.columnVisibility) ||
      JSON.stringify(columnFilters) !== JSON.stringify(activeView.columnFilters) ||
      JSON.stringify(sorting) !== JSON.stringify(activeView.sorting) ||
      globalFilterValue !== activeView.globalFilter
    );
  }, [activeView, columnOrder, columnVisibility, columnFilters, sorting, globalFilterValue]);

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
    onColumnOrderChange: setColumnOrder,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: globalFilterValue,
      columnOrder,
    },
    ...(!noPagination && {
      initialState: {
        pagination: { pageSize },
      },
    }),
  });

  // Get selected row IDs for bulk actions
  const selectedRowIds = React.useMemo(() => {
    return table.getSelectedRowModel().rows
      .map((row) => (row.original as Record<string, unknown>)?.id as string)
      .filter(Boolean);
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilterValue}
              onChange={(e) => setGlobalFilterValue(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Column Filters */}
          {filterColumns.map((filter) => (
            <Select
              key={filter.key}
              value={(table.getColumn(filter.key)?.getFilterValue() as string) ?? ""}
              onValueChange={(value) =>
                table.getColumn(filter.key)?.setFilterValue(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
              <X className="h-4 w-4 mr-1" />
              Clear ({activeFilters})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Saved Views */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={activeView ? "border-primary" : ""}>
                <Bookmark className="h-4 w-4 mr-2" />
                {activeView ? (
                  <span className="flex items-center gap-1">
                    {activeView.name}
                    {isViewModified && <span className="text-amber-500">*</span>}
                  </span>
                ) : (
                  "Views"
                )}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save current view
              </DropdownMenuItem>
              <DropdownMenuItem onClick={resetToDefault}>
                <X className="h-4 w-4 mr-2" />
                Reset to default
              </DropdownMenuItem>
              {savedViews.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Saved Views</DropdownMenuLabel>
                  {savedViews.map((view) => (
                    <DropdownMenuItem
                      key={view.id}
                      className="flex items-center justify-between group"
                    >
                      <div
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                        onClick={() => loadView(view)}
                      >
                        {activeViewId === view.id && <Check className="h-3 w-3 text-primary" />}
                        <span className={activeViewId === view.id ? "font-medium" : ""}>{view.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteView(view.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Visibility & Order */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Columns
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {enableColumnReorder && (
                <>
                  <DropdownMenuItem onClick={resetColumnOrder} className="text-xs text-muted-foreground">
                    <GripVertical className="h-3 w-3 mr-2" />
                    Reset column order
                  </DropdownMenuItem>
                  <div className="my-1 h-px bg-border" />
                </>
              )}
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    className="capitalize"
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
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
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <SortableContext
                    items={headerGroup.headers.map((h) => h.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) =>
                      enableColumnReorder ? (
                        <SortableHeaderCell key={header.id} header={header} />
                      ) : (
                        <TableHead
                          key={header.id}
                          className={cn(
                            header.column.getCanSort() && "cursor-pointer select-none hover:bg-muted/50"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {header.isPlaceholder ? null : (
                            <div className="flex items-center gap-2">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getIsSorted() && (
                                <span className="text-muted-foreground">
                                  {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          )}
                        </TableHead>
                      )
                    )}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* Bulk action bar */}
      {enableRowSelection && selectedRowIds.length > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
          <span className="text-sm font-medium">{selectedRowIds.length} selected</span>
          {bulkActions.map((action) => (
            <Button
              key={action.value}
              variant="outline"
              size="sm"
              onClick={() => {
                onBulkAction?.(selectedRowIds, action.value);
                setRowSelection({});
              }}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} results
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
