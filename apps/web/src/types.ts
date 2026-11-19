/** Status of one level row: Completed / In progress / Not started. */
export type St = 'done' | 'wip' | 'ns';

export const STATUS_LABEL: Record<St, string> = { done: 'Completed', wip: 'In progress', ns: 'Not started' };

/**
 * One row of a monthly sheet after normalization: one employee × one HyperScaler × one level.
 * This is also one row of a snapshot CSV.
 */
export interface DataRow {
  empId: string;
  name: string;
  reportingOrg: string;
  band: string;
  /** Canonical name (Anthropic, AWS, Azure, Google, or a name added from a file). */
  hyperscaler: string;
  /** ISO yyyy-mm-dd, or '' when the cell was empty or unreadable. */
  eta: string;
  status: St;
  /** 1, 2, 3 … ; 0 when the level cell was empty. */
  level: number;
  email: string;
}

/** A validated upload row plus its spreadsheet row number. */
export type CleanRow = DataRow & { sourceRow: number };

/** Upload columns, in the order of the sheet. */
export type Field = 'empId' | 'name' | 'reportingOrg' | 'band' | 'hyperscaler' | 'eta' | 'status' | 'level' | 'email';

export interface RowIssue {
  /** Spreadsheet row number as the user sees it (1-based, header included). */
  row: number;
  empId: string;
  reason: string;
  severity: 'error' | 'warning';
  value?: string;
}

export interface SnapshotInfo {
  /** File name without .csv, e.g. 151126-181126-104205 */
  id: string;
  /** Latest completion date in that upload */
  dataUpTo: Date;
  /** When the upload happened. The data month is the month of this date. */
  uploadedAt: Date;
  sizeBytes: number;
}
