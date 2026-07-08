'use client';

import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { DemoCanvas } from '../components/DemoCanvas';
import { Link } from '../lib/router';
import { useAuth } from '../contexts/AuthContext';

export function ImagineLandingPage() {
  const { t } = useTranslation(['common', 'auth']);
  const { user, profile, loading, profileLoading } = useAuth();
  const isReady = !loading && !(user && profileLoading);
  const isSignedIn = Boolean(user);
  const isPremium = profile?.subscriptionTier === 'premium';

  return (
    <div className="min-h-screen bg-[#101010] flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="px-6 pt-16 pb-24 md:pt-20 md:pb-28">
          <div className="max-w-6xl mx-auto">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-300/80">
                {t('auth:serviceEyebrow')}
              </p>
              <h1 className="mt-5 text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
                {t('common:hero.headline1')}{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                  {t('common:hero.headline2')}
                </span>
                <br />
                <span className="text-gray-400 text-4xl md:text-5xl lg:text-6xl font-medium">
                  {t('common:hero.headline3')}
                </span>
              </h1>
              <p className="mt-8 max-w-3xl mx-auto text-base md:text-xl leading-relaxed text-gray-400">
                {t('common:hero.description')}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to={isSignedIn ? '/mydesign' : '/edit'}
                  className="inline-flex min-w-52 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-950 transition-colors hover:bg-gray-200"
                >
                  {isSignedIn ? t('auth:mypage.title') : t('auth:continueAsGuest')}
                </Link>
                <Link
                  to={isSignedIn ? '/edit' : '/auth/login?next=%2Fmydesign'}
                  className="inline-flex min-w-52 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {isSignedIn ? t('common:button.create') : t('auth:startFreePlan')}
                </Link>
                <Link
                  to="/plans"
                  className="inline-flex min-w-52 items-center justify-center rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-6 py-3 text-sm font-semibold text-indigo-100 transition-colors hover:bg-indigo-500/20"
                >
                  {t('auth:plansTitle')}
                </Link>
              </div>
            </div>

            <div className="mt-16 flex justify-center px-2 md:px-6">
              <div className="md:hidden w-full max-w-[92vw]">
                <DemoCanvas scale={0.16} />
              </div>
              <div className="hidden md:block lg:hidden">
                <DemoCanvas scale={0.35} />
              </div>
              <div className="hidden lg:block">
                <DemoCanvas scale={0.45} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-800 px-6 py-16">
          <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
                {t('auth:serviceTitle')}
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white">
                {t('auth:serviceDescription')}
              </h2>
              <p className="mt-5 text-sm leading-7 text-gray-400">
                {t('auth:servicePremiumDescription')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/works/episode"
                  className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
                >
                  {t('common:galleryLink')}
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
                >
                  {t('common:footer.aboutUs')}
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  {t('auth:guestTitle')}
                </p>
                <p className="mt-3 text-sm leading-7 text-gray-300">
                  {t('auth:guestDescription')}
                </p>
              </div>
              <div className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                  {t('auth:memberTitle')}
                </p>
                <p className="mt-3 text-sm leading-7 text-gray-300">
                  {t('auth:memberDescription')}
                </p>
              </div>
              <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    {t('auth:premiumMemberTitle')}
                  </p>
                  {isReady && isPremium && (
                    <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-bold text-gray-950">
                      PREMIUM
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-7 text-gray-300">
                  {t('auth:premiumMemberDescription')}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
