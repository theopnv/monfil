import { Cloud01, Code01, CpuChip01, Database02, GitBranch01, Globe02, Home02, LayersTwo01, Package, Rocket02, Rss01, ShieldTick, Terminal } from "@untitledui/icons";
import type { IconComponentType } from "@/components/untitled-ui/base/badges/badge-types";

// A curated subset of `@untitledui/icons`, not the whole set: the picker in WorkspaceDialog stays
// a short grid instead of a searchable list.
export const WORKSPACE_ICONS = ["Code01", "Terminal", "GitBranch01", "ShieldTick", "Package", "CpuChip01", "Database02", "Cloud01", "Rocket02", "Globe02", "LayersTwo01", "Rss01"] as const;

export type WorkspaceIconName = (typeof WORKSPACE_ICONS)[number];

const ICON_COMPONENTS: Record<string, IconComponentType> = {
  Code01,
  Terminal,
  GitBranch01,
  ShieldTick,
  Package,
  CpuChip01,
  Database02,
  Cloud01,
  Rocket02,
  Globe02,
  LayersTwo01,
  Rss01,
  Home02,
};

/** Resolves a workspace's stored icon name to its component, falling back to Rss01 for a name outside the resolvable set (e.g. one written by a future version). */
export function workspaceIconComponent(icon: string): IconComponentType {
  return Object.hasOwn(ICON_COMPONENTS, icon) ? (ICON_COMPONENTS[icon] ?? Rss01) : Rss01;
}

// A handful of theme-adjacent hues: the brand and sage ramps that carry the rest of the app, plus
// Untitled UI's utility ramp for enough variety to tell six or eight tabs apart at a glance.
export const WORKSPACE_COLORS = ["#d67f48", "#8fa073", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#10b981", "#ef4444"] as const;
