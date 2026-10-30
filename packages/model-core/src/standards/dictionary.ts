import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import type { Entity } from '../types.js';

/**
 * Data standardization dictionary (표준 단어 / 용어 / 도메인 / 코드).
 *
 * Single implementation shared by the dictionary manager, the physical compiler
 * and the physical diagram. The project stores it in two files:
 *   standards/dictionary.yaml  (words, terms, codes)
 *   standards/domains.yaml     (domains)
 */

export type DdlDialect = 'ORACLE' | 'POSTGRES' | 'MYSQL';

export interface StandardDomain {
  logicalName: string;
  dataTypeOracle: string;
  dataTypePostgres: string;
  dataTypeMysql: string;
}

export interface StandardWord {
  logicalName: string;
  physicalAbbr: string;
}

export interface StandardTerm {
  logicalName: string;
  physicalName: string;
}

export interface CodeValue {
  value: string;
  label: string;
}

export interface StandardCode {
  logicalName: string;
  values: CodeValue[];
}

export interface StandardizationDictionary {
  domains: StandardDomain[];
  words: StandardWord[];
  terms: StandardTerm[];
  codes: StandardCode[];
}

export const EMPTY_DICTIONARY: StandardizationDictionary = { domains: [], words: [], terms: [], codes: [] };

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();

/** Accepts every key spelling used so far (logical/physical, logicalName/physicalAbbr, oracle/dataTypeOracle, type …). */
export function normalizeDomain(d: any): StandardDomain | null {
  if (!d || typeof d !== 'object') return null;
  const logicalName = str(d.logicalName ?? d.logical ?? d.name);
  if (!logicalName) return null;
  const common = str(d.physicalName ?? d.physical ?? d.type ?? d.dataType);
  const oracle = str(d.dataTypeOracle ?? d.oracle) || common;
  const postgres = str(d.dataTypePostgres ?? d.postgres ?? d.postgresql) || common || oracle.replace(/VARCHAR2/gi, 'VARCHAR');
  const mysql = str(d.dataTypeMysql ?? d.mysql) || common || postgres;
  return { logicalName, dataTypeOracle: oracle || postgres, dataTypePostgres: postgres, dataTypeMysql: mysql };
}

export function parseStandards(dictionaryYaml: string | undefined, domainsYaml: string | undefined): StandardizationDictionary {
  let d: any = {};
  let m: any = {};
  try {
    d = (dictionaryYaml && yamlParse(dictionaryYaml)) || {};
  } catch {
    d = {};
  }
  try {
    m = (domainsYaml && yamlParse(domainsYaml)) || {};
  } catch {
    m = {};
  }
  const words = (Array.isArray(d.words) ? d.words : [])
    .map((w: any) => ({ logicalName: str(w?.logicalName ?? w?.logical), physicalAbbr: str(w?.physicalAbbr ?? w?.physical ?? w?.abbr) }))
    .filter((w: StandardWord) => w.logicalName && w.physicalAbbr);
  const terms = (Array.isArray(d.terms) ? d.terms : [])
    .map((t: any) => ({ logicalName: str(t?.logicalName ?? t?.logical), physicalName: str(t?.physicalName ?? t?.physical) }))
    .filter((t: StandardTerm) => t.logicalName && t.physicalName);
  const codes = (Array.isArray(d.codes) ? d.codes : [])
    .map((c: any) => ({
      logicalName: str(c?.logicalName ?? c?.logical ?? c?.name),
      values: (Array.isArray(c?.values) ? c.values : []).map((v: any) => ({ value: str(v?.value ?? v?.code), label: str(v?.label ?? v?.name) })),
    }))
    .filter((c: StandardCode) => c.logicalName);
  // Domains may live in domains.yaml or (older files) inside dictionary.yaml.
  const rawDomains = Array.isArray(m.domains) ? m.domains : Array.isArray(d.domains) ? d.domains : [];
  const domains = rawDomains.map(normalizeDomain).filter(Boolean) as StandardDomain[];
  return { words, terms, codes, domains };
}

export function serializeStandards(dict: StandardizationDictionary): { dictionary: string; domains: string } {
  const opts = { indent: 2, lineWidth: 0 } as const;
  return {
    dictionary: yamlStringify({ words: dict.words, terms: dict.terms, codes: dict.codes }, opts),
    domains: yamlStringify({ domains: dict.domains }, opts),
  };
}

