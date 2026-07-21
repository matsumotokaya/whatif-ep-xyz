import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const SERIES = "episode";
const PAGE_SIZE = 20;

// These budgets intentionally leave headroom above the 2026-07-21 baseline.
// They are tripwires for structural regressions (unbounded reads, original-size
// list images, duplicate cursor requests, or uncontrolled DOM growth), not a
// substitute for detailed profiling.
const MAX_API_RESPONSE_MS = 3_000;
const MAX_LIST_IMAGE_BYTES_PER_PAGE = 1.5 * 1024 * 1024;
const MAX_LONG_SCROLL_CARDS = 500;
const MAX_LONG_SCROLL_DOM_ELEMENTS = 8_500;

type GalleryItem = {
  id: string;
  displayCode: string;
  sequenceNumber: number;
  feedThumbUrl: string | null;
  imageCandidates: string[];
};

type GalleryPage = {
  items: GalleryItem[];
  total: number;
  limit: number;
  hasMore: boolean;
  nextCursor: number | null;
};

function galleryRoot(page: Page) {
  // App Router streaming can briefly retain a hidden shell alongside the
  // revealed tree. Only the visible gallery is user-interactive.
  return page.locator("[data-gallery-root]:visible");
}

function cards(page: Page) {
  return galleryRoot(page).locator("[data-gallery-grid] [data-card]");
}

function galleryAlerts(page: Page) {
  // Next.js has its own route-announcer role=alert outside the gallery.
  return galleryRoot(page).locator('[role="alert"]');
}

async function gotoHydratedGallery(page: Page) {
  // user-state is fetched from an effect, so seeing it complete proves the
  // controls and IntersectionObserver have hydrated before we interact.
  const hydrationEffect = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(
      `/api/works/${SERIES}/user-state`
    )
  );
  await page.goto(`/works/${SERIES}`);
  await hydrationEffect;
}

async function expectVisibleCards(page: Page, expectedCount = PAGE_SIZE) {
  await expect(cards(page)).toHaveCount(expectedCount);
  await expect
    .poll(async () =>
      cards(page).evaluateAll((elements) =>
        elements.every((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0;
        })
      )
    )
    .toBe(true);
}

async function cardSequences(page: Page): Promise<number[]> {
  return cards(page).evaluateAll((elements) =>
    elements.map((element) => Number(element.getAttribute("data-work-sequence")))
  );
}

async function fetchGalleryPage(
  request: APIRequestContext,
  sort: "newest" | "oldest",
  cursor?: number
): Promise<{ page: GalleryPage; elapsedMs: number }> {
  const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE) });
  if (cursor !== undefined) params.set("cursor", String(cursor));

  const startedAt = performance.now();
  const response = await request.get(`/api/works/${SERIES}/cards?${params}`);
  const elapsedMs = performance.now() - startedAt;

  expect(response.ok()).toBe(true);
  expect(elapsedMs).toBeLessThanOrEqual(MAX_API_RESPONSE_MS);
  return { page: (await response.json()) as GalleryPage, elapsedMs };
}

async function listImageBytes(
  request: APIRequestContext,
  galleryPage: GalleryPage
): Promise<number> {
  let totalBytes = 0;
  const urls = new Set(
    galleryPage.items.map(
      (item) => item.feedThumbUrl ?? item.imageCandidates[0] ?? ""
    )
  );
  urls.delete("");
  expect(urls.size).toBe(galleryPage.items.length);

  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), `List image failed: ${url}`).toBe(true);
    totalBytes += (await response.body()).byteLength;
  }
  return totalBytes;
}

