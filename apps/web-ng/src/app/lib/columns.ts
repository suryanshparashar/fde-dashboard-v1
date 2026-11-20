import type { Field } from '../types';

export interface FieldSpec {
  field: Field;
  label: string;
  required: boolean;
  aliases: string[];
}

/**
 * Upload columns in the sheet's order. Aliases are compared after normalizeHeader()
 * (lower-case, letters and digits only), so they must be written that way.
 */
export const FIELDS: FieldSpec[] = [
  { field: 'empId', label: 'Emp ID', required: true, aliases: ['empid', 'employeeid', 'userid', 'id', 'empcode', 'employeecode', 'empno', 'employeeno', 'staffid', 'uid'] },
  { field: 'name', label: 'Name', required: true, aliases: ['name', 'employeename', 'empname', 'fullname', 'username', 'staffname'] },
  { field: 'reportingOrg', label: 'Reporting Orgn', required: false, aliases: ['reportingorgn', 'reportingorg', 'reportingorganization', 'reportingorganisation', 'reportingorgname', 'organization', 'organisation', 'org', 'businessunit', 'bu'] },
  { field: 'band', label: 'Band', required: false, aliases: ['band', 'grade', 'payband', 'bandgrade'] },
  { field: 'hyperscaler', label: 'HyperScaler', required: true, aliases: ['hyperscaler', 'hyperscalers', 'cloud', 'cloudprovider', 'provider', 'platform'] },
  { field: 'eta', label: 'ETA (Date)', required: false, aliases: ['etadate', 'eta', 'date', 'targetdate', 'completiondate', 'expecteddate', 'completedon', 'etacompletiondate'] },
  { field: 'status', label: 'Certificate done/WIP', required: true, aliases: ['certificatedonewip', 'certificationdonewip', 'donewip', 'status', 'certificatestatus', 'certificationstatus', 'certstatus'] },
  { field: 'level', label: 'Certification Levels', required: true, aliases: ['certificationlevels', 'certificationlevel', 'level', 'levels', 'certlevel', 'lvl'] },
  { field: 'email', label: 'Email ID', required: false, aliases: ['emailid', 'email', 'emailaddress', 'mail', 'mailid', 'officialemail'] },
];

export type ColumnMapping = Record<Field, number | null>;

export function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Map each field to a header index using the alias list. Each header is used at most once. */
export function autoMapColumns(headers: unknown[]): ColumnMapping {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping = {} as ColumnMapping;
  for (const spec of FIELDS) {
    mapping[spec.field] = null;
    for (const alias of spec.aliases) {
      const idx = norm.findIndex((h, i) => h === alias && !used.has(i));
      if (idx >= 0) {
        mapping[spec.field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return mapping;
}

export function missingRequired(mapping: ColumnMapping): FieldSpec[] {
  return FIELDS.filter((f) => f.required && mapping[f.field] == null);
}
