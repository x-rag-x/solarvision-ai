import React, { useState, useRef, useEffect } from "react";
import { Download, Maximize2, Minimize2, Move, RotateCcw, ZoomIn, ZoomOut, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFECT_CLASSES } from "@/lib/defects";
import type { DetectionBox } from "./ImageViewer";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalUrl?: string | null;
  annotatedUrl?: string | null;
  cleanUrl?: string | null;
  filename: string;
  detectionsCount?: number;
  detections?: DetectionBox[];
  highlightedIndex?: number | null;
  onHighlightIndex?: (index: number | null) => void;
}

export function ImageViewerModal({
  isOpen,
  onClose,
  originalUrl,
  annotatedUrl,
  cleanUrl,
  filename,
  detectionsCount = 0,
  detections = [],
  highlightedIndex = null,
  onHighlightIndex,
}: ImageViewerModalProps) {
  const [activeTab, setActiveTab] = useState<"predictions" | "original" | "backend">(
    "predictions"
  );
  const [zoom, setZoom] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const cleanSource = cleanUrl || originalUrl || null;

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  }, [activeTab, cleanSource, annotatedUrl]);

  if (!isOpen) return null;

  // Single authoritative source:
  // If viewing predictions, use clean image with React overlays.
  // If clean image is unavailable, fall back to backend-annotated image without React overlay.
  let currentImage = cleanSource || annotatedUrl || "";
  let shouldRenderOverlay = false;

  if (activeTab === "original") {
    currentImage = cleanSource || annotatedUrl || "";
    shouldRenderOverlay = false;
  } else if (activeTab === "backend") {
    currentImage = annotatedUrl || cleanSource || "";
    shouldRenderOverlay = false;
  } else {
    // "predictions" tab
    if (cleanSource) {
      currentImage = cleanSource;
      shouldRenderOverlay = showBoxes && detections.length > 0;
    } else {
      currentImage = annotatedUrl || "";
      shouldRenderOverlay = false; // Prevent double annotations if underlying image is already annotated
    }
  }

  const effectiveDetectionsCount = detections.length > 0 ? detections.length : detectionsCount;

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

  const getBoxStyle = (det: DetectionBox, isHighlighted: boolean) => {
    const rawBox = det.box_2d || det.bbox;
    if (!rawBox || rawBox.length < 4) return null;

    const [b0, b1, b2, b3] = rawBox;
    const imgW = imageSize?.width || imgRef.current?.naturalWidth;
    const imgH = imageSize?.height || imgRef.current?.naturalHeight;

    let top = 0;
    let left = 0;
    let width = 0;
    let height = 0;

    if (det.box_2d) {
      const ymin = b0;
      const xmin = b1;
      const ymax = b2;
      const xmax = b3;

      if (ymin <= 1.01 && xmin <= 1.01 && ymax <= 1.01 && xmax <= 1.01) {
        top = ymin * 100;
        left = xmin * 100;
        height = (ymax - ymin) * 100;
        width = (xmax - xmin) * 100;
      } else if (imgW && imgH) {
        top = (ymin / imgH) * 100;
        left = (xmin / imgW) * 100;
        height = ((ymax - ymin) / imgH) * 100;
        width = ((xmax - xmin) / imgW) * 100;
      } else {
        top = ymin / 10;
        left = xmin / 10;
        height = (ymax - ymin) / 10;
        width = (xmax - xmin) / 10;
      }
    } else {
      const x1 = b0;
      const y1 = b1;
      const x2 = b2;
      const y2 = b3;

      if (x1 <= 1.01 && y1 <= 1.01 && x2 <= 1.01 && y2 <= 1.01) {
        left = x1 * 100;
        top = y1 * 100;
        width = (x2 - x1) * 100;
        height = (y2 - y1) * 100;
      } else if (imgW && imgH) {
        left = (x1 / imgW) * 100;
        top = (y1 / imgH) * 100;
        width = ((x2 - x1) / imgW) * 100;
        height = ((y2 - y1) / imgH) * 100;
      } else {
        const maxVal = Math.max(x1, y1, x2, y2);
        const factor = maxVal > 1000 ? maxVal / 100 : 10;
        left = x1 / factor;
        top = y1 / factor;
        width = (x2 - x1) / factor;
        height = (y2 - y1) / factor;
      }
    }

    const defectInfo = DEFECT_CLASSES[det.class] || {
      color: "#F2B941",
      label: det.class,
    };

    const clampedLeft = Math.max(0, Math.min(100, left));
    const clampedTop = Math.max(0, Math.min(100, top));
    const clampedWidth = Math.max(0.2, Math.min(100 - clampedLeft, width));
    const clampedHeight = Math.max(0.2, Math.min(100 - clampedTop, height));

    return {
      top: `${clampedTop}%`,
      left: `${clampedLeft}%`,
      width: `${clampedWidth}%`,
      height: `${clampedHeight}%`,
      borderColor: defectInfo.color,
      backgroundColor: isHighlighted ? `${defectInfo.color}33` : `${defectInfo.color}15`,
      isNearTop: clampedTop < 6,
    };
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
                {effectiveDetectionsCount} defect{effectiveDetectionsCount === 1 ? "" : "s"} identified · Zoom: {Math.round(zoom * 100)}%
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-white/10 rounded-xl p-1 text-xs gap-1">
            <button
              onClick={() => setActiveTab("predictions")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "predictions"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Predictions
            </button>
            {cleanSource && (
              <button
                onClick={() => setActiveTab("original")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === "original"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Raw Cell
              </button>
            )}
            {annotatedUrl && cleanSource && (
              <button
                onClick={() => setActiveTab("backend")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === "backend"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                OpenCV
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {detections.length > 0 && activeTab === "predictions" && cleanSource && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBoxes(b => !b)}
                className={`h-8 px-2.5 text-xs transition-colors ${
                  showBoxes ? "text-white bg-white/15" : "text-slate-400 hover:text-white"
                }`}
                title="Toggle bounding boxes"
              >
                <Layers className="h-3.5 w-3.5 mr-1" />
                Boxes
              </Button>
            )}
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
              className="relative inline-block transition-transform duration-150 ease-out"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            >
              <img
                ref={imgRef}
                src={currentImage}
                onLoad={e => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalWidth > 0 && naturalHeight > 0) {
                    setImageSize({ width: naturalWidth, height: naturalHeight });
                  }
                }}
                alt={`${filename} - ${activeTab}`}
                className="max-h-[80vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none block pointer-events-none"
                draggable={false}
              />

              {/* Authoritative Single Bounding Box Overlay */}
              {shouldRenderOverlay && (
                <div className="absolute inset-0 pointer-events-auto">
                  {detections.map((det, idx) => {
                    const isHighlighted = highlightedIndex === idx;
                    const boxStyle = getBoxStyle(det, isHighlighted);
                    if (!boxStyle) return null;

                    const defectClass = DEFECT_CLASSES[det.class] || {
                      label: det.class,
                      color: "#F2B941",
                    };

                    return (
                      <div
                        key={`modal-pred-${idx}`}
                        style={boxStyle}
                        onMouseEnter={() => onHighlightIndex?.(idx)}
                        onMouseLeave={() => onHighlightIndex?.(null)}
                        onClick={() => onHighlightIndex?.(idx)}
                        className={`absolute border-2 transition-all cursor-pointer ${
                          isHighlighted
                            ? "ring-2 ring-white ring-offset-1 z-30 scale-[1.01]"
                            : "z-10 hover:border-white hover:z-20"
                        }`}
                      >
                        <span
                          style={{ backgroundColor: defectClass.color }}
                          className={`absolute px-1.5 py-0.5 text-[11px] font-bold text-white rounded shadow-sm whitespace-nowrap leading-none select-none pointer-events-none ${
                            boxStyle.isNearTop ? "top-1 left-1" : "-top-5 left-0"
                          }`}
                        >
                          {defectClass.label} · {Math.round(det.confidence * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Image data unavailable</p>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-2.5 bg-black/60 text-xs text-slate-400">
          <span>YOLO26n Single-Stage Object Detection · Prediction Only Mode</span>
          <span>Tip: Use zoom controls above to inspect hairline cracks and contact finger breaks</span>
        </div>
      </div>
    </div>
  );
}