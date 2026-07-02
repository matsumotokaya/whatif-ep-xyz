import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";
import {
  MANUAL_LOCALES,
  buildWallpaperReadme,
  manualFilename,
} from "@/lib/wallpaper-manual";
import {
  hasPurchasedWallpaper,
  isValidWallpaperDownloadToken,
} from "@/lib/wallpaper-purchases";
import { getWorkBySeriesAndCode } from "@/lib/works";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildContentDisposition(filename: string) {
  const safeName = filename.replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
}

// Convert an underscore role (mobile_hd) to a hyphenated file name (mobile-hd.png).
function roleToFilename(role: string) {
  return `${role.replace(/_/g, "-")}.png`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ series: string; code: string }> }
) {
  const { series, code } = await params;
  const origin = new URL(request.url).origin;

  const variantParam = request.nextUrl.searchParams.get("variant");
  const parsedVariant = Number.parseInt(variantParam ?? "", 10);
  const variantNumber = Number.isFinite(parsedVariant) ? parsedVariant : 1;

  const pack = await getPublishedWallpaperPack(series, code, variantNumber);
  if (!pack) {
    return NextResponse.json(
      { error: "Wallpaper pack not found." },
      { status: 404 }
    );
  }

  // Authorize, in order:
  //   1. A valid download token (guest purchase / emailed link) scoped to
  //      this exact wallpaper — no login session required.
  //   2. Premium members get all packs.
  //   3. Signed-in users who purchased this specific wallpaper.
  const token = request.nextUrl.searchParams.get("token");
  let entitled = false;

  if (token) {
    entitled = await isValidWallpaperDownloadToken(token, pack.projectId);
  }

  if (!entitled) {
    const access = await getClubAccess();

    if (access.status === "anonymous" || !access.user) {
      return NextResponse.redirect(
        new URL(`/auth/login?next=/works/${series}/${code}/wallpaper`, origin)
      );
    }

    entitled =
      canAccessClub(access) ||
      (await hasPurchasedWallpaper(access.user.id, pack.projectId));
  }

  if (!entitled) {
    return NextResponse.redirect(
      new URL(
        `/works/${series}/${code}/wallpaper?variant=${variantNumber}`,
        origin
      )
    );
  }

  const zip = new JSZip();

  // Bundle the README ("取扱説明書") in every supported language so buyers get
  // setup steps and terms of use alongside the images. The manual is an extra,
  // so all locales ship as separate files (README_EN.txt, ...) rather than
  // requiring language detection on the gallery side.
  const work = await getWorkBySeriesAndCode(series, code);
  const manualContext = {
    displayCode: work?.displayCode ?? code,
    title: work?.title ?? "",
    variantNumber,
  };
  for (const locale of MANUAL_LOCALES) {
    zip.file(manualFilename(locale), buildWallpaperReadme(locale, manualContext));
  }

  // Collect the wallpaper sizes plus the cover (if present).
  const files = [...pack.wallpapers];
  if (pack.cover) files.push(pack.cover);

  for (const output of files) {
    let upstream: Response;
    try {
      upstream = await fetch(output.publicUrl, { cache: "no-store" });
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch wallpaper asset." },
        { status: 502 }
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Failed to fetch wallpaper asset." },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    zip.file(roleToFilename(output.role), buffer);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });

  const filename = `whatif-${code}-${variantNumber}-pack.zip`;
  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", buildContentDisposition(filename));
  headers.set("Cache-Control", "no-store");

  return new NextResponse(zipBlob, { status: 200, headers });
}
