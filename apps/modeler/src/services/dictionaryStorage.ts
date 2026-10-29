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

const DICTIONARY_STORAGE_KEY = 'mins_db_modeler_dictionary';

// Default Standardization Dictionary
const DEFAULT_DOMAINS: StandardDomain[] = [
  { logicalName: '번호', dataTypeOracle: 'NUMBER(10)', dataTypePostgres: 'INTEGER', dataTypeMysql: 'INT' },
  { logicalName: '일시', dataTypeOracle: 'TIMESTAMP', dataTypePostgres: 'TIMESTAMP', dataTypeMysql: 'DATETIME' },
  { logicalName: '구분', dataTypeOracle: 'VARCHAR2(10)', dataTypePostgres: 'VARCHAR(10)', dataTypeMysql: 'VARCHAR(10)' },
  { logicalName: '코드', dataTypeOracle: 'VARCHAR2(20)', dataTypePostgres: 'VARCHAR(20)', dataTypeMysql: 'VARCHAR(20)' },
  { logicalName: '여부', dataTypeOracle: 'CHAR(1)', dataTypePostgres: 'CHAR(1)', dataTypeMysql: 'CHAR(1)' },
  { logicalName: '이름', dataTypeOracle: 'VARCHAR2(100)', dataTypePostgres: 'VARCHAR(100)', dataTypeMysql: 'VARCHAR(100)' },
  { logicalName: '명', dataTypeOracle: 'VARCHAR2(100)', dataTypePostgres: 'VARCHAR(100)', dataTypeMysql: 'VARCHAR(100)' },
  { logicalName: '내용', dataTypeOracle: 'VARCHAR2(1000)', dataTypePostgres: 'VARCHAR(1000)', dataTypeMysql: 'TEXT' },
  { logicalName: '설명', dataTypeOracle: 'VARCHAR2(1000)', dataTypePostgres: 'VARCHAR(1000)', dataTypeMysql: 'TEXT' },
  { logicalName: '일자', dataTypeOracle: 'DATE', dataTypePostgres: 'DATE', dataTypeMysql: 'DATE' },
  { logicalName: '금액', dataTypeOracle: 'NUMBER(15,2)', dataTypePostgres: 'NUMERIC(15,2)', dataTypeMysql: 'DECIMAL(15,2)' },
  { logicalName: '주소', dataTypeOracle: 'VARCHAR2(200)', dataTypePostgres: 'VARCHAR(200)', dataTypeMysql: 'VARCHAR(200)' },
  { logicalName: '전화번호', dataTypeOracle: 'VARCHAR2(20)', dataTypePostgres: 'VARCHAR(20)', dataTypeMysql: 'VARCHAR(20)' },
];