/** Adds words (later entries for an existing logical name replace it). */
export function addStandardWords(dict: StandardizationDictionary, words: StandardWord[]): StandardizationDictionary {
  const map = new Map(dict.words.map((w) => [w.logicalName, w] as const));
  words.forEach((w) => {
    const logicalName = str(w.logicalName);
    const physicalAbbr = str(w.physicalAbbr).toUpperCase();
    if (logicalName && physicalAbbr) map.set(logicalName, { logicalName, physicalAbbr });
  });
  return { ...dict, words: [...map.values()] };
}

/* ------------------------------ translation ------------------------------ */

export interface TokenResult {
  text: string;
  standard: boolean;
  abbr?: string;
}

export interface TranslationResult {
  tokens: TokenResult[];
  physicalName: string;
  hasNonStandard: boolean;
  nonStandardWords: string[];
}

function snakeToCamel(snake: string): string {
  return snake
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

const wordCache = new WeakMap<StandardWord[], StandardWord[]>();
function sortedWords(words: StandardWord[]): StandardWord[] {
  let sorted = wordCache.get(words);
  if (!sorted) {
    sorted = words.filter((w) => w && w.logicalName).sort((a, b) => b.logicalName.length - a.logicalName.length);
    wordCache.set(words, sorted);
  }
  return sorted;
}

/**
 * Logical (Korean) name → physical name: exact term match first, otherwise greedy
 * longest-match word segmentation. Characters that match no word are collected as
 * non-standard words; ASCII runs (e.g. "QVI", "ID") are kept as they are and are
 * not reported, spaces/punctuation become separators.
 */
export function translateLogicalName(
  logicalName: unknown,
  dict: StandardizationDictionary,
  caseType: 'UPPER' | 'CAMEL' = 'UPPER'
): TranslationResult {
  const nameStr =
    typeof logicalName === 'string' ? logicalName : logicalName && typeof logicalName === 'object' ? str((logicalName as any).name) : str(logicalName);

  const exact = (dict?.terms || []).find((t) => t && t.logicalName === nameStr);
  if (exact) {
    return {
      tokens: [{ text: nameStr, standard: true, abbr: exact.physicalName }],
      physicalName: caseType === 'CAMEL' ? snakeToCamel(exact.physicalName) : exact.physicalName.toUpperCase(),
      hasNonStandard: false,
      nonStandardWords: [],
    };
  }

  const words = sortedWords(dict?.words || []);
  const tokens: TokenResult[] = [];
  const nonStandardWords: string[] = [];
  let pending = '';
  const flush = () => {
    if (!pending) return;
    tokens.push({ text: pending, standard: false });
    nonStandardWords.push(pending);
    pending = '';
  };

  let rest = nameStr;
  while (rest.length > 0) {
    const w = words.find((x) => rest.startsWith(x.logicalName));
    if (w) {
      flush();
      tokens.push({ text: w.logicalName, standard: true, abbr: w.physicalAbbr });
      rest = rest.slice(w.logicalName.length);
      continue;
    }
    const ascii = /^[A-Za-z][A-Za-z0-9]*/.exec(rest);
    if (ascii) {
      flush();
      tokens.push({ text: ascii[0], standard: true, abbr: ascii[0].toUpperCase() });
      rest = rest.slice(ascii[0].length);
      continue;
    }
    if (/^[\s_\-./()]/.test(rest)) {
      flush();
      rest = rest.slice(1);
      continue;
    }
    pending += rest[0];
    rest = rest.slice(1);
  }
  flush();

  const joined = tokens.map((t) => t.abbr || t.text).join('_');
  return {
    tokens,
    physicalName: caseType === 'CAMEL' ? snakeToCamel(joined) : joined.toUpperCase(),
    hasNonStandard: nonStandardWords.length > 0,
    nonStandardWords,
  };
}

/* ------------------------------- data types ------------------------------ */

const SQL_TYPE = /^(VARCHAR2?|NVARCHAR2?|CHAR|NCHAR|NUMBER|NUMERIC|DECIMAL|INT|INTEGER|BIGINT|SMALLINT|DATE|DATETIME|TIMESTAMP|TEXT|CLOB|BLOB|BOOLEAN|FLOAT|DOUBLE|REAL|SERIAL|BIGSERIAL|JSONB?|UUID|BYTEA|RAW|TIME)\b/i;

/** Adapts a raw SQL type written for one DBMS to another (only the common cases). */
export function adaptSqlType(type: string, dbms: DdlDialect): string {
  let t = type.trim();
  if (dbms === 'ORACLE') {
    t = t.replace(/^VARCHAR\b(?!2)/i, 'VARCHAR2').replace(/^(INT|INTEGER)$/i, 'NUMBER(10)').replace(/^BIGINT$/i, 'NUMBER(19)').replace(/^TEXT$/i, 'CLOB');
    t = t.replace(/^(NUMERIC|DECIMAL)\b/i, 'NUMBER').replace(/^BOOLEAN$/i, 'CHAR(1)').replace(/^DATETIME$/i, 'TIMESTAMP');
  } else {
    t = t.replace(/^VARCHAR2\b/i, 'VARCHAR').replace(/^NUMBER\((\d+)\)$/i, (_m, p) => (Number(p) > 9 ? 'BIGINT' : 'INTEGER')).replace(/^NUMBER\b/i, 'NUMERIC');
    t = t.replace(/^CLOB$/i, 'TEXT');
    if (dbms === 'MYSQL') t = t.replace(/^TIMESTAMP$/i, 'DATETIME').replace(/^NUMERIC\b/i, 'DECIMAL');
    if (dbms === 'POSTGRES') t = t.replace(/^DATETIME$/i, 'TIMESTAMP');
  }
  return t;
}

const DOMAIN_BY_SUFFIX: [RegExp, string][] = [
  [/(번호|ID|Id|Seq|순번)$/, '번호'],
  [/(일시|시간|시각)$/, '일시'],
  [/코드$/, '코드'],
  [/여부$/, '여부'],
  [/(이름|명)$/, '이름'],
  [/(내용|설명|비고)$/, '내용'],
  [/(일자|날짜)$/, '일자'],
  [/(금액|수량|액)$/, '금액'],
];

const FALLBACK_TYPE: Record<DdlDialect, string> = { ORACLE: 'VARCHAR2(100)', POSTGRES: 'VARCHAR(100)', MYSQL: 'VARCHAR(100)' };

/**
 * Physical data type for an attribute:
 *   1. explicit domain that names a standard domain
 *   2. explicit domain that already is a SQL type (DDL/DA# imports) — adapted to the DBMS
 *   3. standard domain inferred from the attribute name suffix (…번호, …일시, …코드 …)
 *   4. VARCHAR(100)
 */
export function resolveDataType(domainName: string | undefined, attributeName: unknown, dbms: DdlDialect, dict: StandardizationDictionary): string {
  const pick = (d: StandardDomain) => (dbms === 'ORACLE' ? d.dataTypeOracle : dbms === 'POSTGRES' ? d.dataTypePostgres : d.dataTypeMysql);
  const domains = dict?.domains || [];
  const explicit = str(domainName);
  if (explicit) {
    const d = domains.find((x) => x.logicalName === explicit);
    if (d && pick(d)) return pick(d);
    if (SQL_TYPE.test(explicit)) return adaptSqlType(explicit, dbms);
  }
  const attr = str(attributeName);
  const sorted = [...domains].sort((a, b) => b.logicalName.length - a.logicalName.length);
  const bySuffix = sorted.find((d) => d.logicalName && attr.endsWith(d.logicalName));
  if (bySuffix && pick(bySuffix)) return pick(bySuffix);
  const inferred = DOMAIN_BY_SUFFIX.find(([re]) => re.test(attr))?.[1];
  const d = inferred && domains.find((x) => x.logicalName === inferred);
  if (d && pick(d)) return pick(d);
  return FALLBACK_TYPE[dbms];
}

/* ------------------------------ audit helpers ----------------------------- */

export interface NonStandardWordUsage {
  word: string;
  /** "엔터티" or "엔터티.속성" names where the word occurs. */
  usedIn: string[];
}

/**
 * Words missing from the dictionary across entity and attribute names.
 * Names that already carry an explicit physical name are skipped — the user
 * decided their physical name, so the dictionary is not consulted.
 */
export function findNonStandardWords(entities: Entity[], dict: StandardizationDictionary): NonStandardWordUsage[] {
  const map = new Map<string, Set<string>>();
  const add = (words: string[], where: string) =>
    words.forEach((w) => {
      if (!map.has(w)) map.set(w, new Set());
      map.get(w)!.add(where);
    });
  entities.forEach((e) => {
    if (!e?.name) return;
    if (!e.physicalName) add(translateLogicalName(e.name, dict).nonStandardWords, e.name);
    (e.attributes || []).forEach((a) => {
      if (a?.name && !a.physicalName) add(translateLogicalName(a.name, dict).nonStandardWords, `${e.name}.${a.name}`);
    });
  });
  return [...map.entries()]
    .map(([word, set]) => ({ word, usedIn: [...set] }))
    .sort((a, b) => b.usedIn.length - a.usedIn.length || a.word.localeCompare(b.word));
}
