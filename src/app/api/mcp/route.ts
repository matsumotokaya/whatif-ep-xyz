import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  getRefDesign,
  getRefDesignLayers,
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
import {
  getRefTemplate,
  getRefTemplateLayers,
  listRefTemplates,
  projectRefTemplates,
  resolveRefTemplateFields,
} from "@/lib/ref/templates";

// MCP endpoint for the Ref Library: lets any MCP client (Claude, an agent
// framework, a video pipeline) discover the site's referenceable images and
// grab a public URL for any of them.
//
// Three kinds are exposed. DESIGNS (list_designs / get_design /
// get_design_layers) are saved IMAGINE documents, owned by users and rendered
// on save. ASSETS (list_assets / get_asset) are the site's official, curated
// image library — character cutouts and general art — which is public data with
// a recorded pixel size on every row. TEMPLATES (list_templates / get_template
// / get_template_layers) are the curated starting points the gallery offers. An
// agent choosing a source needs to know all three exist, so the descriptions
// point at each other.
//
// 🔴 TEMPLATES ARE THE ONE KIND WITH NO USABLE IMAGE. public.templates stores a
// thumbnail and no full-size render, and the gallery's "wallpaper download"
// draws the picture in the browser at the moment it is pressed rather than
// fetching a stored file — so there is no image URL to hand out and none is
// invented. A template's value here is get_template_layers: the elements in
// draw order, which is what makes it usable as an animatable source. The tool
// descriptions say this plainly, because a model that assumes every kind has a
// `url` would otherwise reach for the thumbnail.
//
// get_design_layers is the one tool that does not return an image reference: it
// returns the DOCUMENT STRUCTURE, so a consumer can animate a design's parts
// separately instead of panning the flattened render. get_design and it point
// at each other, because "still image" vs "animate the parts" is the choice a
// model has to make and neither payload states it alone.
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
        "This returns the design as ONE FLATTENED IMAGE, which is what a still needs; call get_design_layers with the same id to get its parts separately, which is what animating it needs. " +
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
    "get_design_layers",
    {
      title: "Get one WHATIF design's layers",
      description:
        "Fetch the LAYER STRUCTURE of one saved IMAGINE design — its elements in draw order, each with geometry and, for image layers, the public URL of its original source file. " +
        "THIS IS WHAT MAKES A DESIGN ANIMATABLE PER PART rather than as one flat image: with it a background, a character cutout and a caption can move independently, which get_design's single flattened render cannot express. " +
        "For a still image, or when the whole composed picture is what you want, get_design's `url` remains the right choice — do not rebuild a still out of layers. " +
        "IMAGE LAYERS REPRODUCE EXACTLY: their `url` is the original file the editor itself loads (a transparent-PNG cutout, or the user's background), so placing it at the given x/y/width/height/rotation/opacity recreates that part of the flattened render pixel for pixel (`exact: true`). " +
        "TEXT LAYERS ARE APPROXIMATE TODAY: the editor lays text out with a canvas engine, so a DOM-based renderer (Remotion, HTML) will differ slightly in letter spacing and wrapping (`exact: false`); a pre-rendered transparent text PNG is planned. Each layer carries its own `exact` flag and the response's `fidelity` block states this for the design as a whole. " +
        "`index` is the draw order, 0 at the BOTTOM and ascending on top — render in that order. " +
        "Elements hidden in the editor (`visible: false`) are already omitted, so draw everything returned and nothing else: the result matches the flattened render. " +
        "`width`/`height` at the top level are the canvas size and `backgroundColor` the canvas colour, so the container to place layers in is fully described. Text layers have `width`/`height` null because the document does not store a measured box for them.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The design's uuid, exactly as the user gave it or as list_designs returned it. Never invent or guess one."
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const layers = await getRefDesignLayers(id);
      if (!layers) {
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

      return {
        content: [{ type: "text" as const, text: JSON.stringify(layers) }],
      };
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

  server.registerTool(
    "list_templates",
    {
      title: "List WHATIF design templates",
      description:
        "List the site's DESIGN TEMPLATES — the curated starting points the IMAGINE gallery offers, which a user opens to begin a design of their own. " +
        "This is the third referenceable kind, alongside saved designs (list_designs) and the official asset library (list_assets). " +
        "TEMPLATES ARE THE ONE KIND WITH NO USABLE IMAGE: a template has never been rendered at full size, so records carry NO `url` field at all and there is no image permalink for one. " +
        "`thumbnailUrl` is a small preview, and its exact pixel size is not recorded and is not reported — never pass it to anything that needs a real image, and never treat it as a full-size source. " +
        "WHAT A TEMPLATE IS FOR HERE IS ITS LAYERS: call get_template_layers to get the elements in draw order with geometry and per-image source URLs, which is what makes it usable as an animatable source. " +
        "If what you need is a finished, composed picture, use list_designs / get_design instead — those are rendered. " +
        "`width`/`height` are the template document's canvas size, not the size of any image, and `aspect` is their reduced ratio. " +
        "`planType` is the tier a user needs to open the template in the editor; it does not restrict reading it here. " +
        "Ordered as the gallery orders them (curated order first, then most recently updated). " +
        "Records are compact by default (id, name, width, height, aspect, planType, thumbnailUrl); use `fields` to choose a different set — it selects exactly what you name, so it can shrink a record as well as widen it. " +
        "`count` is how many records this response contains and `total` is how many templates match the filters — count < total means `limit` truncated the result, so page with `offset`. " +
        "`layersUrl` never needs requesting: it is always https://whatif-ep.xyz/api/ref/templates/{id}/layers.",
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe("Case-insensitive substring match on the template's name."),
        planType: z
          .string()
          .optional()
          .describe(
            "Filter by tier: \"free\" or \"premium\". This is the tier needed to open the template in the editor, not a restriction on reading it here."
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
            "Number of matching templates to skip before the window (default 0). Use with `total` to page."
          ),
        minWidth: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Return only templates whose CANVAS is at least this many pixels wide. This filters the document size, not an image."
          ),
        fields: FIELDS_SCHEMA.describe(
          "Which fields each record should carry. SELECTS rather than adds: the response contains EXACTLY the fields named, plus `id`. " +
            "Omit it for the compact record (id, name, width, height, aspect, planType, thumbnailUrl); use \"all\" for the full one. " +
            "Accepts an array ([\"id\",\"name\"]) or a comma-separated string (\"id,name\"). Unknown names are ignored. layersUrl is derivable from id and rarely worth requesting."
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search, planType, limit, offset, minWidth, fields }) => {
      const { templates, total } = await listRefTemplates({
        search,
        planType,
        limit,
        offset,
        minWidth,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              count: templates.length,
              total,
              templates: projectRefTemplates(
                templates,
                resolveRefTemplateFields(fields)
              ),
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_template",
    {
      title: "Get one WHATIF design template",
      description:
        "Fetch the full record for one design template, by an id returned by list_templates or given by the user — the gallery card's id button copies exactly this id. " +
        "For a saved IMAGINE design id use get_design, and for a library asset id use get_asset; the three kinds have separate ids and separate tools. " +
        "THIS RECORD CARRIES NO IMAGE URL. A template has no full-size render, so there is no `url` field and no image permalink; `thumbnailUrl` is a small preview whose pixel size is not recorded and must never be used as a full-size source. " +
        "To actually USE the template, call get_template_layers — its elements are what an external renderer can place and animate. " +
        "`width`/`height` are the canvas size of the document and `backgroundColor` the canvas colour.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The template's uuid, exactly as list_templates returned it or as the user gave it. Never invent or guess one."
          ),
        preview: z
          .boolean()
          .optional()
          .describe(
            "When true, also attach the thumbnail as inline image content so the template can be looked at, not just linked. This is a preview to judge by, not a source image."
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id, preview }) => {
      const template = await getRefTemplate(id);
      if (!template) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No template found for id "${id}".`,
            },
          ],
        };
      }

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: JSON.stringify(template) }];

      if (preview && template.thumbnailUrl) {
        const inline = await fetchInlineImage(template.thumbnailUrl);
        if (inline) content.push(inline);
      }

      return { content };
    }
  );

  server.registerTool(
    "get_template_layers",
    {
      title: "Get one WHATIF design template's layers",
      description:
        "Fetch the LAYER STRUCTURE of one design template — its elements in draw order, each with geometry and, for image layers, the public URL of its original source file. " +
        "THIS IS THE ONLY WAY TO USE A TEMPLATE'S ARTWORK, and the reason templates are exposed here: a template has no flattened render, so there is no image to fetch, but its document is complete and needs no rendering step. " +
        "With it a background, a character cutout and a caption can be placed and animated independently — a template is a layered starting point by design, which is exactly what a Remotion composition wants. " +
        "The response is the same shape as get_design_layers, so a consumer that can render one can render the other with no branching. " +
        "IMAGE LAYERS REPRODUCE EXACTLY: their `url` is the original file the editor itself loads, so placing it at the given x/y/width/height/rotation/opacity recreates that part pixel for pixel (`exact: true`). " +
        "TEXT LAYERS ARE APPROXIMATE TODAY: the editor lays text out with a canvas engine, so a DOM-based renderer (Remotion, HTML) will differ slightly in letter spacing and wrapping (`exact: false`). Each layer carries its own `exact` flag and the response's `fidelity` block states this for the template as a whole. " +
        "`index` is the draw order, 0 at the BOTTOM and ascending on top — render in that order. " +
        "Elements hidden in the editor (`visible: false`) are already omitted, so draw everything returned and nothing else. " +
        "`width`/`height` at the top level are the canvas size and `backgroundColor` the canvas colour, so the container to place layers in is fully described. Text layers have `width`/`height` null because the document does not store a measured box for them.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The template's uuid, exactly as list_templates returned it or as the user gave it. Never invent or guess one."
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const layers = await getRefTemplateLayers(id);
      if (!layers) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No template found for id "${id}".`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(layers) }],
      };
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
