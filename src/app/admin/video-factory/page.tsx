import type { Metadata } from "next";
import { VideoFactoryClient } from "./VideoFactoryClient";

export const metadata: Metadata = {
  title: "Video Factory",
  description: "WHATIF Video Factory — assemble IMAGINE designs into Remotion sequences.",
  robots: { index: false },
};

// /admin/video-factory — the video production line, sibling of Content
// Factory: browse IMAGINE banners, order them into a sequence, download
// Remotion-compatible fixtures. API access is admin-gated server-side.
export default function VideoFactoryPage() {
  return (
    <div className="-mt-14 flex-1 bg-[#0a0a0d] pt-14 text-[#f4f2ec]">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        <header className="py-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.5em] text-[#ff6b35]">
            WHATIF // PRODUCTION LINE
          </p>
          <h1 className="mt-2 text-4xl font-black italic tracking-tight sm:text-5xl">
            VIDEO FACTORY
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            IMAGINEで作ったデザインを動画のシーケンスとして束ね、Remotion用の
            fixtureを書き出す生産ライン。デザインはIMAGINEのエディタで、
            レンダリングはローカルの lab/video/imagine-promo で行う。
          </p>
        </header>
        <VideoFactoryClient />
      </div>
    </div>
  );
}
