/**
 * Startup branding: the single place to change the logo, name and copyright.
 * PLACEHOLDERS for now: replace public/brand/logo.svg with the real wide wordmark and set the real name.
 */
export const BRAND = {
  /** Used in the copyright line and as the logo's alt text. */
  name: 'Your Company',
  /** Wide wordmark logo (the name is inside the logo). Served from /public. */
  logo: '/brand/logo.svg',
  /** {year} becomes the current year. */
  copyright: '© {year} {name}. All rights reserved.',
  product: 'AI Academy FDE Dashboard',
} as const;

export function copyrightText(now = new Date()): string {
  return BRAND.copyright.replace('{year}', String(now.getFullYear())).replace('{name}', BRAND.name);
}

/** App version from package.json (injected by vite.config.ts). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
