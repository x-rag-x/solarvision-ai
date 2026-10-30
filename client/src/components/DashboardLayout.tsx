import React from "react";
import { AppShell } from "./shell/AppShell";
import { BrainCircuit, HeartPulse, Settings2 } from "lucide-react";

export const menuItems = [
  { icon: BrainCircuit, label: "Model registry", path: "/model" },
  { icon: HeartPulse, label: "System health", path: "/system-health" },
  { icon: Settings2, label: "Settings", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
