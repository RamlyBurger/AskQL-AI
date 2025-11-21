"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/form-btn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { Separator } from "@/components/ui-separator";
import { Input } from "@/components/form-input";
import {
  Database,
  Trash2,
  Eye,
  X,
  Folder,
  FolderPlus,
  FileText,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/chat-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/custom-toast";
import { useAuth } from "@/contexts/auth-context";
import { getDatasets, deleteDataset, type Dataset } from "@/lib/api";

interface FolderItem {
  id: string;
  name: string;
  datasets: Dataset[];
}

export default function DatasetPage() {
  const { token } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [datasetData, setDatasetData] = useState<Record<string, any>[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    type: "dataset" | "folder";
    id: string | number;
  } | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Load datasets and folders on mount
  useEffect(() => {
    loadDatasets();
    loadFolders();
  }, [token]);

  const loadDatasets = async () => {
    if (!token) return;

    try {
      const data = await getDatasets(token);
      setDatasets(data);
    } catch (error) {
      console.error("Failed to load datasets:", error);
    }
  };

  const loadFolders = () => {
    // Load folders from localStorage
    const savedFolders = localStorage.getItem("dataset-folders");
    if (savedFolders) {
      setFolders(JSON.parse(savedFolders));
    }
  };

  const saveFolders = (updatedFolders: FolderItem[]) => {
    setFolders(updatedFolders);
    localStorage.setItem("dataset-folders", JSON.stringify(updatedFolders));
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: FolderItem = {
      id: Date.now().toString(),
      name: newFolderName,
      datasets: [],
    };

    saveFolders([...folders, newFolder]);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  const deleteFolder = (folderId: string) => {
    if (
      !confirm(
        "Delete this folder? Datasets will be moved back to the main area."
      )
    )
      return;

    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      // Move datasets back to main area
      setDatasets([...datasets, ...folder.datasets]);
      saveFolders(folders.filter((f) => f.id !== folderId));
    }
  };

  const renameFolder = (folderId: string, newName: string) => {
    const updatedFolders = folders.map((f) =>
      f.id === folderId ? { ...f, name: newName } : f
    );
    saveFolders(updatedFolders);
  };

  const toggleFolder = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    if (newOpenFolders.has(folderId)) {
      newOpenFolders.delete(folderId);
    } else {
      newOpenFolders.add(folderId);
    }
    setOpenFolders(newOpenFolders);
  };

  const handleDeleteDataset = async (datasetId: number) => {
    if (!token) return;

    if (!confirm("Are you sure you want to delete this dataset?")) return;

    try {
      await deleteDataset(token, datasetId);

      // Remove from datasets list
      setDatasets(datasets.filter((d) => d.id !== datasetId));

      // Remove from folders
      const updatedFolders = folders.map((folder) => ({
        ...folder,
        datasets: folder.datasets.filter((d) => d.id !== datasetId),
      }));
      saveFolders(updatedFolders);

      if (selectedDataset?.id === datasetId) {
        setSelectedDataset(null);
        setDatasetData([]);
      }
    } catch (error) {
      console.error("Failed to delete dataset:", error);
      alert("Failed to delete dataset");
    }
  };

  const handleViewDataset = async (dataset: Dataset) => {
    if (!token) return;

    setSelectedDataset(dataset);
    setIsLoadingData(true);

    try {
      const { getDatasetData } = await import("@/lib/api");
      const result = await getDatasetData(token, dataset.id, 100, 0);
      setDatasetData(result.data);
    } catch (error) {
      console.error("Failed to load dataset data:", error);
      alert("Failed to load dataset data");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    type: "dataset" | "folder",
    id: string | number
  ) => {
    setDraggedItem({ type, id });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem || draggedItem.type !== "dataset") return;

    const datasetId = draggedItem.id as number;

    // Find the dataset
    let dataset = datasets.find((d) => d.id === datasetId);
    let sourceFolderId: string | null = null;

    if (!dataset) {
      // Check if it's in a folder
      for (const folder of folders) {
        const found = folder.datasets.find((d) => d.id === datasetId);
        if (found) {
          dataset = found;
          sourceFolderId = folder.id;
          break;
        }
      }
    }

    if (!dataset) return;

    // Don't do anything if dragging to the same folder
    if (sourceFolderId === targetFolderId) {
      setDraggedItem(null);
      return;
    }

    // Check if dataset is already in target folder
    const targetFolder = folders.find((f) => f.id === targetFolderId);
    if (targetFolder && targetFolder.datasets.some((d) => d.id === datasetId)) {
      setDraggedItem(null);
      return;
    }

    // Remove from source
    if (sourceFolderId) {
      const updatedFolders = folders.map((f) => {
        if (f.id === sourceFolderId) {
          return {
            ...f,
            datasets: f.datasets.filter((d) => d.id !== datasetId),
          };
        }
        return f;
      });
      setFolders(updatedFolders);
    } else {
      setDatasets(datasets.filter((d) => d.id !== datasetId));
    }

    // Add to target folder
    const updatedFolders = folders.map((f) => {
      if (f.id === targetFolderId) {
        return { ...f, datasets: [...f.datasets, dataset!] };
      }
      return f;
    });
    saveFolders(updatedFolders);

    setDraggedItem(null);
  };

  const handleDropOnMain = (e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.type !== "dataset") return;

    const datasetId = draggedItem.id as number;

    // Check if dataset is already in main datasets array
    const alreadyInMain = datasets.some((d) => d.id === datasetId);
    if (alreadyInMain) {
      setDraggedItem(null);
      return;
    }

    // Find the dataset in folders
    for (const folder of folders) {
      const dataset = folder.datasets.find((d) => d.id === datasetId);
      if (dataset) {
        // Remove from folder
        const updatedFolders = folders.map((f) => {
          if (f.id === folder.id) {
            return {
              ...f,
              datasets: f.datasets.filter((d) => d.id !== datasetId),
            };
          }
          return f;
        });
        saveFolders(updatedFolders);

        // Add to main datasets
        setDatasets([...datasets, dataset]);
        break;
      }
    }

    setDraggedItem(null);
  };

  // Get datasets not in any folder
  const getUngroupedDatasets = () => {
    const folderDatasetIds = new Set(
      folders.flatMap((f) => f.datasets.map((d) => d.id))
    );
    return datasets.filter((d) => !folderDatasetIds.has(d.id));
  };

  const ungroupedDatasets = getUngroupedDatasets();

  const renderDatasetCard = (dataset: Dataset, inFolder = false) => (
    <div
      key={dataset.id}
      draggable
      onDragStart={(e) => handleDragStart(e, "dataset", dataset.id)}
      onDoubleClick={() => handleViewDataset(dataset)}
      className={`group relative p-3 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-move select-none ${
        draggedItem?.type === "dataset" && draggedItem.id === dataset.id
          ? "opacity-50"
          : ""
      }`}
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className="relative">
          <FileText
            className="h-12 w-12 text-blue-500 dark:text-blue-400"
            strokeWidth={1.5}
          />
          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded px-1 border border-zinc-200 dark:border-zinc-700">
            <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-400">
              {dataset.file_type.toUpperCase()}
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate w-full max-w-[120px]">
          {dataset.name}
        </p>
      </div>

      {/* Action buttons on hover */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 bg-white dark:bg-zinc-800 shadow-sm"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewDataset(dataset)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteDataset(dataset.id)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <MainLayout page="dataset">
      <div className="flex h-full overflow-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Datasets
              </h1>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Organize your datasets with folders. Drag and drop to organize.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateFolderOpen(true)}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
          </div>

          {/* Main Content Area */}
          <div
            className="min-h-[400px] bg-white dark:bg-zinc-900 p-6"
            onDragOver={handleDragOver}
            onDrop={handleDropOnMain}
          >
            {/* Combined Grid - Folders and Datasets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2">
              {/* Render Folders */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`group relative p-3 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer select-none ${
                    draggedItem?.type === "dataset"
                      ? "ring-2 ring-blue-400 dark:ring-blue-600 ring-opacity-50"
                      : ""
                  }`}
                  onClick={() => toggleFolder(folder.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnFolder(e, folder.id)}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <Folder
                      className={`h-12 w-12 ${
                        openFolders.has(folder.id)
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-amber-400 dark:text-amber-500"
                      }`}
                      strokeWidth={1.5}
                      fill="currentColor"
                      fillOpacity={0.3}
                    />
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate w-full max-w-[120px]">
                      {folder.name}
                    </p>
                    {folder.datasets.length > 0 && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {folder.datasets.length} item
                        {folder.datasets.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Folder actions on hover */}
                  <div
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 bg-white dark:bg-zinc-800 shadow-sm"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const name = prompt(
                              "Enter new folder name:",
                              folder.name
                            );
                            if (name) renameFolder(folder.id, name);
                          }}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteFolder(folder.id)}
                          className="text-red-600 dark:text-red-400"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {/* Render Ungrouped Datasets */}
              {ungroupedDatasets.map((dataset) => renderDatasetCard(dataset))}
            </div>

            {/* Expanded Folder Contents */}
            {folders.map(
              (folder) =>
                openFolders.has(folder.id) &&
                folder.datasets.length > 0 && (
                  <div
                    key={`expanded-${folder.id}`}
                    className="mt-6 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Folder className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {folder.name}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2">
                      {folder.datasets.map((dataset) =>
                        renderDatasetCard(dataset, true)
                      )}
                    </div>
                  </div>
                )
            )}

            {/* Empty state */}
            {ungroupedDatasets.length === 0 && folders.length === 0 && (
              <div className="text-center py-16">
                <Database className="h-16 w-16 mx-auto text-zinc-400 dark:text-zinc-600 mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  No datasets yet
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Upload your first dataset using the right sidebar
                </p>
              </div>
            )}
          </div>

          {/* Dataset Data Viewer */}
          {selectedDataset && (
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedDataset.name}</CardTitle>
                    <CardDescription>
                      {selectedDataset.row_count} rows ×{" "}
                      {selectedDataset.column_count} columns
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDataset(null);
                      setDatasetData([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                  </div>
                ) : datasetData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800">
                          {Object.keys(datasetData[0]).map((column) => (
                            <th
                              key={column}
                              className="px-4 py-3 text-left font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900/50"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {datasetData.map((row, index) => (
                          <tr
                            key={index}
                            className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                          >
                            {Object.values(row).map((value, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-4 py-3 text-zinc-700 dark:text-zinc-300"
                              >
                                {value !== null && value !== undefined
                                  ? String(value)
                                  : "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    No data available
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for your new folder to organize datasets.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
