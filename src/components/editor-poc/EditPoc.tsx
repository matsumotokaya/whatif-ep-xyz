"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Circle, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type { ImageConfig } from "konva/lib/shapes/Image";
import { createClient } from "@/lib/supabase/client";
import { isFullUrl, resolveAssetUrl } from "@/lib/asset-url";

type CanvasElement = TextElement | ShapeElement | ImageElement;

interface BaseElement {
  id: string;
  type: "text" | "shape" | "image";
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
}

interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill?: string;
  fillEnabled?: boolean;
  stroke?: string;
  strokeWidth?: number;
  strokeEnabled?: boolean;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  align?: "left" | "center" | "right";
}

interface ShapeElement extends BaseElement {
  type: "shape";
  width: number;
  height: number;
  shapeType: "rectangle" | "circle" | "triangle" | "star" | "heart";
  fill?: string;
  fillEnabled?: boolean;
  stroke?: string;
  strokeWidth?: number;
  strokeEnabled?: boolean;
}

interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  width: number;
  height: number;
  blurRadius?: number;
}

interface TemplateRow {
  id: string;
  name: string;
  elements: CanvasElement[] | null;
  canvas_color: string | null;
  thumbnail_url: string | null;
  plan_type: "free" | "premium" | null;
  width: number | null;
  height: number | null;
  updated_at: string | null;
}

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const PREVIEW_MAX_HEIGHT = 680;

function resolveStoredImage(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isFullUrl(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }

  const cleanValue = value.replace(/^\/+/, "");
  if (cleanValue.startsWith("user-images/") || cleanValue.startsWith("default-images/")) {
    return resolveAssetUrl("r2-assets", cleanValue);
  }

  return value;
}

function useLoadedImage(src: string | null) {
  const [loaded, setLoaded] = useState<{
    src: string;
    image: HTMLImageElement | null;
    error: string | null;
  }>({ src: "", image: null, error: null });

  useEffect(() => {
    if (!src) {
      return;
    }

    let cancelled = false;
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => {
      if (!cancelled) {
        setLoaded({ src, image: nextImage, error: null });
      }
    };
    nextImage.onerror = () => {
      if (!cancelled) {
        setLoaded({ src, image: null, error: `Failed to load ${src}` });
      }
    };
    nextImage.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src || loaded.src !== src) {
    return { image: null, error: null };
  }

  return { image: loaded.image, error: loaded.error };
}

function PocImageElement({ element }: { element: ImageElement }) {
  const src = resolveStoredImage(element.src);
  const { image } = useLoadedImage(src);
  const props: ImageConfig = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
    visible: element.visible !== false,
    image: image ?? undefined,
  };

  if (!image) {
    return (
      <Rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="#f2f2f2"
        stroke="#999"
        dash={[10, 6]}
        opacity={0.7}
      />
    );
  }

  return <KonvaImage {...props} />;
}

function PocElement({ element }: { element: CanvasElement }) {
  if (element.visible === false) return null;

  if (element.type === "image") {
    return <PocImageElement element={element} />;
  }

  if (element.type === "text") {
    return (
      <Text
        x={element.x}
        y={element.y}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily || "Arial"}
        fontStyle={`${element.fontWeight ?? 400}`}
        fill={element.fillEnabled === false ? "transparent" : element.fill ?? "#111"}
        stroke={element.strokeEnabled ? element.stroke ?? "#111" : undefined}
        strokeWidth={element.strokeEnabled ? element.strokeWidth ?? 0 : 0}
        rotation={element.rotation ?? 0}
        opacity={element.opacity ?? 1}
        letterSpacing={element.letterSpacing ?? 0}
        lineHeight={element.lineHeight ?? 1}
        align={element.align ?? "left"}
      />
    );
  }

  if (element.shapeType === "circle") {
    return (
      <Circle
        x={element.x + element.width / 2}
        y={element.y + element.height / 2}
        radius={Math.min(element.width, element.height) / 2}
        fill={element.fillEnabled === false ? undefined : element.fill ?? "#ddd"}
        stroke={element.strokeEnabled ? element.stroke ?? "#111" : undefined}
        strokeWidth={element.strokeEnabled ? element.strokeWidth ?? 0 : 0}
        rotation={element.rotation ?? 0}
        opacity={element.opacity ?? 1}
      />
    );
  }

  return (
    <Rect
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill={element.fillEnabled === false ? undefined : element.fill ?? "#ddd"}
      stroke={element.strokeEnabled ? element.stroke ?? "#111" : undefined}
      strokeWidth={element.strokeEnabled ? element.strokeWidth ?? 0 : 0}
      rotation={element.rotation ?? 0}
      opacity={element.opacity ?? 1}
    />
  );
}

