import type {
  StandardDomain,
  StandardWord,
  StandardTerm,
  StandardCode,
  StandardizationDictionary,
} from '@barker-modeler/model-core';

export type { StandardDomain, StandardWord, StandardTerm, CodeValue, StandardCode, StandardizationDictionary, TokenResult, TranslationResult } from '@barker-modeler/model-core';
export { translateLogicalName, resolveDataType, parseStandards, serializeStandards, addStandardWords } from '@barker-modeler/model-core';

/**
 * Browser-local dictionary (localStorage). Only used as a starting point for new
 * projects and by the dictionary manager when no project is open — a project always
 * uses its own standards/*.yaml so its output never depends on browser state.
 */
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
