import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  getRefDesign,
  listRefDesigns,
  projectRefDesigns,
  resolveRefDesignFields,
} from "@/lib/ref/designs";

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
//
// The tool descriptions are the only documentation an LLM client ever reads, so
// they carry two things the JSON alone cannot say. First, `url` is the
// full-resolution render or null — never the thumbnail — and `width`/`height`
// describe it exactly; the old thumbnail fallback let a client feed a ~400px
// image to a paid video generator while believing it was 1080x1350. Second,
// `refUrl` (https://whatif-ep.xyz/ref/{id}) and `editUrl`
// (https://whatif-ep.xyz/edit/{id}) are pure functions of the id, so listings
// leave them out by default and the description says how to build them —
// repeating the same uuid across four long URLs per record is what made a
// limit=200 listing cost roughly 46k tokens.

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
  "`url` is the FULL-RESOLUTION render only: a direct, world-readable image URL (Cloudflare R2, permissive CORS) that can be passed straight to any tool that accepts an image reference. " +
  "`width`/`height` describe the image at `url` exactly. A design that has never been rendered at full size has `url: null`, `urlKind: null` and `width`/`height` null — it is not a usable image reference, so do not substitute the thumbnail for it. " +
  "`docWidth`/`docHeight` are the design document's own dimensions and are always present, and `aspect` (e.g. \"4:5\", \"16:9\") is their reduced ratio. " +
  "`thumbnailUrl` is a small preview, roughly 400px wide — the exact pixel size is not guaranteed and is not reported, so never treat it as a full-size source. " +
  "`stale: true` means the render is behind the saved document. " +
  "`refUrl` and `editUrl` never need requesting: they are always https://whatif-ep.xyz/ref/{id} and https://whatif-ep.xyz/edit/{id}. " +
  "Use `refUrl` when the reference is stored or reused later (it redirects to whatever the current render is) and `url` when the exact image must not change.";

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
        "Records are compact by default (id, name, width, height, docWidth, docHeight, aspect, urlKind, url, stale) to keep the response small; " +
        "ask for more with `fields`. " +
        "`count` is how many records this response contains and `total` is how many designs match the filters — count < total means `limit` truncated the result, so page with `offset`. " +
        "Prefer filtering server-side with `renderedOnly` / `minWidth` over fetching everything and discarding most of it. " +
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
          .describe("Size of the returned window (default 50, max 200)."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Number of matching designs to skip before the window (default 0). Use with `total` to page."
          ),
        renderedOnly: z
          .boolean()
          .optional()
          .describe(
            "When true, return only designs that have a full-resolution render (non-null `url`). Most designs only ever got a thumbnail, so this is the filter to use when the result must be a usable full-size image."
          ),
        minWidth: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Return only designs whose rendered `width` is at least this many pixels. Implies renderedOnly, since an unrendered design has no width."
          ),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated extra fields to add to the compact record, e.g. \"thumbnailUrl,updatedAt\". Use \"all\" for the full record. Unknown names are ignored. refUrl and editUrl are derivable from id and rarely worth requesting."
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search, limit, offset, renderedOnly, minWidth, fields }) => {
      const { designs, total } = await listRefDesigns({
        search,
        limit,
        offset,
        renderedOnly,
        minWidth,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: designs.length,
                total,
                designs: projectRefDesigns(
                  designs,
                  resolveRefDesignFields(fields)
                ),
              },
              null,
              2
            ),
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
        "Fetch the full record for one saved IMAGINE design, by an id the user has explicitly provided (or one returned by list_designs), as a public image reference. " +
        "Such an id is not limited to what list_designs returns — it resolves whichever account saved that design — so ids must not be guessed, enumerated, incremented or tried at random; " +
        "resolve only an id you were actually given. " +
        URL_DOC,
      inputSchema: {
        id: z
          .string()
          .describe(
            "The design's uuid, exactly as the user gave it or as list_designs returned it. Never invent or guess one."
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
