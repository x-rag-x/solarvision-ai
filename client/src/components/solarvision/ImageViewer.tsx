import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Eye, Layers, Maximize2, Minimize2, CheckSquare } from "lucide-react";
import { DEFECT_CLASSES } from "@/lib/defects";

export interface DetectionBox {
  id?: string | number;
  class: string;
  label?: string;
  confidence: number;
  box_2d?: [number, number, number, number] | number[];
  bbox?: [number, number, number, number];
  severity?: "critical" | "high" | "medium";
  isGroundTruth?: boolean;
}

interface ImageViewerProps {
  imageUrl: string;
  cleanImageUrl?: string;
  originalImageUrl?: string;
  backendAnnotatedUrl?: string | null;
  isBackendAnnotated?: boolean;
  detections?: DetectionBox[];
  groundTruthBoxes?: DetectionBox[];
  highlightedIndex?: number | null;
  onHighlightIndex?: (index: number | null) => void;
  className?: string;
  title?: string;
  imageDimensions?: { width: number; height: number };
}

export function ImageViewer({
  imageUrl,
  cleanImageUrl,
  originalImageUrl,
  backendAnnotatedUrl,
  isBackendAnnotated = false,
  detections = [],
  groundTruthBoxes = [],
  highlightedIndex = null,
  onHighlightIndex,
  className = "",
  title = "EL Surface Inspection",
  imageDimensions,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showGroundTruth, setShowGroundTruth] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Track intrinsic image dimensions to accurately project absolute pixel coordinates
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    imageDimensions || null
  );

  // Authoritative single-rendering strategy:
  // When displaying predictions, prefer clean unannotated image so React overlay is the sole box.
  // If only a backend-annotated image is provided, isBackendAnnotated is true and React overlays are suppressed.
  const cleanSource = cleanImageUrl || originalImageUrl || (!isBackendAnnotated ? imageUrl : "");
  const annotatedSource = backendAnnotatedUrl || (isBackendAnnotated ? imageUrl : "");

  let activeSrc = imageUrl;
  if (showOriginal && (originalImageUrl || cleanSource)) {
    activeSrc = originalImageUrl || cleanSource;
  } else if (!showOriginal && cleanSource) {
    activeSrc = cleanSource;
  } else if (annotatedSource) {
    activeSrc = annotatedSource;
  }

  // Update dimensions if image is already cached or changes
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setImageSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  }, [activeSrc]);

  // Determine if the underlying active image already has backend annotations baked into its pixels
  const isUnderlyingAnnotated = Boolean(
    isBackendAnnotated && activeSrc === annotatedSource && !cleanSource
  );

  // Only render React overlays when annotations are enabled, not viewing raw original,
  // and the underlying image is NOT already annotated by OpenCV
  const shouldRenderOverlays = showAnnotations && !showOriginal && !isUnderlyingAnnotated;

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.75));
  const handleResetZoom = () => setScale(1);

  // Authoritative coordinate projection: converts bounding boxes to percentage coordinates
  const getBoxStyle = (det: DetectionBox, isHighlighted: boolean) => {
    const rawBox = det.box_2d || det.bbox;
    if (!rawBox || rawBox.length < 4) return null;

    const [b0, b1, b2, b3] = rawBox;
    const imgW = imageSize?.width || imageDimensions?.width || imgRef.current?.naturalWidth;
    const imgH = imageSize?.height || imageDimensions?.height || imgRef.current?.naturalHeight;

    let top = 0;
    let left = 0;
    let width = 0;
    let height = 0;

    if (det.box_2d) {
      // box_2d is [ymin, xmin, ymax, xmax]
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
      // bbox is [x1, y1, x2, y2]
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
      borderColor: det.isGroundTruth ? "#06B6D4" : defectInfo.color,
      backgroundColor: isHighlighted
        ? `${defectInfo.color}45`
        : det.isGroundTruth
        ? "transparent"
        : `${defectInfo.color}15`,
      isNearTop: clampedTop < 6,
      borderStyle: det.isGroundTruth ? "dashed" : "solid",
    };
  };

  const visibleDetections = shouldRenderOverlays ? detections : [];
  const visibleGroundTruth = shouldRenderOverlays && showGroundTruth ? groundTruthBoxes : [];

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col rounded-xl border border-white/10 bg-zinc-950 overflow-hidden text-white shadow-xs select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""
      } ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 bg-zinc-900/90 backdrop-blur-xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/90 truncate">{title}</span>
          {visibleDetections.length > 0 && (
            <span className="rounded-full bg-brand/20 border border-brand/40 px-2 py-0.5 font-mono text-xs text-brand">
              {visibleDetections.length} {visibleDetections.length === 1 ? "defect" : "defects"}
            </span>
          )}
          {isUnderlyingAnnotated && (
            <span className="rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-xs text-white/70">
              OpenCV Rendered
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(originalImageUrl || cleanSource) && (
            <button
              onClick={() => setShowOriginal(o => !o)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                showOriginal
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title="Toggle original unprocessed image vs model prediction"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{showOriginal ? "Raw Cell" : "Predictions"}</span>
            </button>
          )}

          {detections.length > 0 && !showOriginal && !isUnderlyingAnnotated && (
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

          {groundTruthBoxes.length > 0 && !showOriginal && (
            <button
              onClick={() => setShowGroundTruth(gt => !gt)}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                showGroundTruth
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/5 text-white/50 hover:bg-white/10 border border-transparent"
              }`}
              title="Optional benchmark Ground Truth comparison (default: prediction only)"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>GT</span>
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
      <div className="relative flex-1 min-h-[360px] max-h-[640px] flex items-center justify-center overflow-auto p-4 bg-zinc-950">
        <div
          className="relative inline-block transition-transform duration-100 ease-out max-w-full"
          style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
        >
          <img
            ref={imgRef}
            src={activeSrc}
            onLoad={handleImageLoad}
            alt={title}
            className="block max-h-[580px] w-auto object-contain rounded border border-white/10 shadow-2xl pointer-events-none"
          />

          {/* Authoritative Defect Bounding Boxes Overlay */}
          {shouldRenderOverlays && (
            <div className="absolute inset-0 pointer-events-auto">
              {/* Ground Truth Layer (Disabled by default, optional comparison) */}
              {visibleGroundTruth.map((gt, idx) => {
                const boxStyle = getBoxStyle({ ...gt, isGroundTruth: true }, false);
                if (!boxStyle) return null;
                return (
                  <div
                    key={`gt-${idx}`}
                    style={boxStyle}
                    className="absolute border-2 border-dashed border-cyan-400 z-5 pointer-events-none"
                  >
                    <span
                      className={`absolute px-1.5 py-0.5 text-[10px] font-bold text-cyan-200 bg-cyan-950/80 border border-cyan-400/40 rounded shadow-sm whitespace-nowrap leading-none select-none ${
                        boxStyle.isNearTop ? "bottom-1 left-1" : "-bottom-5 left-0"
                      }`}
                    >
                      GT: {gt.label || gt.class}
                    </span>
                  </div>
                );
              })}

              {/* Exact YOLO Predictions Layer (Authoritative single overlay) */}
              {visibleDetections.map((det, idx) => {
                const hasAnyHighlight = highlightedIndex !== null;
                const isHighlighted = highlightedIndex === idx;
                const boxStyle = getBoxStyle(det, isHighlighted);
                if (!boxStyle) return null;

                const defectClass = DEFECT_CLASSES[det.class] || {
                  label: det.class,
                  color: "#F2B941",
                };

                return (
                  <div
                    key={`pred-${idx}`}
                    style={boxStyle}
                    onMouseEnter={() => onHighlightIndex?.(idx)}
                    onMouseLeave={() => onHighlightIndex?.(null)}
                    onClick={() => onHighlightIndex?.(isHighlighted ? null : idx)}
                    className={`absolute transition-all duration-150 cursor-pointer ${
                      isHighlighted
                        ? "border-[3px] border-amber-300 ring-4 ring-amber-400 ring-offset-2 ring-offset-black/90 shadow-[0_0_24px_rgba(251,191,36,0.9)] z-40 scale-[1.02] opacity-100"
                        : hasAnyHighlight
                        ? "border-2 z-10 opacity-35 hover:opacity-100 hover:border-white hover:z-20"
                        : "border-2 z-10 hover:border-white hover:z-20 opacity-100"
                    }`}
                  >
                    <span
                      style={{ backgroundColor: isHighlighted ? "#D97706" : defectClass.color }}
                      className={`absolute px-2 py-0.5 text-[11px] font-bold text-white rounded shadow-md whitespace-nowrap leading-none select-none pointer-events-none transition-transform flex items-center gap-1.5 ${
                        isHighlighted ? "scale-110 ring-2 ring-amber-300 shadow-xl z-50 font-extrabold" : ""
                      } ${
                        boxStyle.isNearTop ? "top-1 left-1" : "-top-5 left-0"
                      }`}
                    >
                      {isHighlighted && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                      )}
                      <span>{defectClass.label} · {Math.round(det.confidence * 100)}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Legend */}
      {visibleDetections.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-2 bg-zinc-900/80 text-xs text-white/70">
          <span className="font-semibold text-white/90">Legend:</span>
          {Array.from(new Set(visibleDetections.map(d => d.class))).map(clsKey => {
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