test.describe("gallery regression coverage", () => {
  test("sorting and range filtering keep cards visible and correctly ordered", async ({
    page,
  }) => {
    await gotoHydratedGallery(page);
    await expectVisibleCards(page);

    const oldestResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith(`/api/works/${SERIES}/cards`) && url.searchParams.get("sort") === "oldest";
    });
    await page.getByRole("combobox", { name: "Sort" }).selectOption("oldest");
    expect((await oldestResponse).ok()).toBe(true);
    await expect(cards(page).first()).toHaveAttribute("data-work-sequence", "1");
    await expectVisibleCards(page);

    const oldestSequences = await cardSequences(page);
    expect(oldestSequences).toEqual([...oldestSequences].sort((a, b) => a - b));
    expect(oldestSequences[0]).toBe(1);

    await page.getByRole("button", { name: "Filter works by range" }).click();
    const rangeResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith(`/api/works/${SERIES}/cards`) && url.searchParams.get("rangeStart") === "101";
    });
    await page.getByRole("button", { name: "No. 101-200", exact: true }).click();
    expect((await rangeResponse).ok()).toBe(true);
    await expect(cards(page).first()).toHaveAttribute("data-work-sequence", "101");
    await expectVisibleCards(page);

    const filteredSequences = await cardSequences(page);
    expect(filteredSequences.every((sequence) => sequence >= 101 && sequence <= 200)).toBe(true);
    expect(filteredSequences).toEqual([...filteredSequences].sort((a, b) => a - b));
    await expect(galleryAlerts(page)).toHaveCount(0);
  });

  test("cursor pages stay bounded and list images remain within the byte budget", async ({
    request,
  }) => {
    for (const sort of ["newest", "oldest"] as const) {
      const first = await fetchGalleryPage(request, sort);
      expect(first.page.items).toHaveLength(PAGE_SIZE);
      expect(first.page.limit).toBe(PAGE_SIZE);
      expect(first.page.nextCursor).not.toBeNull();

      const second = await fetchGalleryPage(request, sort, first.page.nextCursor!);
      expect(second.page.items).toHaveLength(PAGE_SIZE);

      const firstIds = new Set(first.page.items.map((item) => item.id));
      expect(second.page.items.some((item) => firstIds.has(item.id))).toBe(false);

      const firstLast = first.page.items.at(-1)!.sequenceNumber;
      const secondFirst = second.page.items[0].sequenceNumber;
      expect(sort === "oldest" ? secondFirst > firstLast : secondFirst < firstLast).toBe(true);

      for (const galleryPage of [first.page, second.page]) {
        const bytes = await listImageBytes(request, galleryPage);
        expect(bytes).toBeLessThanOrEqual(MAX_LIST_IMAGE_BYTES_PER_PAGE);
      }
    }

    const clamped = await request.get(
      `/api/works/${SERIES}/cards?sort=oldest&limit=999`
    );
    expect(clamped.ok()).toBe(true);
    const clampedPage = (await clamped.json()) as GalleryPage;
    expect(clampedPage.limit).toBe(50);
    expect(clampedPage.items).toHaveLength(50);
  });

  test("an oldest-first long scroll loads every cursor once within the DOM budget", async ({
    page,
  }) => {
    const cardRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith(`/api/works/${SERIES}/cards`)) {
        cardRequests.push(url.toString());
      }
    });

    await gotoHydratedGallery(page);
    const total = Number(await galleryRoot(page).getAttribute("data-gallery-total"));
    expect(total).toBeGreaterThan(PAGE_SIZE);
    expect(total).toBeLessThanOrEqual(MAX_LONG_SCROLL_CARDS);

    await page.getByRole("combobox", { name: "Sort" }).selectOption("oldest");
    await expect(cards(page).first()).toHaveAttribute("data-work-sequence", "1");
    await expectVisibleCards(page);

    while ((await cards(page).count()) < total) {
      const previousCount = await cards(page).count();
      await page.locator("[data-gallery-sentinel]").scrollIntoViewIfNeeded();
      await expect
        .poll(() => cards(page).count(), { timeout: 15_000 })
        .toBeGreaterThan(previousCount);
    }

    await expect(cards(page)).toHaveCount(total);
    await expect(page.getByText("All works loaded", { exact: true })).toBeVisible();
    await expect(galleryAlerts(page)).toHaveCount(0);

    const ids = await cards(page).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-work-id"))
    );
    expect(new Set(ids).size).toBe(total);

    const sequences = await cardSequences(page);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));

    const uniqueRequests = new Set(cardRequests);
    expect(uniqueRequests.size).toBe(cardRequests.length);
    expect(cardRequests).toHaveLength(Math.ceil(total / PAGE_SIZE));

    const animatedCards = await page.locator("[data-card].animate-fade-in-up").count();
    expect(animatedCards).toBeLessThanOrEqual(PAGE_SIZE);

    const domElements = await page.locator("*").count();
    expect(domElements).toBeLessThanOrEqual(MAX_LONG_SCROLL_DOM_ELEMENTS);
  });
});