const DEFAULT_WORDS: StandardWord[] = [
  { logicalName: '이용자', physicalAbbr: 'USR' },
  { logicalName: '사용자', physicalAbbr: 'USR' },
  { logicalName: '신청', physicalAbbr: 'APPL' },
  { logicalName: '유형', physicalAbbr: 'TYP' },
  { logicalName: '구분', physicalAbbr: 'DIV' },
  { logicalName: '코드', physicalAbbr: 'CD' },
  { logicalName: '번호', physicalAbbr: 'NO' },
  { logicalName: '이력', physicalAbbr: 'HIST' },
  { logicalName: '상태', physicalAbbr: 'STAT' },
  { logicalName: '명', physicalAbbr: 'NM' },
  { logicalName: '이름', physicalAbbr: 'NM' },
  { logicalName: '사유', physicalAbbr: 'RSN' },
  { logicalName: '일시', physicalAbbr: 'DT' },
  { logicalName: '일자', physicalAbbr: 'DT' },
  { logicalName: '접수', physicalAbbr: 'RCV' },
  { logicalName: '완료', physicalAbbr: 'CMPL' },
  { logicalName: '반려', physicalAbbr: 'REJ' },
  { logicalName: '등록', physicalAbbr: 'REG' },
  { logicalName: '수정', physicalAbbr: 'MOD' },
  { logicalName: '비밀번호', physicalAbbr: 'PWD' },
  { logicalName: '해시', physicalAbbr: 'HASH' },
  { logicalName: '이메일', physicalAbbr: 'EMAIL' },
  { logicalName: '주소', physicalAbbr: 'ADDR' },
  { logicalName: '휴대폰', physicalAbbr: 'MP' },
  { logicalName: '최종', physicalAbbr: 'LST' },
  { logicalName: '로그인', physicalAbbr: 'LGIN' },
  { logicalName: '법인', physicalAbbr: 'CORP' },
  { logicalName: '회원', physicalAbbr: 'MBR' },
  { logicalName: '직원', physicalAbbr: 'EMP' },
  { logicalName: '가입', physicalAbbr: 'JOIN' },
  { logicalName: '동의', physicalAbbr: 'AGR' },
  { logicalName: '개인정보', physicalAbbr: 'PRIV' },
  { logicalName: '단계', physicalAbbr: 'STEP' },
  { logicalName: '선행', physicalAbbr: 'PREV' },
  { logicalName: '처리', physicalAbbr: 'PROC' },
  { logicalName: '담당자', physicalAbbr: 'PIC' },
  { logicalName: '결과', physicalAbbr: 'RST' },
  { logicalName: '자격증명', physicalAbbr: 'CRED' },
  { logicalName: '첨부', physicalAbbr: 'ATT' },
  { logicalName: '파일', physicalAbbr: 'FILE' },
  { logicalName: '경로', physicalAbbr: 'PATH' },
  { logicalName: '크기', physicalAbbr: 'SZ' },
  { logicalName: '삭제', physicalAbbr: 'DEL' },
  { logicalName: '생명주기', physicalAbbr: 'LC' },
  { logicalName: '연계', physicalAbbr: 'LNK' },
  { logicalName: '작업', physicalAbbr: 'TASK' },
  { logicalName: '식별자', physicalAbbr: 'ID' },
  { logicalName: '배지', physicalAbbr: 'BG' },
  { logicalName: '원문', physicalAbbr: 'ORIG' },
  { logicalName: '저장', physicalAbbr: 'STOR' },
  { logicalName: '정보', physicalAbbr: 'INFO' },
  { logicalName: '유형', physicalAbbr: 'TYP' },
  { logicalName: '상세', physicalAbbr: 'DET' },
  { logicalName: '대상', physicalAbbr: 'TGT' },
  { logicalName: '소속', physicalAbbr: 'DEPT' },
  { logicalName: '기존', physicalAbbr: 'OLD' },
  { logicalName: '수신자', physicalAbbr: 'RCVR' },
  { logicalName: '공식', physicalAbbr: 'OFFI' },
  { logicalName: '역할', physicalAbbr: 'ROLE' },
  { logicalName: '설명', physicalAbbr: 'DESC' },
  { logicalName: '업무', physicalAbbr: 'BIZ' },
  { logicalName: '위탁', physicalAbbr: 'CNSG' },
  { logicalName: '외부', physicalAbbr: 'EXT' },
  { logicalName: '내부', physicalAbbr: 'INT' },
  { logicalName: '시스템', physicalAbbr: 'SYS' },
  { logicalName: '기관', physicalAbbr: 'INST' },
  { logicalName: '운영', physicalAbbr: 'OPR' },
  { logicalName: '인증', physicalAbbr: 'AUTH' },
  { logicalName: '참조', physicalAbbr: 'REF' },
  { logicalName: '값', physicalAbbr: 'VAL' },
  { logicalName: '확인', physicalAbbr: 'CHK' },
  { logicalName: '주기', physicalAbbr: 'CYC' },
  { logicalName: '초수', physicalAbbr: 'SEC' },
  { logicalName: '여부', physicalAbbr: 'YN' },
  { logicalName: '시작', physicalAbbr: 'STRT' },
  { logicalName: '종료', physicalAbbr: 'END' },
  { logicalName: '생명주기', physicalAbbr: 'LC' },
];

