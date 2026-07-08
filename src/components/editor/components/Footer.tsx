'use client';

// IMAGINE site footer, ported for the consolidated app (M4).
//
// Differences from the IMAGINE original (imagine/src/components/Footer.tsx):
// - Internal links go through the router shim (next/navigation).
// - Restored public IMAGINE pages live under /imagine/* in the consolidated
//   app, so footer links point there instead of the retired app subdomain.

import { useTranslation } from 'react-i18next';
import { Link } from '@/components/editor/lib/router';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Footer() {
    const { t } = useTranslation('common');

    return (
        <footer className="bg-[#101010] border-t border-gray-800 py-12 mt-auto">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col items-center md:items-start">
                        <img src="/logo_imagine_white.svg" alt="IMAGINE" className="h-7 mb-2" />
                        <p className="text-gray-400 text-sm mb-4">
                            {t('footer.tagline')}
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-4 sm:items-center">
                            <a
                                href="https://www.instagram.com/whatif.ep/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                                whatif.ep
                            </a>
                            <a
                                href="https://www.threads.net/@whatif.ep"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 192 192">
                                    <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.723-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.13 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.194 47.292 9.642 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.173 42.554-6.708 57.048-21.19 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-11.991-18.842-21.723-24.552Z"/>
                                    <path d="M102.378 125.838c-11.315.613-23.712-4.135-24.705-13.768-.531-5.166 1.906-9.925 6.866-13.396 5.025-3.517 11.578-5.253 19.467-5.158 5.89.071 11.507.839 16.678 2.276-1.962 19.569-9.046 29.413-18.306 30.046Z"/>
                                </svg>
                                whatif.ep
                            </a>
                            <a
                                href="https://whatif.stores.jp/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                                </svg>
                                {t('footer.shop')}
                            </a>
                            <a
                                href="https://discord.gg/cW2uUGUR"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                                </svg>
                                Discord
                            </a>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 md:gap-16">
                        <div className="flex flex-col gap-4 items-center md:items-start">
                            <Link to="/imagine/about" className="text-gray-400 hover:text-white text-sm transition-colors">
                                {t('footer.aboutUs')}
                            </Link>
                            <Link to="/imagine" className="text-gray-400 hover:text-white text-sm transition-colors">
                                {t('footer.company')}
                            </Link>
                            <Link to="/imagine/contact" className="text-gray-400 hover:text-white text-sm transition-colors">
                                {t('footer.contact')}
                            </Link>
                        </div>
                        <div className="flex flex-col gap-4 items-center md:items-start">
                            <Link to="/imagine/legal/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                                {t('footer.privacyPolicy')}
                            </Link>
                            <Link to="/imagine/legal/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                                {t('footer.termsOfService')}
                            </Link>
                            <Link to="/imagine/legal/security" className="text-gray-400 hover:text-white text-sm transition-colors">
                                {t('footer.securityPolicy')}
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row md:justify-between justify-center items-center gap-4">
                    <p className="text-gray-500 text-xs">
                        {t('footer.copyright')}
                    </p>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher dropUp />
                        <Link to="/imagine/legal/specified-commercial-transactions-act" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                            {t('footer.legalInfo')}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
