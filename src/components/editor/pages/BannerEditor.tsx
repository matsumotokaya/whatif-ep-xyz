import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import { EditorWorkspace, type GuestDocumentSource } from '../components/EditorWorkspace';
import { UpgradeModal } from '../components/UpgradeModal';
import { GuestEditorNoticeModal } from '../components/GuestEditorNoticeModal';
import { useBanner } from '../hooks/useBanners';
import { useOpenTemplate } from '../hooks/useOpenTemplate';
import { useAuth } from '../contexts/AuthContext';
import type { CanvasElement, Template } from '../types/template';
import { GUEST_STORAGE_KEY } from '../utils/guestDesign';

// Navigation state handed over by the screen that opened the editor.
interface EditorLocationState {
  returnTo?: string;
  // Present when a guest opens a template: the design to start from.
  template?: Template;
  elements?: CanvasElement[];
  canvasColor?: string;
  name?: string;
  templateId?: string;
}

const GUEST_NOTICE_ACK_KEY = 'whatif_guest_editor_notice_ack';

function readGuestNoticeAck(): boolean {
  try {
    return sessionStorage.getItem(GUEST_NOTICE_ACK_KEY) !== null;
  } catch {
    // sessionStorage may be unavailable (private mode): show the notice.
    return false;
  }
}

// The guest's single design saved in this browser, if any.
function readStoredGuestDesign(): GuestDocumentSource | null {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as {
      name?: string;
      template?: Template;
      elements?: CanvasElement[];
      canvasColor?: string;
      createdAt?: string;
    };
    if (!parsed.template) return null;
    return {
      kind: 'guest',
      name: parsed.name ?? '',
      template: parsed.template,
      elements: parsed.elements ?? [],
      canvasColor: parsed.canvasColor ?? '#FFFFFF',
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[BannerEditor] Failed to load guest banner from localStorage:', error);
    return null;
  }
}

function EditorSpinner({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      <p className="mt-4 text-gray-600">{label}</p>
    </div>
  );
}