const DEFAULT_TERMS: StandardTerm[] = [
  { logicalName: '이용자번호', physicalName: 'USR_NO' },
  { logicalName: '이용자구분코드', physicalName: 'USR_DIV_CD' },
  { logicalName: '신청번호', physicalName: 'APPL_NO' },
  { logicalName: '신청유형코드', physicalName: 'APPL_TYP_CD' },
  { logicalName: '신청상태코드', physicalName: 'APPL_STAT_CD' },
];

const DEFAULT_CODES: StandardCode[] = [
  {
    logicalName: '이용자구분코드',
    values: [
      { value: 'QVI', label: 'QVI직원' },
      { value: 'MBR', label: '회원' },
    ]
  },
  {
    logicalName: '신청유형코드',
    values: [
      { value: 'CORP', label: '법인vLEI발급신청' },
      { value: 'OOR', label: 'OOR발급신청' },
      { value: 'ECR', label: 'ECR발급신청' },
    ]
  }
];

export function getDictionary(): StandardizationDictionary {
  try {
    const data = localStorage.getItem(DICTIONARY_STORAGE_KEY);
    if (!data) {
      const initial: StandardizationDictionary = {
        domains: DEFAULT_DOMAINS,
        words: DEFAULT_WORDS,
        terms: DEFAULT_TERMS,
        codes: DEFAULT_CODES,
      };
      saveDictionary(initial);
      return initial;
    }
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed dictionary is not an object');
    }
    return {
      domains: Array.isArray(parsed.domains) ? parsed.domains : DEFAULT_DOMAINS,
      words: Array.isArray(parsed.words) ? parsed.words : DEFAULT_WORDS,
      terms: Array.isArray(parsed.terms) ? parsed.terms : DEFAULT_TERMS,
      codes: Array.isArray(parsed.codes) ? parsed.codes : DEFAULT_CODES,
    };
  } catch (e) {
    console.error('Failed to parse dictionary, using defaults', e);
    return {
      domains: DEFAULT_DOMAINS,
      words: DEFAULT_WORDS,
      terms: DEFAULT_TERMS,
      codes: DEFAULT_CODES,
    };
  }
}

export function saveDictionary(dict: StandardizationDictionary): void {
  try {
    localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify(dict));
  } catch (e) {
    console.error('Failed to save dictionary to localStorage', e);
  }
}

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

/**
 * Translates a logical name to a physical name based on standard words and terms.
 * Performs Greedy Longest-Match tokenization.
 */
