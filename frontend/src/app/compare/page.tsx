import { Suspense } from "react";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
export default function ComparePage() { return <Suspense fallback={<p>Opening comparison…</p>}><ComparisonWorkspace /></Suspense>; }
