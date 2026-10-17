// Content for the help and legal pages, kept as data so the app and the
// markdown copies in docs/ come from the same words.
//
// Text strings may use `code` for mono spans and **bold** for emphasis.

export type Block =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'list'; items: string[]; ordered?: boolean }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'note'; text: string; tone?: 'info' | 'warning' }
  | { t: 'defs'; items: { term: string; text: string }[] }
  /** The status chips with what each one means. */
  | { t: 'chips' };

export interface LegalDoc {
  slug: string;
  title: string;
  /** One line for the index. */
  summary: string;
  version: string;
  blocks: Block[];
}

export type Audience = 'crew' | 'supervisors' | 'admins' | 'everyone';

export interface HelpSection {
  id: string;
  title: string;
  audience: Audience;
  blocks: Block[];
}