export function translateLogicalName(
  logicalName: any,
  dict: StandardizationDictionary,
  caseType: 'UPPER' | 'CAMEL' = 'UPPER'
): TranslationResult {
  let nameStr = '';
  if (typeof logicalName === 'string') {
    nameStr = logicalName;
  } else if (logicalName && typeof logicalName === 'object') {
    nameStr = logicalName.name || JSON.stringify(logicalName);
  } else {
    nameStr = String(logicalName || '');
  }

  // 1. Check exact term dictionary match first
  const cleanTerms = (dict?.terms || []).filter(t => t && typeof t.logicalName === 'string');
  const exactMatch = cleanTerms.find(t => t.logicalName === nameStr);
  if (exactMatch) {
    let pName = exactMatch.physicalName || '';
    if (caseType === 'CAMEL') {
      pName = snakeToCamel(pName);
    }
    return {
      tokens: [{ text: nameStr, standard: true, abbr: exactMatch.physicalName }],
      physicalName: pName,
      hasNonStandard: false,
      nonStandardWords: [],
    };
  }

  // Sort words by length descending to ensure greedy longest-match
  const cleanWords = (dict?.words || []).filter(w => w && typeof w.logicalName === 'string');
  const sortedWords = [...cleanWords].sort((a, b) => (b.logicalName || '').length - (a.logicalName || '').length);

  const tokens: TokenResult[] = [];
  let remaining = nameStr;
  let nonStandardWordAccumulator = '';
  const nonStandardWords: string[] = [];

  while (remaining.length > 0) {
    let matched = false;

    for (const w of sortedWords) {
      if (remaining.startsWith(w.logicalName)) {
        // If we had accumulated non-standard characters, flush them
        if (nonStandardWordAccumulator.length > 0) {
          tokens.push({ text: nonStandardWordAccumulator, standard: false });
          nonStandardWords.push(nonStandardWordAccumulator);
          nonStandardWordAccumulator = '';
        }

        tokens.push({ text: w.logicalName, standard: true, abbr: w.physicalAbbr });
        remaining = remaining.substring(w.logicalName.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Accumulate 1 non-standard character
      nonStandardWordAccumulator += remaining[0];
      remaining = remaining.substring(1);
    }
  }

  // Flush any remaining non-standard accumulator
  if (nonStandardWordAccumulator.length > 0) {
    tokens.push({ text: nonStandardWordAccumulator, standard: false });
    nonStandardWords.push(nonStandardWordAccumulator);
  }

  const hasNonStandard = tokens.some(t => !t.standard);

  // Join abbreviations with underscore
  const abbrList = tokens.map(t => t.abbr || t.text.toUpperCase());
  let physicalName = abbrList.join('_');

  if (caseType === 'CAMEL') {
    physicalName = snakeToCamel(physicalName);
  } else {
    physicalName = physicalName.toUpperCase();
  }

  return {
    tokens,
    physicalName,
    hasNonStandard,
    nonStandardWords,
  };
}

/**
 * Resolves the physical data type based on domain name and database type.
 */
export function resolveDataType(
  domainName: string | undefined,
  attributeName: any,
  dbType: 'ORACLE' | 'POSTGRES' | 'MYSQL',
  dict: StandardizationDictionary
): string {
  // If domain is not specified, try to infer from attribute name suffix
  let inferredDomain = domainName;
  if (!inferredDomain) {
    const attrStr = typeof attributeName === 'string' ? attributeName : String(attributeName || '');
    if (attrStr.endsWith('번호') || attrStr.endsWith('ID') || attrStr.endsWith('Id') || attrStr.endsWith('Seq')) {
      inferredDomain = '번호';
    } else if (attrStr.endsWith('일시') || attrStr.endsWith('시간') || attrStr.endsWith('시각')) {
      inferredDomain = '일시';
    } else if (attrStr.endsWith('코드') || attrStr.endsWith('구분코드')) {
      inferredDomain = '코드';
    } else if (attrStr.endsWith('여부')) {
      inferredDomain = '여부';
    } else if (attrStr.endsWith('이름') || attrStr.endsWith('명')) {
      inferredDomain = '이름';
    } else if (attrStr.endsWith('내용') || attrStr.endsWith('설명') || attrStr.endsWith('비고')) {
      inferredDomain = '내용';
    } else if (attrStr.endsWith('일자') || attrStr.endsWith('날짜')) {
      inferredDomain = '일자';
    } else if (attributeName.endsWith('금액') || attributeName.endsWith('값') || attributeName.endsWith('수량')) {
      inferredDomain = '금액';
    } else {
      inferredDomain = '구분'; // Default fallback domain
    }
  }

  const domain = dict.domains.find(d => d.logicalName === inferredDomain);
  if (domain) {
    if (dbType === 'ORACLE') return domain.dataTypeOracle;
    if (dbType === 'POSTGRES') return domain.dataTypePostgres;
    if (dbType === 'MYSQL') return domain.dataTypeMysql;
  }

  // Ultimate defaults if domain not resolved
  if (dbType === 'ORACLE') return 'VARCHAR2(100)';
  if (dbType === 'POSTGRES') return 'VARCHAR(100)';
  return 'VARCHAR(100)';
}

function snakeToCamel(snake: string): string {
  return snake
    .toLowerCase()
    .split('_')
    .map((word, index) => {
      if (index === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}