export function EditPoc() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const supabase = useMemo(() => createClient(), []);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [loadError, setLoadError] = useState<{ templateId: string; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdBannerId, setCreatedBannerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSessionEmail(data.session?.user.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!templateId) {
      return;
    }

    let cancelled = false;

    void supabase
      .from("templates")
      .select("id, name, elements, canvas_color, thumbnail_url, plan_type, width, height, updated_at")
      .eq("id", templateId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setTemplate(null);
          setLoadError({ templateId, message: fetchError.message });
          setStatus("Template load failed.");
          return;
        }
        setTemplate(data as TemplateRow);
        setLoadError(null);
        setStatus("Template loaded in Next client island.");
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, templateId]);

  const activeTemplate = template?.id === templateId ? template : null;
  const width = activeTemplate?.width ?? DEFAULT_WIDTH;
  const height = activeTemplate?.height ?? DEFAULT_HEIGHT;
  const scale = Math.min(1, PREVIEW_MAX_HEIGHT / height);
  const elements = useMemo(() => activeTemplate?.elements ?? [], [activeTemplate?.elements]);
  const thumbnailSrc = resolveStoredImage(activeTemplate?.thumbnail_url);
  const visibleError =
    loadError?.templateId === templateId ? loadError.message : actionError;
  const visibleStatus = templateId
    ? activeTemplate || visibleError
      ? status
      : "Loading template..."
    : "Add ?template=<id> to load an IMAGINE template.";

  const createTestBanner = useCallback(async () => {
    if (!activeTemplate) return;

    setStatus("Creating test banner...");
    setActionError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setActionError(userError?.message ?? "Login is required.");
      setStatus("Create skipped.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("banners")
      .insert({
        user_id: user.id,
        template_id: activeTemplate.id,
        name: `${activeTemplate.name} Next PoC`,
        template: {
          id: activeTemplate.id,
          name: activeTemplate.name,
          width,
          height,
          backgroundColor: activeTemplate.canvas_color ?? "#ffffff",
          thumbnail: thumbnailSrc ?? undefined,
          planType: activeTemplate.plan_type ?? undefined,
        },
        elements,
        canvas_color: activeTemplate.canvas_color ?? "#ffffff",
      })
      .select("id")
      .single();

    if (insertError) {
      setActionError(insertError.message);
      setStatus("Create failed.");
      return;
    }

    setCreatedBannerId((data as { id: string }).id);
    setStatus("Created a banner row through the Gallery app.");
  }, [activeTemplate, elements, height, supabase, thumbnailSrc, width]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#eeeeee] px-4 py-5 text-foreground md:px-6">
      <div className="grid min-h-[calc(100vh-6rem)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded border border-border bg-surface p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Next /edit PoC</p>
              <h1 className="mt-1 text-xl font-semibold">Editor runtime</h1>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Template</dt>
                <dd className="break-all">{templateId ?? "none"}</dd>
              </div>
              <div>
                <dt className="text-muted">Session</dt>
                <dd>{sessionEmail ?? "not signed in"}</dd>
              </div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd>{visibleStatus}</dd>
              </div>
              {createdBannerId ? (
                <div>
                  <dt className="text-muted">Created banner</dt>
                  <dd className="break-all">{createdBannerId}</dd>
                </div>
              ) : null}
            </dl>
            {visibleError ? (
              <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {visibleError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!activeTemplate}
              onClick={createTestBanner}
              className="w-full rounded border border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-hover disabled:text-muted"
            >
              Create test banner
            </button>
            {thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc}
                alt=""
                className="aspect-[9/16] w-full rounded border border-border object-cover"
              />
            ) : null}
          </div>
        </aside>

        <section className="flex min-w-0 items-center justify-center overflow-auto rounded border border-border bg-surface p-4">
          <div
            className="shrink-0 border border-border bg-white shadow-sm"
            style={{ width: width * scale, height: height * scale }}
          >
            <Stage width={width * scale} height={height * scale} scaleX={scale} scaleY={scale}>
              <Layer>
                <Rect width={width} height={height} fill={activeTemplate?.canvas_color ?? "#ffffff"} />
                {elements.map((element) => (
                  <PocElement key={element.id} element={element} />
                ))}
              </Layer>
            </Stage>
          </div>
        </section>
      </div>
    </div>
  );
}
