import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Eye, Layers, Maximize2, Minimize2 } from "lucide-react";
import { DEFECT_CLASSES } from "@/lib/defects";

export interface DetectionBox {
  id?: string | number;
  class: string;
  label?: string;
  confidence: number;
  box_2d?: [number, number, number, number] | number[];
  bbox?: [number, number, number, number];
  severity?: "critical" | "high" | "medium";
}

interface ImageViewerProps {
  imageUrl: string;
  originalImageUrl?: string;
  detections?: DetectionBox[];
  highlightedIndex?: number | null;
  onHighlightIndex?: (index: number | null) => void;
  className?: string;
  title?: string;
}

export function ImageViewer({
  imageUrl,
  originalImageUrl,
  detections = [],
  highlightedIndex = null,
  onHighlightIndex,
  className = "",
  title = "EL Surface Inspection",
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSrc = showOriginal && originalImageUrl ? originalImageUrl : imageUrl;

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.75));
  const handleResetZoom = () => setScale(1);

  // Normalize bounding box coordinates to [ymin, xmin, ymax, xmax] or [x1, y1, x2, y2]
  // In YOLO/SolarVision, box coordinates can be 0..1000 or 0..1 or absolute pixel coords
  const getBoxStyle = (det: DetectionBox, isHighlighted: boolean) => {
    const rawBox = det.box_2d || det.bbox;
    if (!rawBox || rawBox.length < 4) return null;

    let [b0, b1, b2, b3] = rawBox;
    // If coords are in 0..1000 scale, normalize to percentages
    const isThousand = b0 > 1 || b1 > 1 || b2 > 1 || b3 > 1;
    const factor = isThousand ? 10 : 100;

    let top = 0;
    let left = 0;
    let width = 0;
    let height = 0;

    // Detect format: box_2d is [ymin, xmin, ymax, xmax]
    if (det.box_2d) {
      top = b0 / factor;
      left = b1 / factor;
      height = (b2 - b0) / factor;
      width = (b3 - b1) / factor;
    } else {
      // bbox is [x1, y1, x2, y2]
      left = b0 / factor;
      top = b1 / factor;
      width = (b2 - b0) / factor;
      height = (b3 - b1) / factor;
    }

    const defectInfo = DEFECT_CLASSES[det.class] || {
      color: "#F2B941",
      label: det.class,
    };

    return {
      top: `${Math.max(0, top)}%`,
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
      height: `${Math.min(100 - top, height)}%`,
      borderColor: defectInfo.color,
      backgroundColor: isHighlighted ? `${defectInfo.color}33` : `${defectInfo.color}15`,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col rounded-xl border border-border bg-ink/95 overflow-hidden text-white shadow-xs select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""
      } ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 bg-ink/70 backdrop-blur-xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/90 truncate">{title}</span>
          {detections.length > 0 && showAnnotations && !showOriginal && (
            <span className="rounded-full bg-brand/20 border border-brand/40 px-2 py-0.5 font-mono text-xs text-brand">
              {detections.length} {detections.length === 1 ? "defect" : "defects"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {originalImageUrl && (
            <button
              onClick={() => setShowOriginal(o => !o)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                showOriginal
                  ? "bg-brand text-ink font-semibold"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title="Toggle original unprocessed image vs model prediction"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{showOriginal ? "Original" : "Annotated"}</span>
            </button>
          )}

          {detections.length > 0 && !showOriginal && (
            <button
              onClick={() => setShowAnnotations(a => !a)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                showAnnotations
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
              title="Toggle bounding box layer"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Boxes</span>
            </button>
          )}

          <div className="h-4 w-px bg-white/15 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-xs text-white/60 min-w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-3 w-3" />
          </button>

          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors ml-1"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 min-h-[360px] max-h-[640px] flex items-center justify-center overflow-auto p-4 bg-ink/90">
        <div
          className="relative inline-block transition-transform duration-100 ease-out max-w-full"
          style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
        >
          <img
            src={activeSrc}
            alt={title}
            className="block max-h-[580px] w-auto object-contain rounded border border-white/10 shadow-2xl pointer-events-none"
          />

          {/* Defect Bounding Boxes Overlay */}
          {showAnnotations && !showOriginal && (
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
                    key={idx}
                    style={boxStyle}
                    onMouseEnter={() => onHighlightIndex?.(idx)}
                    onMouseLeave={() => onHighlightIndex?.(null)}
                    onClick={() => onHighlightIndex?.(idx)}
                    className={`absolute border-2 transition-all cursor-pointer ${
                      isHighlighted
                        ? "ring-2 ring-white ring-offset-1 z-20 scale-[1.01]"
                        : "z-10 hover:border-white"
                    }`}
                  >
                    <span
                      style={{ backgroundColor: defectClass.color }}
                      className="absolute -top-5 left-0 px-1.5 py-0.5 text-xs font-bold text-white rounded shadow-sm whitespace-nowrap leading-none"
                    >
                      {defectClass.label} · {Math.round(det.confidence * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Legend */}
      {detections.length > 0 && showAnnotations && !showOriginal && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-2 bg-ink/80 text-xs text-white/70">
          <span className="font-semibold text-white/90">Legend:</span>
          {Array.from(new Set(detections.map(d => d.class))).map(clsKey => {
            const info = DEFECT_CLASSES[clsKey] || { label: clsKey, color: "#F2B941" };
            return (
              <span key={clsKey} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: info.color }}
                />
                <span className="text-white/80">{info.label}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ImageViewer;
