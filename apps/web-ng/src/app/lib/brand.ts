/**
 * Startup branding: the single place to change the logo, name and copyright.
 * PLACEHOLDERS for now: replace src/assets/brand/logo.svg with the real wide wordmark and set the real name.
 */
export const BRAND = {
  /** Used in the copyright line and as the logo's alt text. */
  name: 'Your Company',
  /** Wide wordmark logo (the name is inside the logo). Served from src/assets. */
  logo: 'assets/brand/logo.svg',
  /** {year} becomes the current year. */
  copyright: '© {year} {name}. All rights reserved.',
  product: 'AI Academy FDE Dashboard',
} as const;

export function copyrightText(now = new Date()): string {
  return BRAND.copyright.replace('{year}', String(now.getFullYear())).replace('{name}', BRAND.name);
}

/** App version shown in the footer (keep in step with package.json). */
export const APP_VERSION = '0.1.0';
