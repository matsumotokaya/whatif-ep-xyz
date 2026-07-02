import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "noreply@whatif-ep.xyz";
const DEFAULT_ADMIN_EMAIL =
  process.env.CONTACT_NOTIFICATION_EMAIL ?? "contact@whatif-ep.xyz";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string | null;
}

async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      text: params.text,
      reply_to: params.replyTo || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend request failed: ${response.status} ${await response.text()}`
    );
  }
}

interface WallpaperPurchaseNotificationParams {
  buyerEmail: string;
  buyerName?: string | null;
  seriesSlug: string | null;
  displayCode: string | null;
  variantNumber: number | null;
  amount: number | null;
  currency: string | null;
  // Per-purchase download token; when present (and the work is identifiable)
  // the buyer email includes a tokenized download link that works without
  // logging in. Essential for guest checkout.
  downloadToken?: string | null;
  // True when the purchase was made without an account (guest checkout).
  isGuest?: boolean;
}

// Build the tokenized wallpaper-page URL included in the buyer email. Returns
// null when the work cannot be identified (the email then ships without a
// link and the buyer can still use the success page).
function buildDownloadPageUrl(
  params: WallpaperPurchaseNotificationParams
): string | null {
  if (!params.downloadToken || !params.seriesSlug || !params.displayCode) {
    return null;
  }
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    "https://whatif-ep.xyz";
  const variant =
    params.variantNumber && params.variantNumber > 0
      ? params.variantNumber
      : 1;
  return (
    `${siteUrl}/works/${encodeURIComponent(params.seriesSlug)}` +
    `/${encodeURIComponent(params.displayCode)}/wallpaper` +
    `?variant=${variant}&token=${encodeURIComponent(params.downloadToken)}`
  );
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null || !currency) return "-";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${amount / 100} ${currency.toUpperCase()}`;
  }
}

export async function sendWallpaperPurchaseNotifications(
  params: WallpaperPurchaseNotificationParams
): Promise<void> {
  const buyerName = params.buyerName?.trim() || params.buyerEmail;
  const workLabel = [params.seriesSlug, params.displayCode]
    .filter(Boolean)
    .join(" ")
    .trim();
  const variantLabel =
    params.variantNumber && params.variantNumber > 0
      ? `variant ${params.variantNumber}`
      : "variant -";
  const amountLabel = formatMoney(params.amount, params.currency);
  const downloadPageUrl = buildDownloadPageUrl(params);

  // English base with a Japanese supplement for the download link — the mail
  // is transactional and the link is the actionable part.
  const downloadSection = downloadPageUrl
    ? `Download your wallpaper pack here (this link is unique to your purchase — please do not share it):\n` +
      `${downloadPageUrl}\n\n` +
      `--\n` +
      `以下のリンクから壁紙パックをダウンロードできます（ご購入者専用のリンクです。第三者と共有しないでください）:\n` +
      `${downloadPageUrl}\n\n`
    : "";

  await Promise.all([
    sendEmail({
      to: params.buyerEmail,
      subject: "Your WHATIF wallpaper purchase is confirmed",
      text:
        `Hello ${buyerName},\n\n` +
        `Your wallpaper purchase has been confirmed.\n` +
        `Work: ${workLabel || "-"}\n` +
        `Variant: ${variantLabel}\n` +
        `Amount: ${amountLabel}\n\n` +
        downloadSection +
        `Thank you for your purchase.\n`,
      replyTo: DEFAULT_ADMIN_EMAIL,
    }),
    sendEmail({
      to: DEFAULT_ADMIN_EMAIL,
      subject: `[WHATIF] Wallpaper purchased: ${params.buyerEmail}`,
      text:
        `A wallpaper purchase was completed.\n\n` +
        `Buyer: ${buyerName}\n` +
        `Email: ${params.buyerEmail}\n` +
        `Guest checkout: ${params.isGuest ? "yes" : "no"}\n` +
        `Work: ${workLabel || "-"}\n` +
        `Variant: ${variantLabel}\n` +
        `Amount: ${amountLabel}\n`,
      replyTo: params.buyerEmail,
    }),
  ]);
}
