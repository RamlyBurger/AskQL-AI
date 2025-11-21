"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/form-btn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { Progress } from "@/components/icon-status";
import { ScrollArea } from "@/components/field-scrollable";
import {
  Upload,
  X,
  Database,
  CheckCircle2,
  Trash2,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  uploadDatasets,
  getDatasets,
  deleteDataset,
  type Dataset,
} from "@/lib/api";
import {
  AlertDialog,
  AlertMsgAction,
  AlertMsgCancel,
  AlertMsgContent,
  AlertMsgDescription,
  AlertMsgFooter,
  AlertMsgHeader,
  AlertMsgTitle,
  AlertMsgTrigger,
} from "@/components/alert-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/custom-toast";
import { Input } from "@/components/form-input";
import { Label } from "@/components/form-label";
import { toast } from "sonner";

interface DatasetSidebarProps {
  isCollapsed: boolean;
  onDatasetsChange?: () => void;
}

export function DatasetSidebar({
  isCollapsed,
  onDatasetsChange,
}: DatasetSidebarProps) {
  const { token } = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<{ [key: number]: string }>({});
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      isValidFileType(file.name)
    );

    if (files.length > 0) {
      setUploadedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = Array.from(files).filter((file) =>
        isValidFileType(file.name)
      );

      setUploadedFiles((prev) => [...prev, ...validFiles]);
    }
    // Reset input value to allow re-selecting the same file
    e.target.value = "";
  };

  const isValidFileType = (filename: string) => {
    const validExtensions = [
      ".csv",
      ".xlsx",
      ".xls",
      ".json",
      ".db",
      ".sqlite",
      ".sqlite3",
    ];
    return validExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    loadDatasets();
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

  const handleUploadDataset = async () => {
    if (uploadedFiles.length === 0 || !token) return;

    setUploadStatus("uploading");
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      await uploadDatasets(token, uploadedFiles);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus("success");

      // Show success message with toast
      toast.success(
        `Successfully uploaded ${uploadedFiles.length} dataset${
          uploadedFiles.length > 1 ? "s" : ""
        }`
      );

      // Clear uploaded files and reset state
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadedFiles([]);
        setFileNames({});
        setUploadProgress(0);
        loadDatasets();
        onDatasetsChange?.();
      }, 1500);
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error("Failed to upload dataset:", error);
      setUploadStatus("error");
      setUploadProgress(0);

      // Show error message
      toast.error(error.message || "Failed to upload datasets");

      setTimeout(() => setUploadStatus("idle"), 3000);
    }
  };

  const handleDeleteDataset = async (datasetId: number) => {
    if (!token) return;

    try {
      await deleteDataset(token, datasetId);
      loadDatasets();
      onDatasetsChange?.();
      toast.success("Dataset deleted successfully");
    } catch (error) {
      console.error("Failed to delete dataset:", error);
      toast.error("Failed to delete dataset");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const lowerName = filename.toLowerCase();
    if (lowerName.endsWith(".csv")) return "/csv.png";
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls"))
      return "/excel.png";
    if (lowerName.endsWith(".json")) return "/folder.png";
    if (
      lowerName.endsWith(".db") ||
      lowerName.endsWith(".sqlite") ||
      lowerName.endsWith(".sqlite3")
    )
      return "/folder.png";
    return "/folder.png";
  };

  return (
    <div
      className={`
        border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-full w-full
        transition-all duration-300 ease-in-out
      `}
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Datasets
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Upload and manage datasets
            </p>
          </div>

          {/* Upload Area */}
          <CardContent className="px-0 space-y-4">
            <label
              htmlFor="dataset-file-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                  group relative border-2 rounded-lg p-6 transition-all cursor-pointer block
                  ${
                    isDragging
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 border-dashed"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white border-dashed"
                  }
                `}
            >
              <input
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,.json,.db,.sqlite,.sqlite3"
                onChange={handleFileSelect}
                className="hidden"
                id="dataset-file-upload"
              />

              <div className="flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
                <div className="relative w-12 h-12">
                  {/* Static PNG shown by default */}
                  <Image
                    src="/file.png"
                    alt="Upload folder"
                    width={48}
                    height={48}
                    className="opacity-60 transition-opacity group-hover:opacity-0"
                  />
                  {/* Animated GIF shown on hover */}
                  <Image
                    src="/file.gif"
                    alt="Upload folder animated"
                    width={48}
                    height={48}
                    className="opacity-0 group-hover:opacity-60 transition-opacity absolute inset-0"
                    unoptimized
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Upload Datasets
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Click or drag files inside here...
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                    .csv
                  </span>
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                    .xlsx
                  </span>
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                    .json
                  </span>
                </div>
              </div>
            </label>

            {/* Selected Files */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Image
                        src={getFileIcon(file.name)}
                        alt={file.name}
                        width={24}
                        height={24}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {fileNames[index] || file.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setRenamingIndex(index);
                          setNewFileName(
                            fileNames[index] ||
                              file.name.replace(/\.[^/.]+$/, "")
                          );
                          setRenameDialogOpen(true);
                        }}
                        className="h-6 w-6 text-zinc-500 hover:text-blue-600"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="h-6 w-6 text-zinc-500 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress */}
            {uploadStatus === "uploading" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Uploading...
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUploadDataset}
              disabled={
                uploadedFiles.length === 0 || uploadStatus === "uploading"
              }
              className="w-full gap-2"
              size="sm"
            >
              {uploadStatus === "uploading" && (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {uploadStatus === "success" && (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {uploadStatus === "idle" && <Upload className="h-3 w-3" />}
              <span>
                {uploadStatus === "uploading"
                  ? "Uploading..."
                  : uploadStatus === "success"
                  ? "Uploaded!"
                  : "Upload"}
              </span>
            </Button>

            {uploadStatus === "error" && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-2">
                <p className="text-xs text-red-800 dark:text-red-200">
                  Upload failed. Try again.
                </p>
              </div>
            )}
          </CardContent>

          {/* Rename Dialog */}
          <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Dataset</DialogTitle>
                <DialogDescription>
                  Enter a proper name for your dataset. This will be used as the
                  table name.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="dataset-name">Dataset Name</Label>
                  <Input
                    id="dataset-name"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="e.g., Walmart_Sales"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRenameDialogOpen(false);
                    setRenamingIndex(null);
                    setNewFileName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (renamingIndex !== null && newFileName.trim()) {
                      setFileNames((prev) => ({
                        ...prev,
                        [renamingIndex]: newFileName.trim(),
                      }));
                      setRenameDialogOpen(false);
                      setRenamingIndex(null);
                      setNewFileName("");
                      toast.success("Dataset renamed successfully");
                    }
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Datasets List */}
          {datasets.length > 0 && (
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Your Datasets
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {datasets.length} dataset{datasets.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-2">
                {datasets.map((dataset) => {
                  const iconSrc =
                    dataset.file_type === "csv"
                      ? "/csv.png"
                      : dataset.file_type === "xlsx"
                      ? "/excel.png"
                      : "/folder.png";
                  return (
                    <div
                      key={dataset.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Image
                          src={iconSrc}
                          alt={dataset.file_type}
                          width={20}
                          height={20}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {dataset.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {dataset.row_count} rows · {dataset.column_count}{" "}
                            columns
                          </p>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertMsgTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertMsgTrigger>
                        <AlertMsgContent>
                          <AlertMsgHeader>
                            <AlertMsgTitle>Delete Dataset</AlertMsgTitle>
                            <AlertMsgDescription>
                              Are you sure you want to delete "{dataset.name}"?
                              This action cannot be undone and will permanently
                              remove the dataset from your account.
                            </AlertMsgDescription>
                          </AlertMsgHeader>
                          <AlertMsgFooter>
                            <AlertMsgCancel>Cancel</AlertMsgCancel>
                            <AlertMsgAction
                              onClick={() => handleDeleteDataset(dataset.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete
                            </AlertMsgAction>
                          </AlertMsgFooter>
                        </AlertMsgContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
