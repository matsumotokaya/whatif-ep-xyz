import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  getRefDesign,
  listRefDesigns,
  projectRefDesigns,
  resolveRefDesignFields,
} from "@/lib/ref/designs";
import {
  getRefAsset,
  listRefAssets,
  projectRefAssets,
  resolveRefAssetFields,
} from "@/lib/ref/assets";

// MCP endpoint for the Ref Library: lets any MCP client (Claude, an agent
// framework, a video pipeline) discover the site's referenceable images and
// grab a public URL for any of them.
//
// Two kinds are exposed. DESIGNS (list_designs / get_design) are saved IMAGINE
// documents, owned by users and rendered on save. ASSETS (list_assets /
// get_asset) are the site's official, curated image library — character cutouts
// and general art — which is public data with a recorded pixel size on every
// row. An agent choosing a source needs to know both exist, so each pair's
// description points at the other.
//
// Streamable HTTP in stateless mode: a fresh McpServer + transport per request,
// no session store, JSON responses instead of SSE streams. That is what a
// serverless deployment can actually guarantee, since consecutive requests may
// land on different instances.
//
// The tools are read-only and unauthenticated because the data they return is
// already public (world-readable R2 objects, plus /api/ref/designs and
// /api/ref/assets). Their scopes differ on purpose: get_design resolves any
// design by id (the uuid is the capability) while list_designs only enumerates
// the owner's showcase, so no client can harvest every user's ids. The asset
// tools are unscoped on both paths, because a curated library published by the
// site holds nobody's private work. See src/lib/ref/designs.ts and
// src/lib/ref/assets.ts.
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
//
// EVERY PAYLOAD IS SERIALISED COMPACTLY (no `null, 2` argument). An MCP client
// pays for the tool result as context, and pretty-printing charged it for two
// spaces of indentation per line plus a newline per field: the same limit=200
// listing measured 81,007 bytes over MCP against 54,554 for the identical data
// over HTTP, so roughly a third of the client's token cost was whitespace it
// never reads. Indentation is for humans reading a terminal, and nothing here
// is read that way.

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

const ASSET_URL_DOC =
  "`url` is the full-size image: a direct, world-readable image URL (Cloudflare R2, permissive CORS) that can be passed straight to any tool that accepts an image reference. " +
  "EVERY asset in this library has one, and `width`/`height` are recorded per asset and describe the image at `url` exactly — so these are directly usable as image references, with no rendering step and no guessing about resolution. " +
  "`aspect` is their reduced ratio, but these are hand-cropped source images, so most read like \"1223:2063\" rather than a tidy \"4:5\" — judge shape from `width`/`height`, do not filter on an exact `aspect` string. " +
  "`thumbnailUrl` is a small preview whose exact pixel size is not recorded and is not reported, so never treat it as a full-size source. " +
  "`refUrl` never needs requesting: it is always https://whatif-ep.xyz/ref/asset/{id}. " +
  "Use `refUrl` when the reference is stored or reused later and `url` when the exact image must not change.";

// `fields` accepts BOTH a comma-separated string and an array of names. An LLM
// client naturally passes an array for a multi-valued argument, and the
// string-only schema answered that with a flat schema error
// ("expected string, received array at fields"), costing a round trip to learn
// a syntax rule that carries no meaning. Both forms parse to the same list.
const FIELDS_SCHEMA = z.union([z.string(), z.array(z.string())]).optional();

