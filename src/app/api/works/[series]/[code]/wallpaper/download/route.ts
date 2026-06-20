import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";
import { hasPurchasedWallpaper } from "@/lib/wallpaper-purchases";

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

  const access = await getClubAccess();

  if (access.status === "anonymous" || !access.user) {
    return NextResponse.redirect(
      new URL(`/auth/login?next=/works/${series}/${code}/wallpaper`, origin)
    );
  }

  const pack = await getPublishedWallpaperPack(series, code, variantNumber);
  if (!pack) {
    return NextResponse.json(
      { error: "Wallpaper pack not found." },
      { status: 404 }
    );
  }

  // Authorize: premium members get all packs; otherwise the user must have
  // purchased this specific wallpaper.
  const entitled =
    canAccessClub(access) ||
    (await hasPurchasedWallpaper(access.user.id, pack.projectId));

  if (!entitled) {
    return NextResponse.redirect(
      new URL(
        `/works/${series}/${code}/wallpaper?variant=${variantNumber}`,
        origin
      )
    );
  }

  const zip = new JSZip();

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