// Route-level editor entry: decides WHICH document is open (a guest design, a
// saved design, or a template being opened by link) and shows the loading and
// failure states. Everything about editing lives in EditorWorkspace, which is
// mounted once per document.
export const BannerEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, profileLoading } = useAuth();
  const { t } = useTranslation(['common', 'banner']);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Guest-only editor notice (download is fine, saving needs login). Shown once
  // per browser session so it does not nag on every re-entry within a session.
  const [guestNoticeAcked, setGuestNoticeAcked] = useState(readGuestNoticeAck);

  const isGuest = !id;
  const locationState = location.state as EditorLocationState | null;
  // "Back to list" target. Guests also return to the design list (/mydesign
  // renders their single localStorage design) so they can see their work was
  // saved, instead of the Gallery top.
  const editorReturnTo = locationState?.returnTo || '/mydesign';
  const directOpenTemplateId = searchParams.get('template');
  const hasGuestHandoff = Boolean(locationState?.template);

  const {
    data: bannerData,
    isError: isBannerError,
    isFetched: isBannerFetched,
  } = useBanner(id && user ? id : undefined);

  // A saved design needs its owner: send a logged-out visitor to login and
  // bring them back to the same design afterwards.
  useEffect(() => {
    if (!id || authLoading || user) return;
    navigate(`/auth/login?next=${encodeURIComponent(`/edit/${id}`)}`);
  }, [authLoading, id, navigate, user]);

  // Which guest design is open. A template handed over by navigation wins;
  // otherwise the design stored in this browser. While a ?template direct-open
  // is in flight nothing is restored: a stale stored design would shadow the
  // requested template (showing a previously edited episode).
  const guestSource = useMemo<GuestDocumentSource | null>(() => {
    if (!isGuest) return null;
    if (locationState?.template) {
      return {
        kind: 'guest',
        name: locationState.name ?? '',
        template: locationState.template,
        elements: locationState.elements ?? [],
        canvasColor: locationState.canvasColor ?? '#FFFFFF',
        createdAt: new Date().toISOString(),
      };
    }
    if (directOpenTemplateId) return null;
    return readStoredGuestDesign();
  }, [isGuest, locationState, directOpenTemplateId]);

  // Nothing to edit and nothing on the way: leave for the gallery.
  useEffect(() => {
    if (isGuest && !guestSource && !directOpenTemplateId) navigate('/');
  }, [isGuest, guestSource, directOpenTemplateId, navigate]);

  // Direct-open receiver for /edit?template=<id> (Gallery "Edit in IMAGINE").
  // Reuses the shared open flow (premium guard + login/guest branch). On a guest
  // design conflict we overwrite, matching the GuestLimitModal confirm behavior.
  const openTemplateFromQuery = useOpenTemplate({
    onUpgradeRequired: () => setShowUpgradeModal(true),
    onLoginRequired: () => {
      // Logged-out visitor opened a premium template via ?template link.
      // Send to login and return to this exact ?template URL afterwards, so a
      // premium member can sign in and continue straight into the editor.
      const redirectPath = `${location.pathname}${location.search}`;
      navigate(`/auth/login?next=${encodeURIComponent(redirectPath)}`);
    },
    onGuestConflict: (template) => {
      navigate('/edit', {
        state: {
          template: {
            id: template.id,
            name: template.name,
            width: template.width,
            height: template.height,
            backgroundColor: template.canvasColor,
            thumbnail: template.thumbnailUrl,
            planType: template.planType,
          },
          elements: JSON.parse(JSON.stringify(template.elements || [])),
          canvasColor: template.canvasColor,
          name: template.name,
          templateId: template.id,
        },
      });
    },
  });

  const directOpenHandledRef = useRef(false);
  useEffect(() => {
    // Only fire when arriving via a fresh ?template link (no editor state present).
    if (!directOpenTemplateId || hasGuestHandoff || directOpenHandledRef.current) {
      return;
    }
    // Wait for AuthContext to resolve before opening. Firing while auth is still
    // loading would treat a logged-in (premium) user as a guest, wrongly hitting
    // the premium guard / guest branch in useOpenTemplate. The profile row is
    // fetched separately from the session, so wait for that too: until it lands
    // a premium member reads as 'free' (see editor/contexts/AuthContext.tsx) and
    // this ref is already latched, leaving them stuck behind the upgrade modal.
    if (authLoading || profileLoading) {
      return;
    }
    directOpenHandledRef.current = true;
    void openTemplateFromQuery({
      id: directOpenTemplateId,
      name: '',
      canvasColor: '#FFFFFF',
    });
  }, [directOpenTemplateId, hasGuestHandoff, authLoading, profileLoading, openTemplateFromQuery]);

  const handleGuestNoticeConfirm = () => {
    try {
      sessionStorage.setItem(GUEST_NOTICE_ACK_KEY, '1');
    } catch {
      // sessionStorage may be unavailable (private mode); just dismiss.
    }
    setGuestNoticeAcked(true);
  };

  // Guest/free users opening a premium template via ?template have no document
  // yet, so the upgrade/login flow must be reachable from every state below.
  const upgradeModal = (
    <UpgradeModal
      isOpen={showUpgradeModal}
      onClose={() => {
        setShowUpgradeModal(false);
        navigate(editorReturnTo);
      }}
    />
  );

  const loadingScreen = (
    <div className="flex h-dvh items-center justify-center bg-[#1e1e1e]">
      <EditorSpinner label={t('common:status.loading')} />
      {upgradeModal}
    </div>
  );

  if (isGuest) {
    if (!guestSource) return loadingScreen;

    return (
      <>
        <EditorWorkspace
          // A new handoff or a different stored design is a different document.
          key={`guest:${guestSource.template.id}:${guestSource.createdAt}`}
          source={guestSource}
          returnTo={editorReturnTo}
        />
        <GuestEditorNoticeModal
          isOpen={!authLoading && !user && !guestNoticeAcked}
          onConfirm={handleGuestNoticeConfirm}
          title={t('banner:guestNoticeTitle')}
          message={t('banner:guestNoticeMessage')}
          confirmLabel={t('banner:guestNoticeConfirm')}
        />
        {upgradeModal}
      </>
    );
  }

  // Saved design: wait for the session, then for the row.
  if (authLoading || !user) return loadingScreen;

  if (!bannerData) {
    // Still fetching (including retries).
    if (!isBannerError && !isBannerFetched) return loadingScreen;

    // The design could not be loaded, or it does not exist for this account.
    // Only reachable without a document: once a design is open, a failed
    // background refetch must never take the editor away from the user.
    return (
      <div className="flex h-dvh items-center justify-center bg-[#1e1e1e] px-6 text-white">
        <div className="max-w-sm text-center">
          <p className="text-pretty text-sm text-white/75">{t('banner:templateLoadFailed')}</p>
          <button
            type="button"
            onClick={() => navigate(editorReturnTo)}
            className="mt-4 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
          >
            {t('common:button.back')}
          </button>
        </div>
        {upgradeModal}
      </div>
    );
  }

  // NOTE: do NOT gate this on bannerData.template.planType. A saved design is
  // the user's own work (RLS only returns rows they own), and premium is an
  // entitlement to *pick* premium templates and library assets, not a lock on
  // designs already created with them. Gating here locked people out of their
  // own designs the moment a subscription lapsed. The premium guard belongs to
  // the creation paths only: useOpenTemplate (new design from a premium
  // template) and the image library buttons in Sidebar/MobileToolbar.
  return (
    <>
      <EditorWorkspace
        key={`member:${bannerData.id}`}
        source={{ kind: 'member', banner: bannerData }}
        returnTo={editorReturnTo}
      />
      {upgradeModal}
    </>
  );
};
