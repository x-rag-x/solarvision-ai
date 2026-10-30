import React, { useState } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

export interface SampleItem {
  id: string;
  name: string;
  path: string;
  groundTruth: string;
  defectCount?: number;
  description?: string;
}

export const M1_SAMPLES: SampleItem[] = [
  {
    id: "sample-1",
    name: "Sample 1 — Micro-Crack",
    path: "/samples/sample-el-cell-1.jpg",
    groundTruth: "PVELAD GT: star_crack",
    defectCount: 1,
    description: "Electroluminescence image with disconnected finger busbar",
  },
  {
    id: "sample-2",
    name: "Sample 2 — Segmented Crack",
    path: "/samples/sample-el-cell-2.jpg",
    groundTruth: "PVELAD GT: crack",
    defectCount: 2,
    description: "Deep diagonal micro-crack traversing cell lattice",
  },
  {
    id: "sample-3",
    name: "Sample 4 — Isolated Crack",
    path: "/samples/sample-el-cell-3.jpg",
    groundTruth: "PVELAD GT: isolated_crack",
    defectCount: 1,
    description: "Hairline micro-fracture along crystalline grain boundary",
  },
  {
    id: "sample-multi",
    name: "Sample 3 — Multi-Defect",
    path: "/samples/sample-el-cell-multi.jpg",
    groundTruth: "PVELAD GT: multi_defect (cluster)",
    defectCount: 5,
    description: "Multi-defect cluster with cracks and dark inactive areas",
  },
];

export const M2_SAMPLES: SampleItem[] = [
  {
    id: "m2-healthy",
    name: "Healthy Cell",
    path: "/model2_sample_healthy_cell.png",
    groundTruth: "ELPV GT: 0.00 (Healthy)",
    description: "Uniform luminescence, intact contact grids",
  },
  {
    id: "m2-defective",
    name: "Defective Cell",
    path: "/model2_sample_defective_cell.png",
    groundTruth: "ELPV GT: 1.00 (Defective)",
    description: "Severe crystal cleavage and electrical leakage",
  },
];

interface SampleGalleryProps {
  samples: SampleItem[];
  onSelectSample: (file: File) => void;
  selectedSampleId?: string | null;
  className?: string;
}

export function SampleGallery({
  samples,
  onSelectSample,
  selectedSampleId,
  className = "",
}: SampleGalleryProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadSampleFile = async (sample: SampleItem) => {
    try {
      setLoadingId(sample.id);
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const blob = await res.blob();
      const filename = sample.path.split("/").pop() || "sample.jpg";
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      onSelectSample(file);
      toast.success(`Loaded ${sample.name}`, {
        description: sample.groundTruth,
      });
    } catch (err) {
      toast.error(`Failed to load ${sample.name}`, {
        description: (err as Error).message,
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-text flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-terracotta" />
          Test Benchmark Gallery
        </span>
        <span className="text-xs text-text-3">Click to benchmark</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {samples.map(sample => {
          const isLoading = loadingId === sample.id;
          const isSelected = selectedSampleId === sample.id;

          return (
            <button
              key={sample.id}
              type="button"
              disabled={isLoading}
              onClick={() => loadSampleFile(sample)}
              className={`group flex flex-col overflow-hidden rounded-xl border p-2 text-left transition-all ${
                isSelected
                  ? "border-sapphire bg-sapphire-tint/40 shadow-xs"
                  : "border-border bg-surface hover:border-sapphire/50 hover:bg-sapphire-tint/10"
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-subtle border border-border/50 mb-2">
                <img
                  src={sample.path}
                  alt={sample.name}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-xs">
                    <Loader2 className="h-5 w-5 animate-spin text-sapphire" />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-sapphire text-white shadow-xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-text">{sample.name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-text-3">
                  {sample.groundTruth}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SampleGallery;
