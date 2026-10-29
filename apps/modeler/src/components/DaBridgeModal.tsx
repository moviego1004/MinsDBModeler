import { useState, useRef } from 'react';
import { 
  FileCode2, 
  FileSpreadsheet, 
  Database, 
  Upload, 
  Download, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles
} from 'lucide-react';
import type { LogicalModel } from '@barker-modeler/model-core';
import { 
  parseDaXml, 
  exportDaXml, 
  importExcelXml, 
  exportExcelXml, 
  parseDdl 
} from '@barker-modeler/model-core';

interface DaBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: LogicalModel;
  onLoadModel: (model: LogicalModel, sourceName: string) => void;
}

export default function DaBridgeModal({
  isOpen,
  onClose,
  currentModel,
  onLoadModel,
}: DaBridgeModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const xmlInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const ddlInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Import DA# / ERwin XML
  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const model = parseDaXml(text);
        if (model.entities.length === 0) {
          throw new Error('선택한 XML에서 엔터티를 찾을 수 없습니다.');
        }
        onLoadModel(model, file.name);
        setImportStatus(`DA# XML "${file.name}" 로드 완료 (엔터티: ${model.entities.length}개, 관계: ${model.relationships.length}개)`);
      } catch (err: any) {
        setErrorMessage(`XML 가져오기 실패: ${err.message || String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 2. Import Excel Spreadsheet
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const model = importExcelXml(text);
        if (model.entities.length === 0) {
          throw new Error('선택한 Excel XML에서 유효한 테이블/컬럼 시트를 찾을 수 없습니다.');
        }
        onLoadModel(model, file.name);
        setImportStatus(`Excel 정의서 "${file.name}" 로드 완료 (엔터티: ${model.entities.length}개, 관계: ${model.relationships.length}개)`);
      } catch (err: any) {
        setErrorMessage(`Excel 정의서 가져오기 실패: ${err.message || String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3. Import DA# DDL with COMMENT ON
  const handleDdlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const model = parseDdl(text);
        if (model.entities.length === 0) {
          throw new Error('선택한 DDL 파일에서 CREATE TABLE 문을 찾을 수 없습니다.');
        }
        onLoadModel(model, file.name);
        setImportStatus(`DA# DDL "${file.name}" 로드 완료 (엔터티: ${model.entities.length}개, 코멘트 매핑 완료)`);
      } catch (err: any) {
        setErrorMessage(`DDL 가져오기 실패: ${err.message || String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. Export DA# 5 compatible ERwin XML
  const handleExportDaXml = () => {
    try {
      const xml = exportDaXml(currentModel);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (currentModel.subject_area || 'model').replace(/\s+/g, '_');
      a.download = `${safeName}_DA_Sharp_ERwin.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`내보내기 실패: ${err.message || String(err)}`);
    }
  };

  // 5. Export DA# compatible Excel Specification
  const handleExportExcel = () => {
    try {
      const xml = exportExcelXml(currentModel);
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (currentModel.subject_area || 'model').replace(/\s+/g, '_');
      a.download = `${safeName}_DA_Sharp_정의서.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`내보내기 실패: ${err.message || String(err)}`);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div 
        className="modal-content"
        style={{ 
          maxWidth: '680px', 
          width: '90%', 
          maxHeight: '85vh', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: '#6366f1' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>DA# 5 상호 운용 호환 브릿지</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                엔코아 DATAWARE™ DA# 5에서 생성한 모델을 불러와 편집하거나 DA# 5로 내보냅니다.
              </p>
            </div>
          </div>
          <button 
            className="btn btn-icon" 
            onClick={onClose}
            style={{ width: '28px', height: '28px', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
          <button
            onClick={() => setActiveTab('import')}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: activeTab === 'import' ? 'transparent' : 'rgba(0,0,0,0.02)',
              borderBottom: activeTab === 'import' ? '2px solid var(--accent-color)' : 'none',
              fontWeight: activeTab === 'import' ? 'bold' : 'normal',
              color: activeTab === 'import' ? 'var(--accent-color)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <Upload size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            DA# 모델 불러오기 (Import)
          </button>
          <button
            onClick={() => setActiveTab('export')}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: activeTab === 'export' ? 'transparent' : 'rgba(0,0,0,0.02)',
              borderBottom: activeTab === 'export' ? '2px solid var(--accent-color)' : 'none',
              fontWeight: activeTab === 'export' ? 'bold' : 'normal',
              color: activeTab === 'export' ? 'var(--accent-color)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <Download size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            DA# 호환 내보내기 (Export)
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {errorMessage && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 14px', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              borderRadius: '6px', 
              fontSize: '0.8rem', 
              marginBottom: '16px' 
            }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {importStatus && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 14px', 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              color: '#10b981', 
              borderRadius: '6px', 
              fontSize: '0.8rem', 
              marginBottom: '16px' 
            }}>
              <CheckCircle2 size={16} />
              <span>{importStatus}</span>
            </div>
          )}

          {activeTab === 'import' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Option 1: DA# / ERwin XML */}
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <FileCode2 size={18} style={{ color: '#3b82f6' }} />
                    <strong style={{ fontSize: '0.9rem' }}>DA# 5 / ERwin XML 불러오기 (.xml)</strong>
                    <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 'bold' }}>추천</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    DA# 5에서 [다른 이름으로 저장] → [Erwin (r7) XML 파일로 저장]한 XML 파일을 직접 읽어 엔터티, 속성, 관계선으로 복원합니다.
                  </p>
                </div>
                <div>
                  <input 
                    type="file" 
                    accept=".xml" 
                    ref={xmlInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleXmlUpload} 
                  />
                  <button 
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                    onClick={() => xmlInputRef.current?.click()}
                  >
                    XML 선택
                  </button>
                </div>
              </div>

              {/* Option 2: Excel Specification */}
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
                    <strong style={{ fontSize: '0.9rem' }}>DA# 엑셀 정의서 불러오기 (.xml / .xlsx)</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    DA# 파일 리버스 템플릿 또는 MinsDBModeler에서 생성한 테이블목록/컬럼정의서 엑셀 XML을 읽어와 모델로 역변환합니다.
                  </p>
                </div>
                <div>
                  <input 
                    type="file" 
                    accept=".xml,.xls" 
                    ref={excelInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleExcelUpload} 
                  />
                  <button 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                    onClick={() => excelInputRef.current?.click()}
                  >
                    엑셀 선택
                  </button>
                </div>
              </div>

              {/* Option 3: DA# DDL Script with Comments */}
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Database size={18} style={{ color: '#f59e0b' }} />
                    <strong style={{ fontSize: '0.9rem' }}>DA# DDL 스크립트 불러오기 (.sql / .ddl)</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    DA# Forward Engineering에서 생성된 Oracle/Tibero DDL의 COMMENT ON TABLE/COLUMN 구문을 파싱하여 한글 논리명까지 완벽 매핑합니다.
                  </p>
                </div>
                <div>
                  <input 
                    type="file" 
                    accept=".sql,.ddl,.txt" 
                    ref={ddlInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleDdlUpload} 
                  />
                  <button 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                    onClick={() => ddlInputRef.current?.click()}
                  >
                    DDL 선택
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Export 1: DA# ERwin XML */}
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: 'var(--bg-card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode2 size={20} style={{ color: '#3b82f6' }} />
                    <strong style={{ fontSize: '0.95rem' }}>DA# 5용 ERwin XML 파일 내보내기 (.xml)</strong>
                  </div>
                  <button 
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    onClick={handleExportDaXml}
                  >
                    <Download size={14} /> XML 저장
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  현재 모델의 엔터티, 논리/물리 컬럼, 주식별자, 외래키 관계를 DA# 5에서 열 수 있는 ERwin XML 규격으로 내보냅니다.
                  <br />
                  💡 <strong>DA# 5에서 열기:</strong> DA# 상단 [열기] → [ERWin 파일 가져오기 (.xml)] 메뉴를 통해 즉시 불러와 편집할 수 있습니다.
                </p>
              </div>

              {/* Export 2: DA# Excel Specification */}
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: 'var(--bg-card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSpreadsheet size={20} style={{ color: '#10b981' }} />
                    <strong style={{ fontSize: '0.95rem' }}>DA# 호환 엑셀 모델 정의서 (.xml)</strong>
                  </div>
                  <button 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    onClick={handleExportExcel}
                  >
                    <Download size={14} /> 엑셀 저장
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  테이블 목록, 컬럼 정의서, 관계 정의서가 포함된 스타일 서식 엑셀 XML 스프레드시트입니다.
                  DA#의 [파일 리버스] 기능 또는 타 분석가와의 문서 공유에 바로 활용됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} style={{ fontSize: '0.8rem', padding: '6px 16px' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
