import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import enBanner from './locales/en/banner.json';
import enEditor from './locales/en/editor.json';
import enAuth from './locales/en/auth.json';
import enModal from './locales/en/modal.json';
import enMessage from './locales/en/message.json';

import jaCommon from './locales/ja/common.json';
import jaBanner from './locales/ja/banner.json';
import jaEditor from './locales/ja/editor.json';
import jaAuth from './locales/ja/auth.json';
import jaModal from './locales/ja/modal.json';
import jaMessage from './locales/ja/message.json';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNBanner from './locales/zh-CN/banner.json';
import zhCNEditor from './locales/zh-CN/editor.json';
import zhCNAuth from './locales/zh-CN/auth.json';
import zhCNModal from './locales/zh-CN/modal.json';
import zhCNMessage from './locales/zh-CN/message.json';

import zhTWCommon from './locales/zh-TW/common.json';
import zhTWBanner from './locales/zh-TW/banner.json';
import zhTWEditor from './locales/zh-TW/editor.json';
import zhTWAuth from './locales/zh-TW/auth.json';
import zhTWModal from './locales/zh-TW/modal.json';
import zhTWMessage from './locales/zh-TW/message.json';

import koCommon from './locales/ko/common.json';
import koBanner from './locales/ko/banner.json';
import koEditor from './locales/ko/editor.json';
import koAuth from './locales/ko/auth.json';
import koModal from './locales/ko/modal.json';
import koMessage from './locales/ko/message.json';

// Resource bundle
const resources = {
  en: {
    common: enCommon,
    banner: enBanner,
    editor: enEditor,
    auth: enAuth,
    modal: enModal,
    message: enMessage,
  },
  ja: {
    common: jaCommon,
    banner: jaBanner,
    editor: jaEditor,
    auth: jaAuth,
    modal: jaModal,
    message: jaMessage,
  },
  'zh-CN': {
    common: zhCNCommon,
    banner: zhCNBanner,
    editor: zhCNEditor,
    auth: zhCNAuth,
    modal: zhCNModal,
    message: zhCNMessage,
  },
  'zh-TW': {
    common: zhTWCommon,
    banner: zhTWBanner,
    editor: zhTWEditor,
    auth: zhTWAuth,
    modal: zhTWModal,
    message: zhTWMessage,
  },
  ko: {
    common: koCommon,
    banner: koBanner,
    editor: koEditor,
    auth: koAuth,
    modal: koModal,
    message: koMessage,
  },
};

i18n
  .use(LanguageDetector) // Browser language detection
  .use(initReactI18next) // React integration
  .init({
    resources,
    fallbackLng: 'en', // Fallback language (English as default)
    defaultNS: 'common', // Default namespace
    ns: ['common', 'banner', 'editor', 'auth', 'modal', 'message'],

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'banalist_language',
    },

    debug: process.env.NODE_ENV === 'development', // Enable debug in development
  });

export default i18n;