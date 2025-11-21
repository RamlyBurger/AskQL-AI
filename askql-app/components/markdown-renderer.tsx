"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  oneDark,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import {
  Table,
  FileJson,
  BarChart3,
  Printer,
  Download,
  FileType,
  FileSpreadsheet,
  ChevronDown,
  Columns,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/form-btn";
import { ChartRenderer } from "@/components/chart-renderer";
import {
  AlertDialog,
  AlertMsgContent,
  AlertMsgDescription,
  AlertMsgFooter,
  AlertMsgHeader,
  AlertMsgTitle,
  AlertMsgCancel,
} from "@/components/alert-message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/chat-menu";

interface MarkdownRendererProps {
  content: string;
  expandAll?: boolean;
  onConfirmAction?: (
    action: "execute" | "cancel",
    operation: string,
    sql: string,
    explanation: string,
    model: string
  ) => void;
  onSuggestionClick?: (suggestion: string) => void;
  lastUserMessage?: string;
}

export function MarkdownRenderer({
  content,
  expandAll = false,
  onConfirmAction,
  onSuggestionClick,
  lastUserMessage,
}: MarkdownRendererProps) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const syntaxTheme = currentTheme === "dark" ? oneDark : oneLight;
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [tableSortConfig, setTableSortConfig] = React.useState<
    Record<string, { column: string; direction: "asc" | "desc" }>
  >({});
  const [tableFilters, setTableFilters] = React.useState<
    Record<string, Record<string, string>>
  >({});
  const [tableVisibleColumns, setTableVisibleColumns] = React.useState<
    Record<string, string[]>
  >({});
  const [tableCurrentPage, setTableCurrentPage] = React.useState<
    Record<string, number>
  >({});
  const [tableCurrentPageInline, setTableCurrentPageInline] = React.useState<
    Record<string, number>
  >({});
  const [tableRowsPerPage, setTableRowsPerPage] = React.useState<
    Record<string, number>
  >({});
  const [showColumnMenu, setShowColumnMenu] = React.useState<string | null>(
    null
  );
  const [showFilterInput, setShowFilterInput] = React.useState<string | null>(
    null
  );
  const [fullscreenSection, setFullscreenSection] = React.useState<
    string | null
  >(null);
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [pendingDownload, setPendingDownload] = React.useState<{
    data: any[];
    name: string;
  } | null>(null);
  const DEFAULT_ROWS_PER_PAGE = 10;
  const INLINE_ROWS_LIMIT = 5; // Only show 5 rows in inline table view
  const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];

  // Helper function to extract @data tags from a message
  const extractDataTags = (message: string): string[] => {
    if (!message) return [];
    const mentionPattern = /@(\w+)/g;
    const tags: string[] = [];
    let match;

    while ((match = mentionPattern.exec(message)) !== null) {
      const tag = match[0]; // e.g., "@dataset_walmart"
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  };

  // Helper function to append data tags to suggestion
  const appendDataTags = (suggestion: string): string => {
    if (!lastUserMessage) return suggestion;

    const dataTags = extractDataTags(lastUserMessage);
    if (dataTags.length === 0) return suggestion;

    // Check if suggestion already has @ tags
    const suggestionHasTags = /@\w+/.test(suggestion);

    // If suggestion already has tags, don't append
    if (suggestionHasTags) return suggestion;

    // Append the tags at the end
    return `${suggestion} ${dataTags.join(" ")}`;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 500);
  };

  const handleSort = (tableId: string, column: string) => {
    setTableSortConfig((prev) => {
      const currentSort = prev[tableId];
      if (currentSort?.column === column) {
        return {
          ...prev,
          [tableId]: {
            column,
            direction: currentSort.direction === "asc" ? "desc" : "asc",
          },
        };
      }
      return {
        ...prev,
        [tableId]: { column, direction: "asc" },
      };
    });
  };

  const handleFilter = (tableId: string, column: string, value: string) => {
    setTableFilters((prev) => ({
      ...prev,
      [tableId]: {
        ...(prev[tableId] || {}),
        [column]: value,
      },
    }));
    setTableCurrentPage((prev) => ({ ...prev, [tableId]: 1 }));
  };

  const toggleColumnVisibility = (
    tableId: string,
    column: string,
    allColumns: string[]
  ) => {
    setTableVisibleColumns((prev) => {
      const currentVisible = prev[tableId] || allColumns;
      const newVisible = currentVisible.includes(column)
        ? currentVisible.filter((c) => c !== column)
        : [...currentVisible, column];
      return { ...prev, [tableId]: newVisible };
    });
  };

  // Handle ESC key to exit fullscreen
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreenSection) {
        setFullscreenSection(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [fullscreenSection]);

  const handleDownloadClick = (data: any[], tableName: string) => {
    setPendingDownload({ data, name: tableName });
    setShowDownloadDialog(true);
  };

  const handleExportChart = (chartId: string, chartTitle: string) => {
    // Find the chart container
    const chartContainer = document.getElementById(chartId);
    if (!chartContainer) {
      alert("Unable to find chart. Please try again.");
      return;
    }

    // Helper function to convert entire chart container (including title and legend) to image
    const exportChartContainer = (container: HTMLElement) => {
      try {
        // Get all SVG elements (chart + legend)
        const svgs = container.querySelectorAll("svg");

        if (svgs.length === 0) {
          alert("No chart found to export.");
          return;
        }

        // Get container dimensions
        const containerRect = container.getBoundingClientRect();

        // Create a canvas with extra space for title
        const canvas = document.createElement("canvas");
        const padding = 40;
        const titleHeight = 60;
        const legendHeight = 50; // Extra space for legend
        canvas.width = containerRect.width + padding * 2;
        canvas.height =
          containerRect.height + padding * 2 + titleHeight + legendHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          alert("Unable to create canvas context.");
          return;
        }

        // Fill white background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw title
        const title = container.querySelector("h3")?.textContent || chartTitle;
        if (title) {
          ctx.fillStyle = "#18181b";
          ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(title, canvas.width / 2, padding + 30);
        }

        // Process all SVG elements
        let processedCount = 0;
        const totalSvgs = svgs.length;

        svgs.forEach((svg, index) => {
          const svgRect = svg.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Calculate relative position of this SVG within the container
          const relativeX = svgRect.left - containerRect.left;
          const relativeY = svgRect.top - containerRect.top;

          // Skip the legend icon SVGs (small 14x14 SVGs)
          if (svgRect.width <= 14 && svgRect.height <= 14) {
            processedCount++;
            return;
          }

          // Clone the SVG to modify it without affecting the original
          const svgClone = svg.cloneNode(true) as SVGElement;

          // Force all text elements to be black for visibility on white background
          const textElements = svgClone.querySelectorAll("text");
          textElements.forEach((text) => {
            text.style.fill = "#000000";
            text.setAttribute("fill", "#000000");
          });

          // Also ensure tspan elements (nested text) are black
          const tspanElements = svgClone.querySelectorAll("tspan");
          tspanElements.forEach((tspan) => {
            tspan.style.fill = "#000000";
            tspan.setAttribute("fill", "#000000");
          });

          const svgData = new XMLSerializer().serializeToString(svgClone);
          const img = new Image();
          const svgBlob = new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8",
          });
          const url = URL.createObjectURL(svgBlob);

          img.onload = () => {
            // Draw the SVG at its relative position
            ctx.drawImage(
              img,
              padding + relativeX,
              padding + titleHeight + relativeY,
              svgRect.width,
              svgRect.height
            );
            URL.revokeObjectURL(url);

            processedCount++;

            // Once all SVGs are drawn, draw the legend and export
            if (processedCount === totalSvgs) {
              // Draw legend text manually from the HTML legend wrapper
              const legendWrapper = container.querySelector(
                ".recharts-legend-wrapper"
              );
              if (legendWrapper) {
                const legendItems = legendWrapper.querySelectorAll(
                  ".recharts-legend-item"
                );
                if (legendItems.length > 0) {
                  ctx.font = "14px system-ui, -apple-system, sans-serif";
                  ctx.textAlign = "left";

                  // Calculate total width of all legend items
                  let totalWidth = 0;
                  const itemWidths: number[] = [];
                  legendItems.forEach((item) => {
                    const legendText =
                      item.querySelector(".recharts-legend-item-text")
                        ?.textContent || "";
                    const width = ctx.measureText(legendText).width + 30; // 14px icon + 4px margin + text + 12px spacing
                    itemWidths.push(width);
                    totalWidth += width;
                  });

                  // Start position (centered)
                  let legendX = (canvas.width - totalWidth) / 2;
                  const legendY =
                    padding + titleHeight + containerRect.height - 15;

                  legendItems.forEach((item, idx) => {
                    const legendText =
                      item.querySelector(".recharts-legend-item-text")
                        ?.textContent || "";
                    const iconSvg = item.querySelector(
                      "svg path"
                    ) as SVGPathElement;

                    if (iconSvg && legendText) {
                      // Get the color from the SVG path (could be stroke for lines or fill for bars)
                      const strokeColor = iconSvg.getAttribute("stroke");
                      const fillColor = iconSvg.getAttribute("fill");
                      const iconColor =
                        strokeColor && strokeColor !== "none"
                          ? strokeColor
                          : fillColor || "#3b82f6";

                      // Draw a small colored rectangle/line as icon
                      if (strokeColor && strokeColor !== "none") {
                        // For line charts - draw a line
                        ctx.strokeStyle = iconColor;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(legendX, legendY - 3);
                        ctx.lineTo(legendX + 14, legendY - 3);
                        ctx.stroke();
                      } else {
                        // For bar/pie charts - draw a filled rectangle
                        ctx.fillStyle = iconColor;
                        ctx.fillRect(legendX, legendY - 10, 14, 10);
                      }

                      // Draw the legend text in black
                      ctx.fillStyle = "#18181b";
                      ctx.fillText(legendText, legendX + 18, legendY);

                      // Move to next position
                      legendX += itemWidths[idx];
                    }
                  });
                }
              }

              // Export the canvas
              setTimeout(() => {
                canvas.toBlob((blob) => {
                  if (blob) {
                    const downloadUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = downloadUrl;
                    link.download = `${chartTitle
                      .replace(/[^a-z0-9]/gi, "_")
                      .toLowerCase()}_${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(downloadUrl);
                  }
                });
              }, 100);
            }
          };

          img.onerror = () => {
            URL.revokeObjectURL(url);
            processedCount++;
            if (processedCount === totalSvgs) {
              alert("Unable to export chart. Some elements failed to load.");
            }
          };

          img.src = url;
        });
      } catch (error) {
        console.error("Error exporting chart:", error);
        alert("Unable to export chart. Please try again.");
      }
    };

    // Try to get the chart container with all elements
    const hasContent = chartContainer.querySelector("svg");

    if (hasContent) {
      // Chart is rendered, export directly
      exportChartContainer(chartContainer);
    } else {
      // Chart not rendered, ensure details is open and wait for render
      const detailsElement = chartContainer.closest("details");
      if (detailsElement) {
        if (!detailsElement.open) {
          detailsElement.open = true;
        }

        // Wait for chart to render with multiple attempts
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = setInterval(() => {
          attempts++;
          const svg = chartContainer.querySelector("svg");

          if (svg) {
            clearInterval(checkInterval);
            exportChartContainer(chartContainer);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            alert(
              "Unable to export chart. Please try expanding the chart manually and try again."
            );
          }
        }, 100);
      } else {
        alert("Unable to export chart. Please try again.");
      }
    }
  };

  const downloadAsJSON = () => {
    if (!pendingDownload) return;
    const { data, name } = pendingDownload;

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    link.download = `${sanitizedName}_${timestamp}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowDownloadDialog(false);
    setPendingDownload(null);
  };

  const downloadAsCSV = () => {
    if (!pendingDownload) return;
    const { data, name } = pendingDownload;

    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const csvRows = [];

    // Header row
    csvRows.push(columns.join(","));

    // Data rows
    for (const row of data) {
      const values = columns.map((col) => {
        const value = String(row[col]);
        // Escape quotes and wrap in quotes if contains comma or quote
        return value.includes(",") || value.includes('"')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      });
      csvRows.push(values.join(","));
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    link.download = `${sanitizedName}_${timestamp}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowDownloadDialog(false);
    setPendingDownload(null);
  };

  const downloadAsExcel = () => {
    if (!pendingDownload) return;
    const { data, name } = pendingDownload;

    if (data.length === 0) return;

    // Create HTML table for Excel
    const columns = Object.keys(data[0]);
    let html = "<table><thead><tr>";

    // Header
    columns.forEach((col) => {
      html += `<th>${col}</th>`;
    });
    html += "</tr></thead><tbody>";

    // Data rows
    data.forEach((row) => {
      html += "<tr>";
      columns.forEach((col) => {
        html += `<td>${String(row[col])}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    link.download = `${sanitizedName}_${timestamp}.xls`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowDownloadDialog(false);
    setPendingDownload(null);
  };

  const handlePrintTable = (data: any[], tableName: string) => {
    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const columns = Object.keys(data[0]);

    // Generate HTML for the print window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Table - ${tableName}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              background: white;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 20px;
              color: #18181b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #d4d4d8;
              padding: 8px 12px;
              text-align: left;
              font-size: 14px;
            }
            th {
              background-color: #f4f4f5;
              font-weight: 600;
              color: #3f3f46;
            }
            tr:nth-child(even) {
              background-color: #fafafa;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #d4d4d8;
              font-size: 12px;
              color: #71717a;
              text-align: center;
            }
            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <h1>${tableName}</h1>
          <p style="color: #71717a; font-size: 14px;">Total rows: ${
            data.length
          }</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                ${columns.map((col) => `<th>${col}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (row, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  ${columns
                    .map((col) => `<td>${String(row[col])}</td>`)
                    .join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>Generated by AskQL - ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const renderTableView = (
    data: any[],
    tableId: string,
    isFullscreen: boolean = false
  ) => {
    if (!Array.isArray(data) || data.length === 0) {
      return <div className="text-sm text-gray-500">No data to display</div>;
    }

    const allColumns = Object.keys(data[0]);
    const visibleColumns = isFullscreen
      ? tableVisibleColumns[tableId] || allColumns
      : allColumns;
    const sortConfig = isFullscreen ? tableSortConfig[tableId] : undefined;
    const filters = isFullscreen ? tableFilters[tableId] || {} : {};
    const currentPage = isFullscreen
      ? tableCurrentPage[tableId] || 1
      : tableCurrentPageInline[tableId] || 1;

    // Apply filters (only in fullscreen)
    let filteredData = isFullscreen
      ? data.filter((row) => {
          return Object.entries(filters).every(([col, filterValue]) => {
            if (!filterValue) return true;
            const cellValue = String(row[col]).toLowerCase();
            return cellValue.includes(filterValue.toLowerCase());
          });
        })
      : data;

    // Apply sorting (only in fullscreen)
    if (isFullscreen && sortConfig) {
      filteredData = [...filteredData].sort((a, b) => {
        const aVal = a[sortConfig.column];
        const bVal = b[sortConfig.column];

        // Try numeric comparison first
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortConfig.direction === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    // Pagination (enabled in both views)
    const rowsPerPage = isFullscreen
      ? tableRowsPerPage[tableId] || DEFAULT_ROWS_PER_PAGE
      : INLINE_ROWS_LIMIT;
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;

    // Use pagination for both inline and fullscreen
    const displayData = filteredData.slice(startIdx, endIdx);

    return (
      <div className="space-y-3">
        {/* Column Visibility Toggle and Rows Per Page - Only in fullscreen */}
        {isFullscreen && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <Columns className="h-4 w-4" />
                  <span className="text-xs">Columns</span>
                  <span className="text-xs text-gray-500">
                    ({visibleColumns.length}/{allColumns.length})
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {allColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col}
                    checked={visibleColumns.includes(col)}
                    onCheckedChange={() =>
                      toggleColumnVisibility(tableId, col, allColumns)
                    }
                    className="text-sm"
                  >
                    {col}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Rows Per Page Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <span className="text-xs">Rows: {rowsPerPage}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={rowsPerPage === option}
                    onCheckedChange={() => {
                      setTableRowsPerPage((prev) => ({
                        ...prev,
                        [tableId]: option,
                      }));
                      // Reset to first page when changing rows per page
                      setTableCurrentPage((prev) => ({
                        ...prev,
                        [tableId]: 1,
                      }));
                    }}
                    className="text-sm"
                  >
                    {option} rows
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto border border-gray-300 dark:border-gray-600">
          <table className="min-w-full border-collapse">
            <thead className="bg-blue-50 dark:bg-blue-900">
              <tr>
                {visibleColumns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-2 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-r border-gray-300 dark:border-gray-600 last:border-r-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1">{col}</span>
                      {isFullscreen && (
                        <div className="flex items-center gap-1">
                          {/* Sort Button */}
                          <button
                            onClick={() => handleSort(tableId, col)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Sort"
                          >
                            {sortConfig?.column === col ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                          {/* Filter Button */}
                          <button
                            onClick={() =>
                              setShowFilterInput(
                                showFilterInput === `${tableId}-${col}`
                                  ? null
                                  : `${tableId}-${col}`
                              )
                            }
                            className={`p-1 rounded transition-colors ${
                              filters[col]
                                ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                                : "hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                            title="Filter"
                          >
                            <Filter className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Filter Input - Only in fullscreen */}
                    {isFullscreen &&
                      showFilterInput === `${tableId}-${col}` && (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={filters[col] || ""}
                            onChange={(e) =>
                              handleFilter(tableId, col, e.target.value)
                            }
                            placeholder={`Filter ${col}...`}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            autoFocus
                          />
                        </div>
                      )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {displayData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                    rowIdx % 2 === 0
                      ? "bg-white dark:bg-gray-900"
                      : "bg-gray-50 dark:bg-gray-850"
                  }`}
                >
                  {visibleColumns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap border-b border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                    >
                      {String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination - Show in both modes */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Showing {startIdx + 1}-{Math.min(endIdx, filteredData.length)} of{" "}
              {filteredData.length} rows
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isFullscreen) {
                    setTableCurrentPage((prev) => ({
                      ...prev,
                      [tableId]: Math.max(1, currentPage - 1),
                    }));
                  } else {
                    setTableCurrentPageInline((prev) => ({
                      ...prev,
                      [tableId]: Math.max(1, currentPage - 1),
                    }));
                  }
                }}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => {
                  if (isFullscreen) {
                    setTableCurrentPage((prev) => ({
                      ...prev,
                      [tableId]: Math.min(totalPages, currentPage + 1),
                    }));
                  } else {
                    setTableCurrentPageInline((prev) => ({
                      ...prev,
                      [tableId]: Math.min(totalPages, currentPage + 1),
                    }));
                  }
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // First, identify all special regions (code blocks, details tags, and confirmation tags)
    const regions: Array<{
      type: "code" | "details" | "confirmation";
      start: number;
      end: number;
      data: any;
    }> = [];

    // Find all code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      regions.push({
        type: "code",
        start: match.index,
        end: match.index + match[0].length,
        data: { language: match[1] || "text", code: match[2] },
      });
    }

    // Find all details tags (with or without 'open' attribute)
    const detailsRegex =
      /<details(\s+open)?>\s*<summary>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/g;
    while ((match = detailsRegex.exec(text)) !== null) {
      regions.push({
        type: "details",
        start: match.index,
        end: match.index + match[0].length,
        data: { summary: match[2], content: match[3], isOpen: !!match[1] },
      });
    }

    // Find all confirmation tags
    const confirmationRegex =
      /<confirmation\s+operation="([^"]+)"\s+sql="([^"]+)"\s+message="([^"]+)"\s+model="([^"]+)"\s*\/>/g;
    while ((match = confirmationRegex.exec(text)) !== null) {
      regions.push({
        type: "confirmation",
        start: match.index,
        end: match.index + match[0].length,
        data: {
          operation: match[1],
          sql: match[2],
          message: match[3],
          model: match[4],
        },
      });
    }

    // Find suggestion sections using <suggestions> tags
    const suggestionRegex =
      /<suggestions>\s*((?:<suggestion>[\s\S]*?<\/suggestion>\s*)+)<\/suggestions>/gi;
    while ((match = suggestionRegex.exec(text)) !== null) {
      const suggestionContent = match[1];
      const suggestionItemRegex = /<suggestion>([\s\S]*?)<\/suggestion>/gi;
      const suggestions: string[] = [];
      let itemMatch;

      while (
        (itemMatch = suggestionItemRegex.exec(suggestionContent)) !== null
      ) {
        const suggestion = itemMatch[1].trim();
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      if (suggestions.length > 0) {
        regions.push({
          type: "suggestions" as any,
          start: match.index,
          end: match.index + match[0].length,
          data: { suggestions },
        });
      }
    }

    // Sort regions by start position
    regions.sort((a, b) => a.start - b.start);

    // Remove overlapping regions (keep the first one)
    const nonOverlappingRegions: typeof regions = [];
    for (const region of regions) {
      const overlaps = nonOverlappingRegions.some(
        (r) =>
          (region.start >= r.start && region.start < r.end) ||
          (region.end > r.start && region.end <= r.end) ||
          (region.start <= r.start && region.end >= r.end)
      );
      if (!overlaps) {
        nonOverlappingRegions.push(region);
      }
    }

    // Render content with special regions
    let lastIndex = 0;
    for (const region of nonOverlappingRegions) {
      // Add text before this region
      if (region.start > lastIndex) {
        parts.push(
          <span key={key++}>
            {processInlineMarkdown(text.substring(lastIndex, region.start))}
          </span>
        );
      }

      if (region.type === "code") {
        const { language, code } = region.data;
        const codeBlockId = `code-${key}`;

        // Check if this is a table block
        if (language === "table") {
          try {
            const tableData = JSON.parse(code);
            const tableId = `table-${key}`;
            const isFloating = fullscreenSection === tableId;

            const tableKey = key++;
            parts.push(
              <React.Fragment key={tableKey}>
                <details
                  className="my-4 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  open={true}
                >
                  <summary className="px-4 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium bg-white rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      Click to expand result
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFullscreenSection(isFloating ? null : tableId);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Open in floating view"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </button>
                    </span>
                  </summary>
                  <div className="p-3 overflow-auto custom-scrollbar bg-white rounded-lg">
                    <div className="mb-3 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownloadClick(tableData, "Query Results")
                        }
                        className="h-7 gap-1.5 text-xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handlePrintTable(tableData, "Query Results")
                        }
                        className="h-7 gap-1.5 text-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </Button>
                    </div>
                    {renderTableView(tableData, tableId, false)}
                  </div>
                </details>

                {/* Floating Modal */}
                {isFloating && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setFullscreenSection(null)}
                  >
                    <div
                      className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Query Results
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDownloadClick(tableData, "Query Results")
                            }
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handlePrintTable(tableData, "Query Results")
                            }
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </Button>
                          <button
                            onClick={() => setFullscreenSection(null)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Close"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-6">
                        {renderTableView(tableData, tableId, true)}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          } catch (error) {
            console.error("Failed to parse table data:", error);
            parts.push(
              <div
                key={key++}
                className="my-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20"
              >
                <p className="text-sm text-red-800 dark:text-red-200">
                  Invalid table data
                </p>
              </div>
            );
          }
        } else if (language === "chart") {
          try {
            const chartConfig = JSON.parse(code);

            // Validate chart config
            if (!chartConfig || !chartConfig.type || !chartConfig.data) {
              console.error("Invalid chart config:", chartConfig);
              parts.push(
                <div
                  key={key++}
                  className="my-4 p-4 border border-red-200 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20"
                >
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Invalid chart configuration
                  </p>
                </div>
              );
              continue;
            }

            // Create a unique ID using timestamp and random number to avoid conflicts across messages
            const chartId = `chart-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            const isFloating = fullscreenSection === chartId;

            const chartKey = key++;
            parts.push(
              <React.Fragment key={chartKey}>
                <details
                  className="my-4 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  open={true}
                >
                  <summary className="px-4 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium bg-white rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      Graph
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFullscreenSection(isFloating ? null : chartId);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Open in floating view"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </button>
                    </span>
                  </summary>
                  <div className="p-4 bg-white rounded-lg">
                    <div className="mb-3 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleExportChart(
                            chartId,
                            chartConfig.title || "chart"
                          )
                        }
                        className="h-7 gap-1.5 text-xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export
                      </Button>
                    </div>
                    <div id={chartId}>
                      <ChartRenderer config={chartConfig} />
                    </div>
                  </div>
                </details>

                {/* Floating Modal */}
                {isFloating && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setFullscreenSection(null)}
                  >
                    <div
                      className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Graph
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleExportChart(
                                `${chartId}-floating`,
                                chartConfig.title || "chart"
                              )
                            }
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Export
                          </Button>
                          <button
                            onClick={() => setFullscreenSection(null)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Close"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 overflow-auto p-6">
                        <div id={`${chartId}-floating`}>
                          <ChartRenderer config={chartConfig} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          } catch (error) {
            console.error("Failed to parse chart config:", error);
            parts.push(
              <div
                key={key++}
                className="my-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20"
              >
                <p className="text-sm text-red-800 dark:text-red-200">
                  Invalid chart configuration
                </p>
              </div>
            );
          }
        } else {
          // Regular code block
          parts.push(
            <div key={key++} className="my-4 max-w-full">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400 uppercase">
                      {language}
                    </span>
                    <button
                      onClick={() => handleCopy(code, codeBlockId)}
                      className="bg-white text-xs uppercase tracking-wider cursor-pointer border-2 border-gray-800 dark:border-gray-200 px-2 py-1 relative select-none touch-manipulation transition-all active:shadow-none active:top-[3px] active:left-[3px] text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      style={{
                        boxShadow:
                          "1px 1px 0px 0px currentColor, 2px 2px 0px 0px currentColor, 3px 3px 0px 0px currentColor",
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {copiedId === codeBlockId ? (
                          <>
                            <svg
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              fill="currentColor"
                              className="size-3"
                            >
                              <path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"></path>
                            </svg>
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <svg
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              fill="currentColor"
                              className="size-3"
                            >
                              <path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path>
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="p-3 border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white">
                  <SyntaxHighlighter
                    language={language.toLowerCase()}
                    style={syntaxTheme}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: "transparent",
                      fontSize: "0.875rem",
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily:
                          'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      },
                    }}
                    wrapLongLines={false}
                    PreTag="div"
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>
          );
        }
      } else if (region.type === "details") {
        const { summary, content, isOpen } = region.data;
        const detailsId = `details-${key}`;

        // Try to detect if content contains JSON data
        let jsonData = null;
        let isJsonContent = false;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);

        if (jsonMatch) {
          try {
            jsonData = JSON.parse(jsonMatch[1].trim());
            isJsonContent = Array.isArray(jsonData) && jsonData.length > 0;
          } catch (e) {
            // Not valid JSON, render normally
          }
        }

        const isFloating = fullscreenSection === detailsId;

        const detailsKey = key++;
        parts.push(
          <React.Fragment key={detailsKey}>
            <details
              className="my-4 border border-zinc-200 dark:border-zinc-700 rounded-lg"
              open={isOpen !== false}
            >
              <summary className="px-4 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium bg-white rounded-lg">
                <span className="inline-flex items-center gap-2">
                  {summary}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFullscreenSection(isFloating ? null : detailsId);
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Open in floating view"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </button>
                </span>
              </summary>
              <div className="p-3 overflow-auto custom-scrollbar bg-white rounded-lg">
                {isJsonContent && (
                  <div className="mb-3 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadClick(jsonData, summary)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintTable(jsonData, summary)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </Button>
                  </div>
                )}
                {isJsonContent ? (
                  renderTableView(jsonData, detailsId, false)
                ) : (
                  <div className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 overflow-x-auto break-words max-w-full">
                    {renderContent(content.trim())}
                  </div>
                )}
              </div>
            </details>

            {/* Floating Modal */}
            {isFloating && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => setFullscreenSection(null)}
              >
                <div
                  className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {summary}
                      </h3>
                      {isJsonContent && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDownloadClick(jsonData, summary)
                            }
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintTable(jsonData, summary)}
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </Button>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setFullscreenSection(null)}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Close"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* Content */}
                  <div className="flex-1 overflow-auto p-6">
                    {isJsonContent ? (
                      renderTableView(jsonData, detailsId, true)
                    ) : (
                      <div className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 overflow-x-auto break-words max-w-full">
                        {renderContent(content.trim())}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      } else if (region.type === "confirmation") {
        const { operation, sql, message, model } = region.data;
        const confirmationKey = key++;

        // Decode the base64 encoded data
        const decodedSql = atob(sql);
        const decodedMessage = atob(message);

        parts.push(
          <div key={confirmationKey} className="my-4 flex gap-3">
            <Button
              variant="default"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white group relative overflow-hidden"
              onClick={(e) => {
                e.preventDefault();
                if (onConfirmAction) {
                  onConfirmAction(
                    "execute",
                    operation,
                    decodedSql,
                    decodedMessage,
                    model
                  );
                }
              }}
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
              <span className="relative z-10">Execute</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                if (onConfirmAction) {
                  onConfirmAction(
                    "cancel",
                    operation,
                    decodedSql,
                    decodedMessage,
                    model
                  );
                }
              }}
            >
              Cancel
            </Button>
          </div>
        );
      } else if (region.type === "suggestions") {
        const { suggestions } = region.data;
        const suggestionsKey = key++;

        parts.push(
          <div key={suggestionsKey} className="my-4">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              💡 Would you like me to...
            </p>
            <div className="flex flex-row flex-wrap gap-2">
              {suggestions.map((suggestion: string, idx: number) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[200px] justify-start text-left h-auto py-3 px-4 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onSuggestionClick) {
                      const suggestionWithTags = appendDataTags(suggestion);
                      onSuggestionClick(suggestionWithTags);
                    }
                  }}
                >
                  <span className="text-sm whitespace-normal">
                    {suggestion}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        );
      }

      lastIndex = region.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={key++}>
          {processInlineMarkdown(text.substring(lastIndex))}
        </span>
      );
    }

    return parts;
  };

  const processInlineMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let key = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines
      if (trimmedLine === "") {
        i++;
        continue;
      }

      // Check for horizontal rule (---)
      if (/^---+$/.test(trimmedLine)) {
        elements.push(
          <hr
            key={key++}
            className="my-4 border-t border-zinc-300 dark:border-zinc-700"
          />
        );
        i++;
        continue;
      }

      // Check for headers (###, ##, #)
      const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const content = headerMatch[2];
        const headerTag = `h${level}`;
        const headerClasses = {
          1: "text-2xl font-bold mb-3 mt-4 text-zinc-900 dark:text-zinc-100",
          2: "text-xl font-bold mb-3 mt-4 text-zinc-900 dark:text-zinc-100",
          3: "text-lg font-bold mb-2 mt-3 text-zinc-900 dark:text-zinc-100",
          4: "text-base font-bold mb-2 mt-3 text-zinc-900 dark:text-zinc-100",
          5: "text-sm font-bold mb-2 mt-2 text-zinc-900 dark:text-zinc-100",
          6: "text-xs font-bold mb-2 mt-2 text-zinc-900 dark:text-zinc-100",
        };
        elements.push(
          React.createElement(
            headerTag,
            {
              key: key++,
              className: headerClasses[level as keyof typeof headerClasses],
            },
            processInlineFormatting(content)
          )
        );
        i++;
        continue;
      }

      // Check for ordered list (1., 2., etc.)
      const orderedListMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (orderedListMatch) {
        const listItems: React.ReactNode[] = [];
        while (i < lines.length) {
          const listLine = lines[i].trim();
          const listMatch = listLine.match(/^(\d+)\.\s+(.+)$/);
          if (listMatch) {
            listItems.push(
              <li key={key++} className="mb-1">
                {processInlineFormatting(listMatch[2])}
              </li>
            );
            i++;
          } else if (listLine === "") {
            i++;
            break;
          } else {
            break;
          }
        }
        elements.push(
          <ol
            key={key++}
            className="list-decimal list-outside ml-6 mb-3 space-y-1"
          >
            {listItems}
          </ol>
        );
        continue;
      }

      // Check for unordered list (*, -, +)
      const unorderedListMatch = trimmedLine.match(/^[*\-+]\s+(.+)$/);
      if (unorderedListMatch) {
        const listItems: React.ReactNode[] = [];
        while (i < lines.length) {
          const listLine = lines[i].trim();
          const listMatch = listLine.match(/^[*\-+]\s+(.+)$/);
          if (listMatch) {
            listItems.push(
              <li key={key++} className="mb-1">
                {processInlineFormatting(listMatch[1])}
              </li>
            );
            i++;
          } else if (listLine === "") {
            i++;
            break;
          } else {
            break;
          }
        }
        elements.push(
          <ul
            key={key++}
            className="list-disc list-outside ml-6 mb-3 space-y-1"
          >
            {listItems}
          </ul>
        );
        continue;
      }

      // Regular paragraph
      const paragraphLines: string[] = [];
      while (i < lines.length) {
        const pLine = lines[i].trim();
        if (pLine === "" || /^(#{1,6}\s|---|\d+\.\s|[*\-+]\s)/.test(pLine)) {
          break;
        }
        paragraphLines.push(pLine);
        i++;
      }

      if (paragraphLines.length > 0) {
        elements.push(
          <p
            key={key++}
            className="mb-3 leading-relaxed text-zinc-800 dark:text-zinc-200"
          >
            {processInlineFormatting(paragraphLines.join(" "))}
          </p>
        );
      }
    }

    return elements;
  };

  const processInlineFormatting = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    const matches: Array<{
      type: string;
      start: number;
      end: number;
      content: string;
    }> = [];

    // Process bold (**text**)
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;
    while ((match = boldRegex.exec(text)) !== null) {
      matches.push({
        type: "bold",
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Process italic (*text* or _text_)
    // Updated regex to avoid matching underscores in identifiers like table names
    const italicRegex =
      /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!\w)_(.+?)_(?!\w)/g;
    while ((match = italicRegex.exec(text)) !== null) {
      matches.push({
        type: "italic",
        start: match.index,
        end: match.index + match[0].length,
        content: match[1] || match[2],
      });
    }

    // Process inline code (`code`)
    const inlineCodeRegex = /`([^`]+)`/g;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      matches.push({
        type: "code",
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Sort matches by start position and remove overlaps
    matches.sort((a, b) => a.start - b.start);
    const nonOverlapping: typeof matches = [];
    for (const m of matches) {
      const overlaps = nonOverlapping.some(
        (n) =>
          (m.start >= n.start && m.start < n.end) ||
          (m.end > n.start && m.end <= n.end)
      );
      if (!overlaps) {
        nonOverlapping.push(m);
      }
    }

    // Render matches
    nonOverlapping.forEach((m) => {
      if (m.start > lastIndex) {
        parts.push(text.substring(lastIndex, m.start));
      }

      if (m.type === "bold") {
        parts.push(
          <strong
            key={key++}
            className="font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {m.content}
          </strong>
        );
      } else if (m.type === "italic") {
        parts.push(
          <em key={key++} className="italic text-zinc-800 dark:text-zinc-200">
            {m.content}
          </em>
        );
      } else if (m.type === "code") {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono text-zinc-900 dark:text-zinc-100"
          >
            {m.content}
          </code>
        );
      }

      lastIndex = m.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <>
      <div className="markdown-content">
        <style jsx>{`
          details[open] summary .transition-transform {
            transform: rotate(90deg);
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(156, 163, 175, 0.5);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(156, 163, 175, 0.7);
          }
        `}</style>
        {renderContent(content)}
      </div>

      {/* Download Format Dialog */}
      <AlertDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
      >
        <AlertMsgContent>
          <AlertMsgHeader>
            <AlertMsgTitle>Download Data</AlertMsgTitle>
            <AlertMsgDescription>
              Choose the format you want to download the data.
            </AlertMsgDescription>
          </AlertMsgHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-blue-50 dark:hover:bg-blue-950"
              onClick={downloadAsJSON}
            >
              <FileJson className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="text-center">
                <p className="font-semibold text-sm">JSON</p>
                <p className="text-xs text-zinc-500">Data format</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={downloadAsCSV}
            >
              <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="text-center">
                <p className="font-semibold text-sm">CSV</p>
                <p className="text-xs text-zinc-500">Spreadsheet</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-orange-50 dark:hover:bg-orange-950"
              onClick={downloadAsExcel}
            >
              <FileType className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="text-center">
                <p className="font-semibold text-sm">Excel</p>
                <p className="text-xs text-zinc-500">XLS format</p>
              </div>
            </Button>
          </div>
          <AlertMsgFooter>
            <AlertMsgCancel>Cancel</AlertMsgCancel>
          </AlertMsgFooter>
        </AlertMsgContent>
      </AlertDialog>
    </>
  );
}
