export interface DefectClassInfo {
  id: number;
  key: string;
  label: string;
  description: string;
  category: "structural" | "contact" | "crystallization" | "manufacturing" | "electrical";
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  severity: "critical" | "high" | "medium";
}

export const DEFECT_CLASSES: Record<string, DefectClassInfo> = {
  crack: {
    id: 0,
    key: "crack",
    label: "Micro-Crack",
    description: "Hairline fracture across the silicon wafer substrate; critical structural risk leading to module degradation.",
    category: "structural",
    color: "#EF4444",
    badgeBg: "bg-red-500/10",
    badgeBorder: "border-red-500/30",
    badgeText: "text-red-700 dark:text-red-400",
    severity: "critical",
  },
  finger: {
    id: 1,
    key: "finger",
    label: "Broken Finger",
    description: "Interrupted front-surface grid metallization line reducing current collection and cell efficiency.",
    category: "contact",
    color: "#F97316",
    badgeBg: "bg-orange-500/10",
    badgeBorder: "border-orange-500/30",
    badgeText: "text-orange-700 dark:text-orange-400",
    severity: "medium",
  },
  black_core: {
    id: 2,
    key: "black_core",
    label: "Black Core",
    description: "Central recombination dead zone caused by thermal gradients or incomplete crystallization.",
    category: "crystallization",
    color: "#A855F7",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/30",
    badgeText: "text-purple-700 dark:text-purple-400",
    severity: "critical",
  },
  thick_line: {
    id: 3,
    key: "thick_line",
    label: "Thick Line",
    description: "Excess silver paste or widened front-contact metallization causing optical shading losses.",
    category: "manufacturing",
    color: "#06B6D4",
    badgeBg: "bg-cyan-500/10",
    badgeBorder: "border-cyan-500/30",
    badgeText: "text-cyan-700 dark:text-cyan-400",
    severity: "medium",
  },
  star_crack: {
    id: 4,
    key: "star_crack",
    label: "Star Crack",
    description: "Multi-directional point-impact fracture radiating outward; high risk of cell breakage during lamination.",
    category: "structural",
    color: "#EC4899",
    badgeBg: "bg-pink-500/10",
    badgeBorder: "border-pink-500/30",
    badgeText: "text-pink-700 dark:text-pink-400",
    severity: "critical",
  },
  horizontal_dislocation: {
    id: 5,
    key: "horizontal_dislocation",
    label: "Horizontal Dislocation",
    description: "Sub-grain boundary crystallographic dislocation slip oriented parallel to wafer crystallization.",
    category: "crystallization",
    color: "#3B82F6",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/30",
    badgeText: "text-blue-700 dark:text-blue-400",
    severity: "high",
  },
  vertical_dislocation: {
    id: 6,
    key: "vertical_dislocation",
    label: "Vertical Dislocation",
    description: "Sub-grain boundary dislocation cluster running perpendicular to primary metallization busbars.",
    category: "crystallization",
    color: "#6366F1",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/30",
    badgeText: "text-indigo-700 dark:text-indigo-400",
    severity: "high",
  },
  printing_error: {
    id: 7,
    key: "printing_error",
    label: "Printing Error",
    description: "Screen printing screen misalignment, paste smearing, or missing grid pattern segments.",
    category: "manufacturing",
    color: "#EAB308",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/30",
    badgeText: "text-amber-800 dark:text-amber-400",
    severity: "medium",
  },
  short_circuit: {
    id: 8,
    key: "short_circuit",
    label: "Short Circuit",
    description: "Localized metallurgical shunt or current leakage pathway generating severe hotspot hazards.",
    category: "electrical",
    color: "#DC2626",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/30",
    badgeText: "text-rose-700 dark:text-rose-400",
    severity: "critical",
  },
};

export const DEFECT_CLASS_LIST = Object.values(DEFECT_CLASSES).sort((a, b) => a.id - b.id);

export function getDefectMeta(key: string): DefectClassInfo {
  const normalized = key.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (DEFECT_CLASSES[normalized]) {
    return DEFECT_CLASSES[normalized];
  }
  // Fallback for unknown / generic classes
  return {
    id: 99,
    key: normalized,
    label: normalized.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    description: "Detected anomaly reported by the YOLO inference pipeline.",
    category: "manufacturing",
    color: "#F2B941",
    badgeBg: "bg-amber-400/10",
    badgeBorder: "border-amber-400/30",
    badgeText: "text-amber-700",
    severity: "medium",
  };
}
