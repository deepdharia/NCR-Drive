import { Capacitor } from '@capacitor/core';

/** Cache the production build only; never cache Vite's development modules. */
export function registerOfflineSupport() {
  if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Offline play unavailable:', error);
      });
    }, { once: true });
  }
}
