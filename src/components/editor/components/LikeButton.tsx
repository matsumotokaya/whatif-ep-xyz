import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from '../lib/router';
import { useAuth } from '../contexts/AuthContext';
import { useToggleLike, useUserLikes } from '../hooks/useLikes';
import { GuestLimitModal } from './GuestLimitModal';

interface LikeButtonProps {
  templateId: string;
  likeCount: number;
}

export function LikeButton({ templateId, likeCount }: LikeButtonProps) {
  const { t } = useTranslation(['banner', 'common', 'auth']);
  const { user } = useAuth();
  const { data: userLikes } = useUserLikes(user?.id);
  const { mutate: toggleLike, isPending } = useToggleLike();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isLiked = userLikes?.includes(templateId) ?? false;

  const stopCardClick = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleClick = (e: React.MouseEvent) => {
    stopCardClick(e);
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!isPending) {
      toggleLike(templateId);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={stopCardClick}
        onMouseDown={stopCardClick}
        className="flex items-center gap-1 transition-all"
        disabled={isPending}
        aria-label={isLiked ? 'Unlike' : 'Like'}
      >
        <span
          className={`material-symbols-outlined text-[18px] transition-colors ${
            isLiked ? 'text-red-500' : 'text-white/70 hover:text-white'
          }`}
          style={isLiked ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          favorite
        </span>
        {likeCount > 0 && (
          <span className="tabular-nums text-xs font-medium text-white/70">
            {likeCount}
          </span>
        )}
      </button>

      <GuestLimitModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title={t('banner:likeLoginTitle')}
        message={t('banner:likeLoginMessage')}
        cancelLabel={t('common:button.cancel')}
        confirmLabel={t('auth:login')}
        onConfirm={() => {
          setShowLoginModal(false);
          navigate(`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        }}
      />
    </>
  );
}
