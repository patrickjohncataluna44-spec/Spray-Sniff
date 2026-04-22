// Empty service worker — prevents browser 404 for sw.js
// when no PWA/push features are installed.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
