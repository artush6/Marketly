import { WorkspaceShell } from "@/components/research/workspace-shell";
import { Suspense } from "react";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
export default function ComparePage() { return <WorkspaceShell active="Compare"><Suspense fallback={<p>Opening comparison…</p>}><ComparisonWorkspace /></Suspense></WorkspaceShell>; }
