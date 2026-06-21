"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, type Language } from "@/context/LanguageContext";

interface DialogCopy {
  title: string;
  warning: string;
  // Confirmation: the user must type their email (or the word) to enable delete.
  confirmPrompt: string;
  confirmWord: string;
  placeholder: string;
  cancel: string;
  confirm: string;
  deleting: string;
  error: string;
}

// "DELETE" word fallback when the account has no email on file (rare). Localized
// confirmation word per language so the typed confirmation matches the prompt.
const CONFIRM_WORD: Record<Language, string> = {
  en: "DELETE",
  ja: "削除",
  "zh-CN": "删除",
  "zh-TW": "刪除",
  ko: "삭제",
};

const COPY: Record<Language, DialogCopy> = {
  en: {
    title: "Delete your account?",
    warning:
      "This permanently deletes your account, saved works, uploaded images, and personal data. This action cannot be undone.",
    confirmPrompt: "To confirm, type {value} below.",
    confirmWord: "DELETE",
    placeholder: "Type to confirm",
    cancel: "Cancel",
    confirm: "Delete account",
    deleting: "Deleting…",
    error: "Could not delete your account. Please try again.",
  },
  ja: {
    title: "アカウントを削除しますか？",
    warning:
      "アカウント、保存した作品、アップロード画像、個人データを完全に削除します。この操作は取り消せません。",
    confirmPrompt: "確認のため、下に {value} と入力してください。",
    confirmWord: "削除",
    placeholder: "確認のため入力",
    cancel: "キャンセル",
    confirm: "アカウントを削除",
    deleting: "削除中…",
    error: "アカウントを削除できませんでした。もう一度お試しください。",
  },
  "zh-CN": {
    title: "确定删除账户？",
    warning:
      "这将永久删除您的账户、已保存作品、上传的图片以及个人数据。此操作无法撤销。",
    confirmPrompt: "请在下方输入 {value} 以确认。",
    confirmWord: "删除",
    placeholder: "输入以确认",
    cancel: "取消",
    confirm: "删除账户",
    deleting: "删除中…",
    error: "无法删除您的账户，请重试。",
  },
  "zh-TW": {
    title: "確定刪除帳戶？",
    warning:
      "這將永久刪除您的帳戶、已儲存作品、上傳的圖片以及個人資料。此操作無法復原。",
    confirmPrompt: "請在下方輸入 {value} 以確認。",
    confirmWord: "刪除",
    placeholder: "輸入以確認",
    cancel: "取消",
    confirm: "刪除帳戶",
    deleting: "刪除中…",
    error: "無法刪除您的帳戶，請重試。",
  },
  ko: {
    title: "계정을 삭제하시겠습니까?",
    warning:
      "계정, 저장한 작품, 업로드한 이미지, 개인 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
    confirmPrompt: "확인을 위해 아래에 {value} 을(를) 입력하세요.",
    confirmWord: "삭제",
    placeholder: "확인하려면 입력",
    cancel: "취소",
    confirm: "계정 삭제",
    deleting: "삭제 중…",
    error: "계정을 삭제할 수 없습니다. 다시 시도해 주세요.",
  },
};

// Destructive account deletion with a typed-confirmation guard. The user must
// type their exact email (or a localized confirmation word if no email exists)
// before the delete button enables. On success the server has already cleared
// the session cookies; we sign out locally and send the user home.
export function DeleteAccountDialog({
  triggerLabel,
  userEmail,
}: {
  triggerLabel: string;
  userEmail: string | null;
}) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const { signOut } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  // Require the exact email when present; otherwise the localized word.
  const requiredValue = userEmail ?? CONFIRM_WORD[lang];
  const canDelete = confirmText.trim() === requiredValue && !deleting;

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setConfirmText("");
    setError(false);
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(false);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        setError(true);
        setDeleting(false);
        return;
      }
      // Clear any client-held session state, then leave the app.
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError(true);
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press mt-4 inline-flex items-center justify-center rounded-lg border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground">{t.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{t.warning}</p>

            <label className="mt-5 block text-xs text-muted">
              {t.confirmPrompt.split("{value}").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="font-semibold text-foreground">
                      {requiredValue}
                    </span>
                  )}
                </span>
              ))}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t.placeholder}
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />

            {error && <p className="mt-2 text-xs text-red-500">{t.error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={deleting}
                className="btn-press rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete}
                className="btn-press rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? t.deleting : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