function createServer(): McpServer {
  const server = new McpServer({ name: "whatif-ref", version: "1.0.0" });

  server.registerTool(
    "list_designs",
    {
      title: "List WHATIF designs",
      description:
        "List only the site owner's showcase IMAGINE designs, newest first, as public image references. " +
        "Designs are one of two referenceable kinds here; the other is the site's official, curated asset library — call list_assets for that. " +
        "This listing is deliberately limited to the owner's accounts and is not a directory of every user's designs; " +
        "to reach a design saved by anyone else, call get_design with its id. " +
        "Records are compact by default (id, name, width, height, docWidth, docHeight, aspect, urlKind, url, stale) to keep the response small; " +
        "use `fields` to choose a different set — it selects exactly what you name, so it can shrink a record as well as widen it. " +
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
        fields: FIELDS_SCHEMA.describe(
          "Which fields each record should carry. SELECTS rather than adds: the response contains EXACTLY the fields named, plus `id`, so this is how you make a listing cheaper — on 200 designs, `[\"id\",\"name\",\"aspect\",\"url\"]` costs about two thirds of the default record and `[\"id\",\"name\"]` under a third. " +
            "Omit it for the compact record (id, name, aspect, width, height, docWidth, docHeight, url, urlKind, stale); use \"all\" for the full one. " +
            "Accepts an array ([\"id\",\"name\"]) or a comma-separated string (\"id,name\"). Unknown names are ignored, so naming nothing recognisable returns ids alone. refUrl and editUrl are derivable from id and rarely worth requesting."
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
            text: JSON.stringify({
              count: designs.length,
              total,
              designs: projectRefDesigns(
                designs,
                resolveRefDesignFields(fields)
              ),
            }),
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
        "For an id that came from the official asset library instead, use get_asset. " +
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
      > = [{ type: "text", text: JSON.stringify(design) }];

      if (preview && design.thumbnailUrl) {
        const inline = await fetchInlineImage(design.thumbnailUrl);
        if (inline) content.push(inline);
      }

      return { content };
    }
  );

  server.registerTool(
    "list_assets",
    {
      title: "List WHATIF library assets",
      description:
        "List the site's OFFICIAL, CURATED ASSET LIBRARY — the clean source images the site itself publishes: character cutouts (transparent PNG cutouts of a work's character, each tied to a work_number) and general art. " +
        "This is the other referenceable kind alongside saved designs (list_designs); a design is a composed, rendered document, an asset is a source image. " +
        "Every asset here has a full-size image with exact recorded dimensions, so results are directly usable as image references — nothing needs rendering first and no resolution has to be guessed. " +
        "The whole library is public: unlike list_designs this listing is not restricted to any account, because it contains no user's private work. " +
        "Newest first. Records are compact by default (id, name, role, tags, workNumber, aspect, width, height, url) to keep the response small; " +
        "use `fields` to choose a different set — it selects exactly what you name, so it can shrink a record as well as widen it. " +
        "`count` is how many records this response contains and `total` is how many assets match the filters — count < total means `limit` truncated the result, so page with `offset`. " +
        "Prefer filtering server-side with `role` / `work` / `tag` / `minWidth` over fetching everything and discarding most of it. " +
        ASSET_URL_DOC,
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe(
            "Case-insensitive substring match on the asset's file name, e.g. \"0313\"."
          ),
        role: z
          .string()
          .optional()
          .describe(
            "Filter by asset role: \"character_cutout\" (a work's character, cut out) or \"general\" (everything else)."
          ),
        tag: z
          .string()
          .optional()
          .describe(
            "Return only assets tagged with this tag, e.g. \"Character\". Matches one tag, ignoring case — the stored tags are inconsistently capitalised, so case-sensitive matching would miss rows."
          ),
        work: z
          .number()
          .int()
          .optional()
          .describe(
            "Return only assets belonging to this work (episode) number, e.g. 313. Character cutouts always carry one."
          ),
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
            "Number of matching assets to skip before the window (default 0). Use with `total` to page."
          ),
        minWidth: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Return only assets at least this many pixels wide. The library spans roughly 480px to 4096px, so use this when the image feeds something that needs real resolution."
          ),
        fields: FIELDS_SCHEMA.describe(
          "Which fields each record should carry. SELECTS rather than adds: the response contains EXACTLY the fields named, plus `id`, so this is how you make a listing cheaper. " +
            "Omit it for the compact record (id, name, role, tags, workNumber, aspect, width, height, url); use \"all\" for the full one. " +
            "Accepts an array ([\"id\",\"name\"]) or a comma-separated string (\"id,name\"). Unknown names are ignored, so naming nothing recognisable returns ids alone. refUrl is derivable from id and rarely worth requesting."
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search, role, tag, work, limit, offset, minWidth, fields }) => {
      const { assets, total } = await listRefAssets({
        search,
        role,
        tag,
        work,
        limit,
        offset,
        minWidth,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              count: assets.length,
              total,
              assets: projectRefAssets(assets, resolveRefAssetFields(fields)),
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_asset",
    {
      title: "Get one WHATIF library asset",
      description:
        "Fetch the full record for one asset from the site's official, curated asset library, by an id returned by list_assets or given by the user. " +
        "For a saved IMAGINE design id, use get_design instead — the two kinds have separate ids and separate tools. " +
        "The asset carries a full-size image with exact recorded dimensions, so it is directly usable as an image reference. " +
        ASSET_URL_DOC,
      inputSchema: {
        id: z
          .string()
          .describe(
            "The asset's uuid, exactly as list_assets returned it or as the user gave it. Never invent or guess one."
          ),
        preview: z
          .boolean()
          .optional()
          .describe(
            "When true, also attach the thumbnail as inline image content so the asset can be looked at, not just linked."
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id, preview }) => {
      const asset = await getRefAsset(id);
      if (!asset) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No library asset found for id "${id}".`,
            },
          ],
        };
      }

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: JSON.stringify(asset) }];

      if (preview && asset.thumbnailUrl) {
        const inline = await fetchInlineImage(asset.thumbnailUrl);
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
