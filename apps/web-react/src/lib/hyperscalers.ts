/**
 * The known HyperScalers and the spellings that map to them.
 * - BASE: always shown on the dashboard, even in a month with no rows for them.
 * - The other known ones get a card only when a file has rows for them.
 * - Any other name is added automatically (own card, flagged on the upload screen).
 */
export const BASE_HYPERSCALERS = ['Anthropic', 'Azure', 'AWS', 'Google'] as const;
export const KNOWN_HYPERSCALERS = [...BASE_HYPERSCALERS, 'GitHub', 'Red Hat OpenShift', 'Red Hat Ansible Automation'] as const;

/** Keys are compared after hsKey(): lower-case, letters and digits only, a trailing "FDE" removed. */
const ALIASES: Record<string, string> = {
  anthropic: 'Anthropic',
  claude: 'Anthropic',
  anthropicclaude: 'Anthropic',
  azure: 'Azure',
  msazure: 'Azure',
  microsoftazure: 'Azure',
  microsoft: 'Azure',
  aws: 'AWS',
  google: 'Google',
  gcp: 'Google',
  googlecloud: 'Google',
  github: 'GitHub',
  githubcopilot: 'GitHub',
  openshift: 'Red Hat OpenShift',
  redhatopenshift: 'Red Hat OpenShift',
  ansible: 'Red Hat Ansible Automation',
  redhatansible: 'Red Hat Ansible Automation',
  redhatansibleautomation: 'Red Hat Ansible Automation',
};

/** "Anthropic FDE" and "Anthropic" match the same way, as in the programme names. */
export const hsKey = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)fde$/, '$1');

/** Built-in rule only: "Claude" → "Anthropic", "GCP" → "Google". null when not one of the known ones. */
export function knownHyperscaler(value: unknown): string | null {
  return ALIASES[hsKey(value)] ?? null;
}

export const isKnownHyperscaler = (name: string) => (KNOWN_HYPERSCALERS as readonly string[]).includes(name);
export const isBaseHyperscaler = (name: string) => (BASE_HYPERSCALERS as readonly string[]).includes(name);

/** Display order: known ones in their fixed order, then added ones alphabetically. */
export function sortHyperscalers(names: Iterable<string>): string[] {
  const order = (n: string) => {
    const i = (KNOWN_HYPERSCALERS as readonly string[]).indexOf(n);
    return i < 0 ? 99 : i;
  };
  return [...new Set(names)].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
}

/** The HyperScalers the dashboard shows: the 4 base ones always, plus every one with data. */
export const shownHyperscalers = (withData: Iterable<string>) => sortHyperscalers([...BASE_HYPERSCALERS, ...withData]);

/** Short monogram, used when there is no logo. */
export function hsMonogram(name: string): string {
  const fixed: Record<string, string> = { Anthropic: 'A\\', AWS: 'AWS', Azure: 'Az', Google: 'G', GitHub: 'GH' };
  if (fixed[name]) return fixed[name];
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((w) => w[0]).join('') : name.slice(0, 2)).slice(0, 3).toUpperCase();
}
