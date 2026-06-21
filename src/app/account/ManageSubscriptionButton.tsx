"use client";

import { useState } from "react";
import { useLanguage, type Language } from "@/context/LanguageContext";

const ERROR_COPY: Record<Language, string> = {
  en: "Could not open the billing portal. Please try again.",
  ja: "請求ポータルを開けませんでした。もう一度お試しください。",
  "zh-CN": "无法打开账单门户，请重试。",
  "zh-TW": "無法開啟帳單入口，請重試。",
  ko: "결제 포털을 열 수 없습니다. 다시 시도해 주세요.",
};

// Opens the Stripe Customer (Billing) Portal. Calls our server route to create a
// portal session, then redirects the browser to the returned URL. Used only when
// the account has a Stripe customer (gated by the parent).
export function ManageSubscriptionButton({ label }: { label: string }) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/account/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-press inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
      >
        {label}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-500">{ERROR_COPY[lang]}</p>
      )}
    </div>
  );
}
