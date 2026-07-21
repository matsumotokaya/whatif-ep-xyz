'use client';

import { useLocation, useNavigate } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export const GalleryTabs = () => {
  const { t } = useTranslation(['banner']);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, profileLoading } = useAuth();
  const isAdmin = !profileLoading && profile?.role === 'admin';
  const pathname = location.pathname;

  const tabs = [
    { path: '/imagine', label: t('banner:templatesTab') },
    { path: '/mydesign', label: t('banner:myBannersTab') },
    ...(isAdmin ? [{ path: '/mydesign/factory', label: t('banner:factoryBannersTab') }] : []),
  ];

  return (
    <div className="flex items-center gap-3 mb-6">
      {tabs.map((tab) => {
        const isActive =
          tab.path === '/imagine'
            ? pathname === '/imagine' || pathname.startsWith('/imagine/')
            : tab.path === '/mydesign'
              ? pathname === '/mydesign'
                || (/^\/mydesign\/[^/]+$/.test(pathname) && !pathname.startsWith('/mydesign/factory'))
              : pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`px-3 sm:px-4 py-2 rounded-full text-[0.7rem] sm:text-sm font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-[#2b2b2b] text-gray-300 hover:bg-[#333333]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
