import React, { useState } from "react";
import { Download, Maximize2, Minimize2, Move, RotateCcw, ZoomIn, ZoomOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalUrl?: string | null;
  annotatedUrl?: string | null;
  filename: string;
  detectionsCount?: number;
}

export function ImageViewerModal({
  isOpen,
  onClose,
  originalUrl,
  annotatedUrl,
  filename,
  detectionsCount = 0,
}: ImageViewerModalProps) {
  const [activeTab, setActiveTab] = useState<"annotated" | "original">(
    annotatedUrl ? "annotated" : "original"
  );
  const [zoom, setZoom] = useState(1);

  if (!isOpen) return null;

  const currentImage = activeTab === "annotated" ? (annotatedUrl || originalUrl) : originalUrl;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
  const handleResetZoom = () => setZoom(1);

  const handleDownload = () => {
    if (!currentImage) return;
    const a = document.createElement("a");
    a.href = currentImage;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}-${activeTab}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6">
      <div className="relative flex flex-col h-[92vh] w-[95vw] max-w-6xl rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden text-white">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-black/40">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <h3 className="text-sm font-semibold truncate text-slate-100">{filename}</h3>
              <p className="text-xs text-slate-400">
                {detectionsCount} defect{detectionsCount === 1 ? "" : "s"} identified · Zoom: {Math.round(zoom * 100)}%
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          {annotatedUrl && originalUrl && (
            <div className="flex items-center bg-white/10 rounded-xl p-1 text-xs">
              <button
                onClick={() => setActiveTab("annotated")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === "annotated"
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Annotated YOLO Bounding Boxes
              </button>
              <button
                onClick={() => setActiveTab("original")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === "original"
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Original Raw Frame
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleZoomOut}
              className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-white/10"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetZoom}
              className="h-8 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/10"
              title="Reset Zoom"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              1:1
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleZoomIn}
              className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-white/10"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="h-8 gap-1.5 text-xs border-white/20 bg-white/5 text-slate-200 hover:bg-white/15"
              title="Download image"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              Export
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 ml-2"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Image Canvas / Viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black cursor-grab active:cursor-grabbing">
          {currentImage ? (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            >
              <img
                src={currentImage}
                alt={`${filename} - ${activeTab}`}
                className="max-h-[80vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Image data unavailable</p>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-2.5 bg-black/60 text-xs text-slate-400">
          <span>YOLO26n Single-Stage Object Detection · 640px letterbox normalized</span>
          <span>Tip: Use zoom controls above to inspect hairline cracks and contact finger breaks</span>
        </div>
      </div>
    </div>
  );
}
