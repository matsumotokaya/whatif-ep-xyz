import type { Metadata } from "next";
import { RenderBridgeClientOnly } from "@/components/editor/RenderBridgeClientOnly";

export const metadata: Metadata = {
  title: "Render bridge",
  robots: { index: false },
};

// /edit/render -> headless render surface for scripts/design.mjs
// (docs/DESIGN_CLI.md). Not linked from the UI.
export default function RenderBridgePage() {
  return <RenderBridgeClientOnly />;
}
