import { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  BookOpen, 
  FileText, 
  Hash, 
  Database,
  HelpCircle,
  ShieldCheck,
  AlertCircle,
  Check
} from 'lucide-react';
import {
  getDictionary,
  saveDictionary,
  translateLogicalName,
  resolveDataType
} from '../services/dictionaryStorage.js';
import type {
  StandardizationDictionary,
  StandardDomain,
  StandardWord,
  StandardTerm,
  CodeValue
} from '../services/dictionaryStorage.js';
import type { LogicalModel } from '@barker-modeler/model-core';

interface DictionaryManagerProps {
  model: LogicalModel;
  onClose: () => void;
}

export default function DictionaryManager({ model, onClose }: DictionaryManagerProps) {
  const [dict, setDict] = useState<StandardizationDictionary>(() => getDictionary());
  const [activeSubTab, setActiveSubTab] = useState<'domain' | 'word' | 'term' | 'code' | 'audit'>('audit');
  
  // Audit and inline action states
  const [quickAbbrs, setQuickAbbrs] = useState<Record<string, string>>({});
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'unregistered' | 'standardized'>('all');

  const handleQuickAddWord = (korean: string) => {
    const abbr = quickAbbrs[korean]?.trim().toUpperCase();
    if (!abbr) {
      alert('영문 약어를 입력해 주세요.');
      return;
    }
    const updated = {
      ...dict,
      words: [...dict.words, { logicalName: korean, physicalAbbr: abbr }]
    };
    handleSave(updated);
    setQuickAbbrs(prev => {
      const copy = { ...prev };
      delete copy[korean];
      return copy;
    });
  };

  const handleQuickAddTerm = (logicalName: string, defaultPhys: string) => {
    const physical = prompt(`"${logicalName}" 용어의 고정 표준 영문명을 입력하세요:`, defaultPhys);
    if (!physical) return;
    const normalizedPhys = physical.trim().toUpperCase();
    if (dict.terms.some(t => t.logicalName === logicalName)) {
      alert('이미 존재하는 용어명입니다.');
      return;
    }
    const updated = {
      ...dict,
      terms: [...dict.terms, { logicalName, physicalName: normalizedPhys }]
    };
    handleSave(updated);
  };

  // State for interactive word segmentation & abbreviation editor
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [segmentationText, setSegmentationText] = useState('');
  const [wordAbbrs, setWordAbbrs] = useState<Record<string, string>>({});

  // Active token being audited/edited in the guide popup
  const [activeAuditToken, setActiveAuditToken] = useState<{
    logicalName: string;
    tokenIndex: number;
    tokens: any[];
  } | null>(null);
  const [mergeAbbr, setMergeAbbr] = useState('');
  const [editSingleAbbr, setEditSingleAbbr] = useState('');

  const currentEditWords = useMemo(() => {
    if (!segmentationText) return [];
    return segmentationText.trim().split(/\s+/).filter(Boolean);
  }, [segmentationText]);



  const handleMergeAdjacentWords = (word1: string, word2: string, abbreviation: string) => {
    const combinedWord = word1 + word2;
    const abbr = abbreviation.trim().toUpperCase();
    if (!abbr) {
      alert('합친 단어의 영문 약어를 입력해 주세요.');
      return;
    }
    
    // Add to dict.words
    const updated = {
      ...dict,
      words: [...dict.words, { logicalName: combinedWord, physicalAbbr: abbr }]
    };
    handleSave(updated);
    setActiveAuditToken(null);
    alert(`합성어 "${combinedWord}"가 "${abbr}"(으)로 사전에 새로 등록되었습니다!`);
  };

  const handleSaveSingleAbbrFromPopup = (word: string, abbreviation: string) => {
    const abbr = abbreviation.trim().toUpperCase();
    if (!abbr) {
      alert('약어를 입력해 주세요.');
      return;
    }
    const existingIdx = dict.words.findIndex(w => w.logicalName === word);
    let updatedWords = [...dict.words];
    if (existingIdx !== -1) {
      updatedWords[existingIdx] = { logicalName: word, physicalAbbr: abbr };
    } else {
      updatedWords.push({ logicalName: word, physicalAbbr: abbr });
    }
    const updated = {
      ...dict,
      words: updatedWords
    };
    handleSave(updated);
    setActiveAuditToken(null);
  };

  const handleStartEditSegmentation = (idx: number, _logicalName: string, tokens: any[]) => {
    setEditingIndex(idx);
    const text = tokens.map(t => t.text).join(' ');
    setSegmentationText(text);
    
    const abbrs: Record<string, string> = {};
    tokens.forEach(t => {
      abbrs[t.text] = t.abbr || '';
    });
    setWordAbbrs(abbrs);
  };

  const handleSaveSegmentation = (originalLogicalName: string) => {
    const words = segmentationText.trim().split(/\s+/).filter(Boolean);
    if (words.join('') !== originalLogicalName) {
      alert(`단어들의 글자 합이 원래 명칭("${originalLogicalName}")과 일치해야 합니다.`);
      return;
    }

    // Check that every word has an abbreviation
    for (const w of words) {
      const abbr = wordAbbrs[w]?.trim();
      if (!abbr) {
        alert(`"${w}" 단어의 영문 약어를 입력해 주세요.`);
        return;
      }
    }

    // Update standard words dictionary
    let updatedWords = [...dict.words];
    words.forEach(w => {
      const abbr = wordAbbrs[w].trim().toUpperCase();
      const existingIdx = updatedWords.findIndex(item => item.logicalName === w);
      if (existingIdx !== -1) {
        updatedWords[existingIdx] = { logicalName: w, physicalAbbr: abbr };
      } else {
        updatedWords.push({ logicalName: w, physicalAbbr: abbr });
      }
    });

    const updated = {
      ...dict,
      words: updatedWords
    };
    handleSave(updated);
    setEditingIndex(null);
  };

  // Forms states
  const [newDomain, setNewDomain] = useState<StandardDomain>({ logicalName: '', dataTypeOracle: '', dataTypePostgres: '', dataTypeMysql: '' });
  const [newWord, setNewWord] = useState<StandardWord>({ logicalName: '', physicalAbbr: '' });
  const [newTerm, setNewTerm] = useState<StandardTerm>({ logicalName: '', physicalName: '' });
  const [newCodeName, setNewCodeName] = useState('');
  
  // Code values states
  const [selectedCodeName, setSelectedCodeName] = useState<string | null>(null);
  const [newCodeValue, setNewCodeValue] = useState<CodeValue>({ value: '', label: '' });

  // Word translation helper preview in Terms tab
  const [previewKorean, setPreviewKorean] = useState('');
  const [previewEnglish, setPreviewEnglish] = useState('');

  useEffect(() => {
    if (previewKorean) {
      const res = translateLogicalName(previewKorean, dict, 'UPPER');
      setPreviewEnglish(res.physicalName);
    } else {
      setPreviewEnglish('');
    }
  }, [previewKorean, dict]);

  const handleSave = (updatedDict: StandardizationDictionary) => {
    setDict(updatedDict);
    saveDictionary(updatedDict);
  };

  // Extract all model entities & attributes for standardization audit
  const auditItems = useMemo(() => {
    if (!model || !model.entities) return [];
    
    interface AuditItem {
      logicalName: string;
      type: 'entity' | 'attribute';
      entityContext?: string;
      domain?: string;
    }

    const list: AuditItem[] = [];

    model.entities.forEach(ent => {
      // 1. Add entity name
      list.push({
        logicalName: ent.name,
        type: 'entity'
      });

      // 2. Add attributes
      ent.attributes.forEach(attr => {
        list.push({
          logicalName: attr.name,
          type: 'attribute',
          entityContext: ent.name,
          domain: attr.domain
        });
      });
    });

    return list;
  }, [model]);

  // Calculate compliance statistics
  const auditStats = useMemo(() => {
    if (auditItems.length === 0) return { total: 0, complianceRate: 100, okCount: 0, failCount: 0 };
    
    let okCount = 0;
    auditItems.forEach(item => {
      const res = translateLogicalName(item.logicalName, dict, 'UPPER');
      if (!res.hasNonStandard) {
        okCount++;
      }
    });

    const failCount = auditItems.length - okCount;
    const complianceRate = Math.round((okCount / auditItems.length) * 100);

    return {
      total: auditItems.length,
      complianceRate,
      okCount,
      failCount
    };
  }, [auditItems, dict]);

  // 1. Domains CRUD
  const addDomain = () => {
    if (!newDomain.logicalName || !newDomain.dataTypeOracle || !newDomain.dataTypePostgres || !newDomain.dataTypeMysql) {
      alert('모든 타입을 채워주세요.');
      return;
    }
    if (dict.domains.some(d => d.logicalName === newDomain.logicalName)) {
      alert('이미 존재하는 도메인 이름입니다.');
      return;
    }
    const updated = {
      ...dict,
      domains: [...dict.domains, { ...newDomain }]
    };
    handleSave(updated);
    setNewDomain({ logicalName: '', dataTypeOracle: '', dataTypePostgres: '', dataTypeMysql: '' });
  };

  const deleteDomain = (logicalName: string) => {
    const updated = {
      ...dict,
      domains: dict.domains.filter(d => d.logicalName !== logicalName)
    };
    handleSave(updated);
  };

  // 2. Words CRUD
  const addWord = () => {
    if (!newWord.logicalName || !newWord.physicalAbbr) {
      alert('단어 한글명과 영문 약어를 채워주세요.');
      return;
    }
    const normalizedWord = newWord.logicalName.trim();
    const normalizedAbbr = newWord.physicalAbbr.trim().toUpperCase();

    if (dict.words.some(w => w.logicalName === normalizedWord)) {
      alert('이미 존재하는 한글 단어입니다.');
      return;
    }
    const updated = {
      ...dict,
      words: [...dict.words, { logicalName: normalizedWord, physicalAbbr: normalizedAbbr }]
    };
    handleSave(updated);
    setNewWord({ logicalName: '', physicalAbbr: '' });
  };

  const deleteWord = (logicalName: string) => {
    const updated = {
      ...dict,
      words: dict.words.filter(w => w.logicalName !== logicalName)
    };
    handleSave(updated);
  };

  // 3. Terms CRUD
  const addTerm = () => {
    if (!newTerm.logicalName || !newTerm.physicalName) {
      alert('한글 용어명과 영문 컬럼명을 채워주세요.');
      return;
    }
    const normalizedTerm = newTerm.logicalName.trim();
    const normalizedPhysical = newTerm.physicalName.trim().toUpperCase();

    if (dict.terms.some(t => t.logicalName === normalizedTerm)) {
      alert('이미 존재하는 한글 용어입니다.');
      return;
    }
    const updated = {
      ...dict,
      terms: [...dict.terms, { logicalName: normalizedTerm, physicalName: normalizedPhysical }]
    };
    handleSave(updated);
    setNewTerm({ logicalName: '', physicalName: '' });
  };

  const deleteTerm = (logicalName: string) => {
    const updated = {
      ...dict,
      terms: dict.terms.filter(t => t.logicalName !== logicalName)
    };
    handleSave(updated);
  };

  const autoGenerateTermPhysicalName = () => {
    if (!newTerm.logicalName) return;
    const res = translateLogicalName(newTerm.logicalName, dict, 'UPPER');
    setNewTerm(prev => ({ ...prev, physicalName: res.physicalName }));
  };

  // 4. Codes CRUD
  const addCode = () => {
    if (!newCodeName) return;
    if (dict.codes.some(c => c.logicalName === newCodeName)) {
      alert('이미 존재하는 코드명입니다.');
      return;
    }
    const updated: StandardizationDictionary = {
      ...dict,
      codes: [...dict.codes, { logicalName: newCodeName, values: [] }]
    };
    handleSave(updated);
    setSelectedCodeName(newCodeName);
    setNewCodeName('');
  };

  const deleteCode = (logicalName: string) => {
    const updated = {
      ...dict,
      codes: dict.codes.filter(c => c.logicalName !== logicalName)
    };
    handleSave(updated);
    if (selectedCodeName === logicalName) {
      setSelectedCodeName(null);
    }
  };

  const addCodeValue = () => {
    if (!selectedCodeName || !newCodeValue.value || !newCodeValue.label) return;
    const updated = {
      ...dict,
      codes: dict.codes.map(c => {
        if (c.logicalName === selectedCodeName) {
          if (c.values.some(v => v.value === newCodeValue.value)) {
            alert('이미 존재하는 코드값입니다.');
            return c;
          }
          return { ...c, values: [...c.values, { ...newCodeValue }] };
        }
        return c;
      })
    };
    handleSave(updated);
    setNewCodeValue({ value: '', label: '' });
  };

  const deleteCodeValue = (codeVal: string) => {
    if (!selectedCodeName) return;
    const updated = {
      ...dict,
      codes: dict.codes.map(c => {
        if (c.logicalName === selectedCodeName) {
          return { ...c, values: c.values.filter(v => v.value !== codeVal) };
        }
        return c;
      })
    };
    handleSave(updated);
  };

  // 5. File Backup Import/Export
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(dict, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mins_standardization_dictionary.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.domains && parsed.words && parsed.terms && parsed.codes) {
          handleSave(parsed);
          alert('표준화 사전을 성공적으로 업로드하여 적용했습니다!');
        } else {
          alert('잘못된 표준화 사전 JSON 파일 형식입니다.');
        }
      } catch (err: any) {
        alert(`가져오기 중 오류가 발생했습니다: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div 
        className="modal-content" 
        style={{ 
          width: '90%', 
          maxWidth: '1000px', 
          height: '85vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '24px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={24} className="text-blue-500" />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>데이터 표준화 사전 관리 (Standardization Dictionary)</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleExportJson}>
              <Download size={14} /> Export Backup
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Import Backup
              <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
            </label>
            <button className="btn btn-primary" onClick={onClose}>닫기 (Close)</button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="tabs-bar" style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
          <button 
            className={`tab-btn ${activeSubTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audit')}
            style={{ border: '1px solid var(--accent-color)', color: activeSubTab === 'audit' ? '#fff' : 'var(--accent-color)' }}
          >
            <ShieldCheck size={14} /> 모델 표준 검사 (Audit)
          </button>
          <button 
            className={`tab-btn ${activeSubTab === 'word' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('word')}
          >
            <BookOpen size={14} /> 표준 단어 ({dict.words.length})
          </button>
          <button 
            className={`tab-btn ${activeSubTab === 'term' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('term')}
          >
            <FileText size={14} /> 표준 용어 ({dict.terms.length})
          </button>
          <button 
            className={`tab-btn ${activeSubTab === 'domain' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('domain')}
          >
            <Database size={14} /> 표준 도메인 ({dict.domains.length})
          </button>
          <button 
            className={`tab-btn ${activeSubTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('code')}
          >
            <Hash size={14} /> 표준 코드 ({dict.codes.length})
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* TAB 0: MODEL AUDIT DASHBOARD */}
          {activeSubTab === 'audit' && (
            <div>
              {/* Summary Statistics Widgets */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>전체 검사 대상</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginTop: '4px' }}>{auditStats.total}개</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} className="text-green-500" /> 표준 준수 통과
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginTop: '4px', color: 'rgb(34, 197, 94)' }}>{auditStats.okCount}개</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} className="text-yellow-500" /> 미등록 단어 발견
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--warning)' }}>{auditStats.failCount}개</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--accent-color)', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>표준 준수도</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{auditStats.complianceRate}%</div>
                </div>
              </div>

              {/* Filtering & Search Bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="명칭 또는 소속 엔터티 검색..." 
                  style={{ flex: 1 }}
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
                <select 
                  className="form-control" 
                  style={{ width: '180px' }}
                  value={auditFilter}
                  onChange={e => setAuditFilter(e.target.value as any)}
                >
                  <option value="all">전체 목록 보기</option>
                  <option value="unregistered">미등록 단어만 보기</option>
                  <option value="standardized">준수 완료만 보기</option>
                </select>
              </div>

              {/* Audit List Table */}
              <table className="attribute-edit-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>구분</th>
                    <th style={{ width: '180px' }}>논리 한글명</th>
                    <th style={{ width: '180px' }}>도메인 / 물리타입</th>
                    <th style={{ width: '180px' }}>물리 영문명 (유도)</th>
                    <th>단어 분절 분석</th>
                    <th style={{ width: '220px' }}>표준화 조치</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.filter(item => {
                    const matchesSearch = item.logicalName.toLowerCase().includes(auditSearch.toLowerCase()) ||
                      (item.entityContext && item.entityContext.toLowerCase().includes(auditSearch.toLowerCase()));
                    if (!matchesSearch) return false;

                    const res = translateLogicalName(item.logicalName, dict, 'UPPER');
                    if (auditFilter === 'unregistered') return res.hasNonStandard;
                    if (auditFilter === 'standardized') return !res.hasNonStandard;
                    return true;
                  }).map((item, idx) => {
                    const res = translateLogicalName(item.logicalName, dict, 'UPPER');
                    const isAttr = item.type === 'attribute';
                    const inferredType = isAttr ? resolveDataType(item.domain, item.logicalName, 'ORACLE', dict) : '';

                    return (
                      <Fragment key={idx}>
                        <tr style={{ opacity: res.hasNonStandard ? 1 : 0.85 }}>
                        <td>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            backgroundColor: isAttr ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                            color: isAttr ? 'rgb(59, 130, 246)' : 'rgb(139, 92, 246)',
                            fontWeight: 'bold',
                            border: isAttr ? '1px solid rgb(59, 130, 246)' : '1px solid rgb(139, 92, 246)'
                          }}>
                            {isAttr ? '속성' : '엔터티'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{item.logicalName}</div>
                          {item.entityContext && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              소속: {item.entityContext}
                            </div>
                          )}
                        </td>
                        <td>
                          {isAttr ? (
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.domain || '(도메인 미지정)'}</div>
                              <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>{inferredType}</code>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>
                        <td>
                          <code style={{ 
                            color: res.hasNonStandard ? 'var(--warning)' : 'var(--accent-color)', 
                            fontWeight: 'bold',
                            fontSize: '0.85rem'
                          }}>
                            {res.physicalName}
                          </code>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            {res.tokens.map((tok, tIdx) => (
                              <span 
                                key={tIdx} 
                                onClick={() => {
                                  setActiveAuditToken({
                                    logicalName: item.logicalName,
                                    tokenIndex: tIdx,
                                    tokens: res.tokens
                                  });
                                  setMergeAbbr('');
                                  setEditSingleAbbr(tok.abbr || '');
                                }}
                                title="클릭하여 약어 수정 또는 인접 단어와 합치기"
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: tok.standard ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  border: tok.standard ? '1px solid rgba(34, 197, 94, 0.4)' : '1px dashed rgba(239, 68, 68, 0.5)',
                                  color: tok.standard ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                                  fontWeight: tok.standard ? 'bold' : 'normal',
                                  cursor: 'pointer'
                                }}
                              >
                                {tok.text}{tok.abbr ? ` [${tok.abbr}]` : ''}
                              </span>
                            ))}
                            <button 
                              className="btn" 
                              style={{ 
                                height: '20px', 
                                padding: '0 4px', 
                                fontSize: '0.65rem', 
                                marginLeft: '8px',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)'
                              }}
                              title="단어 분절 경계 편집 (합치기 / 나누기)"
                              onClick={() => handleStartEditSegmentation(idx, item.logicalName, res.tokens)}
                            >
                              분절 편집
                            </button>
                          </div>
                        </td>
                        <td>
                          {res.hasNonStandard ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {res.nonStandardWords.map((w, wIdx) => (
                                <div key={wIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--warning)', minWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w}>
                                    {w}:
                                  </span>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    style={{ width: '70px', height: '24px', fontSize: '0.75rem', padding: '2px 4px' }}
                                    placeholder="약어"
                                    value={quickAbbrs[w] || ''}
                                    onChange={e => setQuickAbbrs(prev => ({ ...prev, [w]: e.target.value }))}
                                  />
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ height: '24px', padding: '0 6px', fontSize: '0.75rem', minWidth: '40px' }}
                                    onClick={() => handleQuickAddWord(w)}
                                  >
                                    등록
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgb(34, 197, 94)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                <Check size={14} /> 준수 완료
                              </span>
                              <button 
                                className="btn" 
                                style={{ height: '22px', padding: '0 6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}
                                title="표준 용어로 직접 강제 매핑 등록"
                                onClick={() => handleQuickAddTerm(item.logicalName, res.physicalName)}
                              >
                                예외 등록
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {editingIndex === idx && (
                        <tr key={`edit-${idx}`}>
                          <td colSpan={6} style={{ backgroundColor: 'rgba(255,255,255,0.01)', padding: '16px', borderLeft: '3px solid var(--accent-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                  1. 단어 분리 띄어쓰기 편집 (공백으로 단어를 나누거나 합치세요):
                                </label>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  style={{ width: '100%', maxWidth: '400px' }}
                                  value={segmentationText}
                                  onChange={e => setSegmentationText(e.target.value)}
                                  placeholder="예: 신청자 구분 코드"
                                />
                                <span style={{ fontSize: '0.75rem', color: currentEditWords.join('') === item.logicalName ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)', fontWeight: 'bold' }}>
                                  {currentEditWords.join('') === item.logicalName 
                                    ? '✓ 단어들의 합이 원래 한글명과 일치합니다.' 
                                    : `✗ 원래 명칭("${item.logicalName}")과 글자 수가 일치하지 않습니다. (글자합: "${currentEditWords.join('')}")`}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                  2. 각 분절 단어의 영문 약어 지정:
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                  {currentEditWords.map((word, wIdx) => {
                                    if (!word) return null;
                                    return (
                                      <div key={wIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: 'var(--bg-sidebar)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{word}:</span>
                                        <input 
                                          type="text" 
                                          className="form-control" 
                                          style={{ width: '70px', height: '24px', fontSize: '0.8rem', padding: '2px 4px' }}
                                          placeholder="약어"
                                          value={wordAbbrs[word] || ''}
                                          onChange={e => setWordAbbrs(prev => ({ ...prev, [word]: e.target.value }))}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                  disabled={currentEditWords.join('') !== item.logicalName}
                                  onClick={() => handleSaveSegmentation(item.logicalName)}
                                >
                                  저장 및 사전 갱신
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                  onClick={() => setEditingIndex(null)}
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 1: WORDS */}
          {activeSubTab === 'word' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-sidebar)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="한글 단어 (예: 이용자)" 
                  value={newWord.logicalName}
                  onChange={e => setNewWord(prev => ({ ...prev, logicalName: e.target.value }))}
                />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="영문 약어 (예: USR)" 
                  value={newWord.physicalAbbr}
                  onChange={e => setNewWord(prev => ({ ...prev, physicalAbbr: e.target.value }))}
                />
                <button className="btn btn-primary" onClick={addWord} style={{ whiteSpace: 'nowrap' }}>
                  <Plus size={16} /> 단어 추가
                </button>
              </div>

              <table className="attribute-edit-table" style={{ marginTop: '0px' }}>
                <thead>
                  <tr>
                    <th>한글 단어명 (Logical Word)</th>
                    <th>영문 물리 약어 (Physical Abbr)</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dict.words].reverse().map((w, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{w.logicalName}</td>
                      <td><code style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{w.physicalAbbr}</code></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)', padding: '4px' }}
                          onClick={() => deleteWord(w.logicalName)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: TERMS */}
          {activeSubTab === 'term' && (
            <div>
              {/* Word Parser Helper tool */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--accent-color)', alignItems: 'center' }}>
                <HelpCircle size={16} className="text-blue-500" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>영문명 추천 시험기:</span>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ width: '220px' }} 
                  placeholder="한글 용어를 적어보세요..." 
                  value={previewKorean}
                  onChange={e => setPreviewKorean(e.target.value)}
                />
                {previewEnglish && (
                  <span style={{ fontSize: '0.85rem' }}>
                    유도된 물리명: <code style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{previewEnglish}</code>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-sidebar)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="한글 용어명 (예: 이용자구분코드)" 
                  value={newTerm.logicalName}
                  onChange={e => setNewTerm(prev => ({ ...prev, logicalName: e.target.value }))}
                />
                <button className="btn btn-secondary" onClick={autoGenerateTermPhysicalName} style={{ whiteSpace: 'nowrap' }} disabled={!newTerm.logicalName}>
                  영문명 자동추천
                </button>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="영문 물리 용어명 (예: USR_DIV_CD)" 
                  value={newTerm.physicalName}
                  onChange={e => setNewTerm(prev => ({ ...prev, physicalName: e.target.value }))}
                />
                <button className="btn btn-primary" onClick={addTerm} style={{ whiteSpace: 'nowrap' }}>
                  <Plus size={16} /> 용어 추가
                </button>
              </div>

              <table className="attribute-edit-table">
                <thead>
                  <tr>
                    <th>한글 용어명 (Logical Term)</th>
                    <th>영문 물리 용어명 (Physical Column)</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dict.terms].reverse().map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{t.logicalName}</td>
                      <td><code style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{t.physicalName}</code></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)', padding: '4px' }}
                          onClick={() => deleteTerm(t.logicalName)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: DOMAINS */}
          {activeSubTab === 'domain' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-sidebar)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="도메인 명칭 (예: 번호)" 
                    value={newDomain.logicalName}
                    onChange={e => setNewDomain(prev => ({ ...prev, logicalName: e.target.value }))}
                  />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Oracle Type (예: NUMBER(10))" 
                    value={newDomain.dataTypeOracle}
                    onChange={e => setNewDomain(prev => ({ ...prev, dataTypeOracle: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Postgres Type (예: INTEGER)" 
                    value={newDomain.dataTypePostgres}
                    onChange={e => setNewDomain(prev => ({ ...prev, dataTypePostgres: e.target.value }))}
                  />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="MySQL Type (예: INT)" 
                    value={newDomain.dataTypeMysql}
                    onChange={e => setNewDomain(prev => ({ ...prev, dataTypeMysql: e.target.value }))}
                  />
                  <button className="btn btn-primary" onClick={addDomain} style={{ whiteSpace: 'nowrap', width: '130px' }}>
                    <Plus size={16} /> 도메인 추가
                  </button>
                </div>
              </div>

              <table className="attribute-edit-table">
                <thead>
                  <tr>
                    <th>도메인 명 (Domain)</th>
                    <th>Oracle Type</th>
                    <th>Postgres Type</th>
                    <th>MySQL Type</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dict.domains].reverse().map((d, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{d.logicalName}</td>
                      <td><code>{d.dataTypeOracle}</code></td>
                      <td><code>{d.dataTypePostgres}</code></td>
                      <td><code>{d.dataTypeMysql}</code></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)', padding: '4px' }}
                          onClick={() => deleteDomain(d.logicalName)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: CODES */}
          {activeSubTab === 'code' && (
            <div style={{ display: 'flex', gap: '20px', minHeight: '300px' }}>
              {/* Left Column: Code list */}
              <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>코드 그룹 목록</h4>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="코드 속성명 (예: 이용자구분코드)" 
                    value={newCodeName}
                    onChange={e => setNewCodeName(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={addCode} style={{ whiteSpace: 'nowrap' }}>
                    추가
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {dict.codes.map((c, index) => (
                    <div 
                      key={index} 
                      onClick={() => setSelectedCodeName(c.logicalName)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 12px', 
                        backgroundColor: selectedCodeName === c.logicalName ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: selectedCodeName === c.logicalName ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.logicalName}</span>
                      <button 
                        className="btn btn-icon" 
                        style={{ color: 'var(--danger)', padding: '2px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCode(c.logicalName);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Code Values */}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  {selectedCodeName ? `"${selectedCodeName}"의 분류값 설정` : '왼쪽 리스트에서 코드를 선택해 주세요.'}
                </h4>
                {selectedCodeName && (
                  <>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', backgroundColor: 'var(--bg-sidebar)', padding: '8px', borderRadius: '6px' }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="코드값 (예: 01)" 
                        style={{ width: '100px' }}
                        value={newCodeValue.value}
                        onChange={e => setNewCodeValue(prev => ({ ...prev, value: e.target.value }))}
                      />
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="코드 라벨 (예: 일반회원)" 
                        value={newCodeValue.label}
                        onChange={e => setNewCodeValue(prev => ({ ...prev, label: e.target.value }))}
                      />
                      <button className="btn btn-primary" onClick={addCodeValue} style={{ whiteSpace: 'nowrap' }}>
                        추가
                      </button>
                    </div>

                    <table className="attribute-edit-table">
                      <thead>
                        <tr>
                          <th>물리 코드값 (Value)</th>
                          <th>논리 한글명 (Label)</th>
                          <th style={{ width: '60px', textAlign: 'center' }}>삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dict.codes.find(c => c.logicalName === selectedCodeName)?.values.map((v, index) => (
                          <tr key={index}>
                            <td style={{ fontWeight: 'bold' }}><code>{v.value}</code></td>
                            <td>{v.label}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className="btn btn-icon" 
                                style={{ color: 'var(--danger)', padding: '2px' }}
                                onClick={() => deleteCodeValue(v.value)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}

        {/* Word Merge & Abbreviation Edit Guideline Modal */}
        {activeAuditToken && (() => {
          const tokIndex = activeAuditToken.tokenIndex;
          const tokens = activeAuditToken.tokens;
          const tok = tokens[tokIndex];
          const prevTok = tokIndex > 0 ? tokens[tokIndex - 1] : null;
          const nextTok = tokIndex < tokens.length - 1 ? tokens[tokIndex + 1] : null;

          return (
            <div className="modal-overlay" style={{ zIndex: 120 }}>
              <div className="modal-content" style={{ width: '450px', padding: '20px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 'bold' }}>단어 정비 및 합성어 합치기</h3>
                  <button className="btn" style={{ padding: '2px 6px' }} onClick={() => setActiveAuditToken(null)}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 1. Edit current single abbreviation */}
                  <div style={{ backgroundColor: 'var(--bg-sidebar)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                      1. "{tok.text}" 단어 약어 수정/등록
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ fontSize: '0.85rem' }}
                        placeholder="영문 약어 입력" 
                        value={editSingleAbbr}
                        onChange={e => setEditSingleAbbr(e.target.value)}
                      />
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleSaveSingleAbbrFromPopup(tok.text, editSingleAbbr)}
                      >
                        저장
                      </button>
                    </div>
                  </div>

                  {/* 2. Merge options if adjacent words exist */}
                  {(prevTok || nextTok) && (
                    <div style={{ backgroundColor: 'var(--bg-sidebar)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: 'var(--warning)' }}>
                        2. 접두사/접미사 합성명사 합치기 (단어 병합)
                      </label>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                        인접한 단어와 합쳐 하나의 표준 단어로 등록합니다. 합친 후 사용할 신규 약어를 기입하고 버튼을 누르세요.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ fontSize: '0.85rem' }}
                          placeholder="합산 단어의 영문 약어 (예: APPLIER)" 
                          value={mergeAbbr}
                          onChange={e => setMergeAbbr(e.target.value)}
                        />

                        {prevTok && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.8rem', justifyContent: 'center' }}
                            onClick={() => handleMergeAdjacentWords(prevTok.text, tok.text, mergeAbbr)}
                            disabled={!mergeAbbr}
                          >
                            "{prevTok.text}" + "{tok.text}" &rarr; "{prevTok.text + tok.text}"로 합치기
                          </button>
                        )}

                        {nextTok && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.8rem', justifyContent: 'center' }}
                            onClick={() => handleMergeAdjacentWords(tok.text, nextTok.text, mergeAbbr)}
                            disabled={!mergeAbbr}
                          >
                            "{tok.text}" + "{nextTok.text}" &rarr; "{tok.text + nextTok.text}"로 합치기
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <button className="btn" onClick={() => setActiveAuditToken(null)}>취소 (Close)</button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  </div>
  );
}
