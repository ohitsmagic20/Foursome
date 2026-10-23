/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A unique id per deploy, used to tell open copies of the app that an update is available.
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA || (process.env.VERCEL ? String(Date.now()) : 'dev') },
  async headers() {
    // The service worker must never be cached, so notification fixes reach phones right away.
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] }];
  },
};

export default nextConfig;
