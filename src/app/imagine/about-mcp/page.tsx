import type { Metadata } from "next";
import { Suspense } from "react";
import McpGuideClient from "./McpGuideClient";

const description =
  "Use a saved IMAGINE design as a stable image URL — hand it to a video AI, a CLI or an MCP-capable assistant instead of downloading and re-uploading files.";

export const metadata: Metadata = {
  title: "About IMAGINE MCP",
  description,
  alternates: { canonical: "/imagine/about-mcp" },
};

export default function ImagineMcpPage() {
  return (
    <Suspense fallback={null}>
      <McpGuideClient />
    </Suspense>
  );
}
