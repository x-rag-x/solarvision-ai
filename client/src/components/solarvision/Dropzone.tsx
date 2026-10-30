import React, { useRef, useState, useEffect, useCallback } from "react";
import { UploadCloud, FileImage, AlertCircle, X, Clipboard } from "lucide-react";
import { toast } from "sonner";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClearFile?: () => void;
  maxSizeBytes?: number; // e.g. 35MB (35 * 1024 * 1024) or 8MiB
  acceptedTypes?: string[];
  title?: string;
  subtitle?: string;
  enablePaste?: boolean;
  enableGlobalDrop?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Dropzone({
  onFileSelect,
  selectedFile,
  onClearFile,
  maxSizeBytes = 35 * 1024 * 1024,
  acceptedTypes = ["image/jpeg", "image/png", "image/jpg"],
  title = "Drop solar-cell EL / NIR image here",
  subtitle = "Or click to browse from machine storage. Clipboard paste (Ctrl+V) supported.",
  enablePaste = true,
  enableGlobalDrop = true,
  disabled = false,
  className = "",
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGlobalDragOver, setIsGlobalDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const validateAndSelect = useCallback(
    (file: File) => {
      if (disabled) return;

      if (!acceptedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png)$/i)) {
        toast.error("Unsupported file format", {
          description: `Allowed types: ${acceptedTypes.map(t => t.split("/")[1]?.toUpperCase()).join(", ")}`,
        });
        return;
      }

      if (file.size > maxSizeBytes) {
        toast.error("File exceeds maximum transport ceiling", {
          description: `Selected file is ${formatSize(file.size)}. Maximum allowed is ${formatSize(maxSizeBytes)}.`,
        });
        return;
      }

      onFileSelect(file);
      toast.success("File attached", {
        description: `${file.name} (${formatSize(file.size)})`,
      });
    },
    [disabled, acceptedTypes, maxSizeBytes, onFileSelect]
  );

  // Clipboard paste listener
  useEffect(() => {
    if (!enablePaste || disabled) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            validateAndSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enablePaste, disabled, validateAndSelect]);

  // Global window drag & drop listener
  useEffect(() => {
    if (!enableGlobalDrop || disabled) return;

    let dragCounter = 0;

    const handleWindowDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounter++;
        setIsGlobalDragOver(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          setIsGlobalDragOver(false);
        }
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      dragCounter = 0;
      setIsGlobalDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        validateAndSelect(files[0]);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
      }
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [enableGlobalDrop, disabled, validateAndSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Global drag overlay */}
      {isGlobalDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sapphire-dark/60 backdrop-blur-xs text-white p-6 animate-in fade-in">
          <div className="rounded-3xl border-2 border-dashed border-sapphire bg-surface p-10 text-center max-w-md shadow-2xl">
            <UploadCloud className="mx-auto h-12 w-12 text-sapphire mb-3 animate-bounce" />
            <h3 className="text-lg font-bold text-sapphire">Release to Attach Solar Image</h3>
            <p className="mt-1 text-xs text-text-3">File will be routed to the active inspection pipeline.</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) validateAndSelect(file);
          e.target.value = "";
        }}
        className="hidden"
        disabled={disabled}
      />

      {selectedFile ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-subtle p-3.5 transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface border border-border text-text">
              <FileImage className="h-5 w-5 text-sapphire" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-xs font-mono text-text-3">
                <span>{formatSize(selectedFile.size)}</span>
                <span>•</span>
                <span className="uppercase">{selectedFile.type.split("/")[1] || "IMAGE"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-sapphire transition-colors"
            >
              Replace
            </button>
            {onClearFile && (
              <button
                type="button"
                onClick={onClearFile}
                className="grid h-8 w-8 place-items-center rounded-lg text-text-3 hover:text-danger hover:bg-danger-tint transition-colors"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
            isDragOver
              ? "border-sapphire bg-sapphire/5 scale-[0.99]"
              : "border-border bg-surface hover:border-sapphire/40 hover:bg-surface-subtle/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-surface-subtle text-sapphire border border-border">
            <UploadCloud className="h-5 w-5 text-sapphire" />
          </div>

          <p className="text-xs sm:text-sm font-semibold text-sapphire">{title}</p>
          <p className="mt-1 max-w-sm text-xs text-text-3 leading-relaxed">
            {subtitle}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-text-3 font-mono">
            <span className="rounded bg-surface-subtle px-2 py-0.5 border border-border">
              Max {formatSize(maxSizeBytes)}
            </span>
            <span className="rounded bg-surface-subtle px-2 py-0.5 border border-border">
              JPG, PNG
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded bg-surface-subtle px-2 py-0.5 border border-border">
              <Clipboard className="h-3 w-3" /> Ctrl+V Paste
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dropzone;
