import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getRefDesign, listRefDesigns } from "@/lib/ref/designs";

// MCP endpoint for the Ref Library: lets any MCP client (Claude, an agent
// framework, a video pipeline) discover the site owner's saved IMAGINE designs
// and grab a public image URL for any design whose id it knows.
//
// Streamable HTTP in stateless mode: a fresh McpServer + transport per request,
// no session store, JSON responses instead of SSE streams. That is what a
// serverless deployment can actually guarantee, since consecutive requests may
// land on different instances.
//
// The tools are read-only and unauthenticated because the data they return is
// already public (world-readable R2 objects, plus /api/ref/designs). Their
// scopes differ on purpose: get_design resolves any design by id (the uuid is
// the capability) while list_designs only enumerates the owner's showcase, so
// no client can harvest every user's ids. See src/lib/ref/designs.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const URL_DOC =
  "`url` is a direct, world-readable image URL (Cloudflare R2, permissive CORS) that can be passed straight to any tool that accepts an image reference. " +
  "`refUrl` is the stable alias for the same design: it redirects to whatever the current render is, so prefer it when the reference is stored or reused later. " +
  "`editUrl` opens the design in the IMAGINE editor. A design with `url: null` has never been rendered; `stale: true` means the render is behind the saved document.";

function createServer(): McpServer {
  const server = new McpServer({ name: "whatif-ref", version: "1.0.0" });

  server.registerTool(
    "list_designs",
    {
      title: "List WHATIF designs",
      description:
        "List only the site owner's showcase IMAGINE designs, newest first, as public image references. " +
        "This listing is deliberately limited to the owner's accounts and is not a directory of every user's designs; " +
        "to reach a design saved by anyone else, call get_design with its id. " +
        URL_DOC,
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe("Case-insensitive substring match on the design name."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum number of designs to return (default 50)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search, limit }) => {
      const designs = await listRefDesigns({ search, limit });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ count: designs.length, designs }, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_design",
    {
      title: "Get one WHATIF design",
      description:
        "Fetch a single saved IMAGINE design by id as a public image reference. " +
        "Accepts ANY design id, not just the ones list_designs returns: the uuid itself is the access token, " +
        "so an id pasted in by the user resolves whichever account saved that design. " +
        URL_DOC,
      inputSchema: {
        id: z
          .string()
          .describe(
            "The design's uuid — from list_designs, or supplied by the user for a design owned by any account."
          ),
        preview: z
          .boolean()
          .optional()
          .describe(
            "When true, also attach the thumbnail as inline image content so the design can be looked at, not just linked."
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id, preview }) => {
      const design = await getRefDesign(id);
      if (!design) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No design found for id "${id}".`,
            },
          ],
        };
      }

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: JSON.stringify(design, null, 2) }];

      if (preview && design.thumbnailUrl) {
        const inline = await fetchInlineImage(design.thumbnailUrl);
        if (inline) content.push(inline);
      }

      return { content };
    }
  );

  return server;
}

// Inline preview is best-effort: a failed or oversized fetch must not turn a
// successful lookup into a tool error, since the URLs in the payload are the
// actual deliverable.
async function fetchInlineImage(
  url: string
): Promise<{ type: "image"; data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    return {
      type: "image",
      data: buffer.toString("base64"),
      mimeType: contentType?.split(";")[0]?.trim() || "image/jpeg",
    };
  } catch {
    return null;
  }
}

// The transport builds its own Response, so CORS headers are layered on after
// the fact (Response headers are immutable once constructed).
function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed. This MCP endpoint is stateless: POST only.",
      },
      id: null,
    }),
    {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        Allow: "POST, OPTIONS",
      },
    }
  );
}

async function handle(request: Request): Promise<Response> {
  // The transport would answer GET (with an SSE Accept header) by opening a
  // standing server-to-client stream and DELETE by acknowledging a session
  // teardown. Neither means anything here: every request gets its own server
  // instance, so such a stream could never be routed a message and would only
  // hold a serverless invocation open. Reject both up front.
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const server = createServer();
  // sessionIdGenerator: undefined selects stateless mode. Paired with
  // enableJsonResponse, a POST always resolves to a fully buffered JSON
  // response, so the server/transport pair can be torn down as soon as
  // handleRequest returns.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } finally {
    // Stateless: nothing survives the request, so tear the pair down instead of
    // leaking a transport per call.
    await server.close().catch(() => {});
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
