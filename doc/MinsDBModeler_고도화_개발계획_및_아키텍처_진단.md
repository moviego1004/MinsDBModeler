# MinsDBModeler 고도화 개발 계획 및 아키텍처 진단 보고서

> **작성일자:** 2026-10-29 (최종 갱신: 2026-10-30 — Phase 7 프로젝트 저장소 구조 전환)  
> **대상 프로젝트:** MinsDBModeler (Tauri + React + Konva + TypeScript)  
> **참조 벤치마크:** DATAWARE™ DA# 5 (Modeler, API, Reverse Architecture)

---

## 1. 아키텍처 진단 및 당면 과제 (Critical Diagnosis)

현재 MinsDBModeler는 Barker 표기법의 핵심인 '슈퍼타입 내 서브타입 박스 렌더링', 'YAML 양방향 편집', '기초 사전 관리 및 DDL 생성' 등 핵심 MVP 요건을 성공적으로 검증했습니다.  
그러나 **"주제영역 $\rightarrow$ 논리 모델 $\rightarrow$ 물리 모델 $\rightarrow$ SQL"**로 확장되는 엔터프라이즈 데이터 모델러로 진화하는 과정에서 다음과 같은 구조적 병목과 설계 한계에 직면해 있습니다.

### 1.1 YAML 저장 방식에 대한 타당성 검토

| 질문 | 진단 결과 | 상세 분석 및 해결 방향 |
| :--- | :---: | :--- |
| **"YAML로 저장하는 게 맞는 방향인가?"** | **방향은 맞으나, <br>현재 '통짜 단일 파일' 방식은 한계 도달** | • **장점:** Git 버전 관리(Diff/Merge), 텍스트 직접 편집, CI/CD 파이프라인 연계에 압도적으로 유리함.<br>• **문제점:** 현재는 단일 YAML 안에 `entities`, `relationships`, `rules`, 그리고 모든 다이어그램의 `x, y, width, height` 시각 좌표가 한데 섞여 있음.<br>$\rightarrow$ 엔터티 위치를 10px만 움직여도 Git Diff에 수십 줄의 변경이 생겨 비즈니스 모델 변경과 시각 변경이 뒤섞임.<br>$\rightarrow$ 모델 규모가 커지면 단일 파일이 수만 줄에 달해 에디터 렉 및 파싱 병목 유발.<br>• **해결책:** **"디렉터리 기반 멀티 파일 분리 구조"** 도입 (메타데이터와 다이어그램 좌표의 분리). |
| **"엔터티 참조 방식의 취약성"** | **심각한 위험 요소** | • 현재 관계선(`parent`, `child`)과 다이어그램 오브젝트(`modelRef`)가 엔터티의 '한글 이름(String)'을 외래키처럼 참조함.<br>• 사용자가 엔터티명을 수정하거나 오타를 고치는 순간 모든 관계선과 캔버스 좌표가 고아가 되어 깨짐.<br>• **해결책:** 불변 고유 식별자(`id: "ent_xxxx"`)를 메타데이터의 PK로 채택하고, 이름은 표시 속성으로 분리. |

---

### 1.2 다이어그램 렌더링(Konva) 코드 진단: "하드코딩과 if-else 문제"

사용자의 우려대로, 현재 [KonvaModelerCanvas.tsx](file:///D:/dev/MinsDBModeler/apps/modeler/src/components/KonvaModelerCanvas.tsx)는 **수많은 절차적 if-else와 하드코딩된 오프셋 계산**이 React 컴포넌트 렌더 루프 안에 인라인으로 작성되어 있습니다:

```typescript
// KonvaModelerCanvas.tsx 현재 라우팅 코드 발췌
if (Math.abs(dx) > Math.abs(dy)) {
  if (dx > 0) { ... } else { ... }
} else {
  if (dy > 0) { ... } else { ... }
}
if (sRight < tLeft) { ... } else if (tRight < sLeft) { ... } else { ... }
const lineOffset = (edgeIndex - edges.length / 2) * 10; // 임의의 10px 오프셋 하드코딩
```

#### 현재 방식의 한계
1. **노드 5개 이상 배치 시 충돌 및 선 겹침**: 장애물(다른 엔터티 노드) 회피 알고리즘이 없어 선이 다른 엔터티 몸통을 관통함.
2. **복잡도 증가 시 유지보수 불가**: 1:1, 1:N, N:M, 식별/비식별, 선택/필수 마커 각도 계산이 한 함수 안에 얽혀 있어 버그 발생률이 높음.
3. **해결책**:
   - `Canvas` 컴포넌트는 오직 '그리기(Drawing)'만 담당하는 Dumb 컴포넌트로 전환.
   - 선 경로 계산은 **`OrthogonalEdgeRouter` (격자 기반 직교 라우팅 엔진)** 순수 클래스로 분리.
   - 마커(까마귀발, 원, 바) 렌더링은 **`BarkerMarkerFactory`**로 캡슐화.

---

### 1.3 DA# 5와의 아키텍처 비교 분석

DA# 5는 20년 이상 대규모 전사 데이터 아키텍처(DA) 현장에서 검증된 엔터프라이즈 도구입니다. DA#의 객체 모델과 MinsDBModeler의 구조를 비교하면 명확한 설계 차이가 드러납니다.

```mermaid
graph TD
    subgraph DA_Sharp_5["DA# 5 아키텍처 (검증된 구조)"]
        D_App[Application / Repository] --> D_Proj[Project]
        D_Proj --> D_Model[Model: Logical & Physical Live-Linked]
        D_Model --> D_Meta[Meta Catalog: Entity / Table / Rel]
        D_Model --> D_Subj[Subject Areas & Diagram Panes]
        D_Subj -.->|참조 뷰| D_Meta
        D_Model --> D_Dict[Wordict 표준 사전]
    end

    subgraph Mins_Current["MinsDBModeler 현재 구조 (MVP 모놀리스)"]
        M_App[App.tsx (2,819줄 모놀리스)] --> M_State[단일 yamlText 문자열]
        M_State --> M_Parser[parser.ts]
        M_Parser --> M_Mixed[엔터티 + 물리 + 다이어그램좌표 혼합 객체]
    end
```

| 비교 항목 | DA# 5 (엔터프라이즈 표준) | MinsDBModeler 현재 상태 | 나아갈 방향 |
| :--- | :--- | :--- | :--- |
| **모델 계층** | 프로젝트 $\rightarrow$ 주제영역 $\rightarrow$ 다이어그램(Pane)의 명확한 다대다 뷰 분리 | 단일 모델 파일 중심 (다이어그램 탭이 단일 파일 종속) | **주제영역/다이어그램 뷰 분리**: 특정 엔터티를 여러 다이어그램에 배치 가능하도록 분리 |
| **논리-물리 연계** | 1개 논리 모델에 대해 여러 Target DBMS별 물리 모델이 **실시간 링크(Live-Link)**되어 컬럼/타입 동기화 추적 | `viewMode` 토글 또는 별도 파일로 복제 분리 (동기화 링크 끊김) | 논리 엔터티 $\leftrightarrow$ 물리 테이블 간 **매핑 메타데이터(Transform Mapping Ledger)** 보존 |
| **표준화 통합** | 속성 생성 시 실시간 단어/도메인 검증 및 물리명 자동 합성 | 별도 탭에서 수동 번역 및 저장 | 속성 인라인 입력 시 **자동완성 및 표준어 추천** 연동 |
| **상태 관리** | 내부 C++/C# 객체 계층 또는 SQLite 로컬 저장소 | React `useState` 기반 단일 거대 상태 | **Zustand 기반 정규화 스토어** (`useModelStore`, `useDiagramStore`) 도입 |

---

## 2. 권장 저장소 및 아키텍처 설계

### 2.1 Git 친화적 분할 저장 구조 (File System Architecture)

> **2026-10-30 갱신:** 아래 초안은 Phase 7에서 실제 폴더 저장 구조로 구현되었습니다. 확정된 레이아웃은 **Phase 7.1**을 따릅니다.

Git diff의 장점을 극대화하면서도 대규모 모델을 수용하기 위해, 단일 YAML 대신 **폴더 기반 모듈형 YAML 구조**를 채택합니다. (dbt, OpenAPI의 표준 방식과 동일)

```text
📁 .minsmodeler/ (또는 프로젝트 루트)
  ├── 📄 project.yaml                 # 프로젝트 메타, Target DBMS 설정, 활성 주제영역
  ├── 📁 dictionary/                   # 데이터 표준화 사전
  │    ├── words.yaml                 # 표준 단어
  │    ├── terms.yaml                 # 표준 용어
  │    ├── domains.yaml               # 표준 도메인
  │    └── codes.yaml                 # 표준 코드
  ├── 📁 logical/                      # [순수 비즈니스 메타데이터] (좌표 없음!)
  │    ├── entities/                  # 엔터티별 개별 정의 (Git Conflict 최소화)
  │    │    ├── ent_user.yaml
  │    │    ├── ent_account.yaml
  │    │    └── ent_order.yaml
  │    └── relationships.yaml         # 엔터티 간 관계 정의 (ID 기반)
  ├── 📁 physical/                     # [물리 스키마 매핑]
  │    ├── tables.yaml                # 테이블, 인덱스, 파티션 정의
  │    └── transforms.yaml            # 논리-물리 변환 규칙 (서브타입 통합/분할 전략 등)
  └── 📁 diagrams/                     # [시각적 뷰] (좌표, 라우팅 웨이포인트)
       ├── diag_core_user.yaml        # 주제영역 1 다이어그램
       └── diag_order_shipping.yaml   # 주제영역 2 다이어그램
```

* **효과 1**: 다이어그램에서 엔터티 위치를 옮기면 `diagrams/*.yaml`만 수정되어 Git 커밋이 명확해짐.
* **효과 2**: 여러 개발자가 서로 다른 엔터티를 작업할 때 충돌(Merge Conflict)이 원천 방지됨.
* **효과 3**: 단일 대형 프로젝트 내보내기/불러오기 시에는 하나의 ZIP 또는 통합 YAML로 번들링 지원.

---

### 2.2 캔버스 렌더링 파이프라인 분리 (Clean Rendering Architecture)

`KonvaModelerCanvas.tsx`의 절차적 if-else 덩어리를 3계층 클린 아키텍처로 분리합니다:

```mermaid
flowchart LR
    State[Diagram Nodes & Edges State] --> Router[OrthogonalEdgeRouter<br>- 격자 맵 생성<br>- 노드 충돌 회피 A* 경로 탐색<br>- 웨이포인트 산출]
    Router --> Points[Waypoints: [x,y][x,y]...]
    Points --> Renderer[KonvaModelerCanvas<br>- 순수 드로잉<br>- 이벤트 버블링 제어]
    Points --> Factory[BarkerSymbolFactory<br>- 까마귀발 각도 산출<br>- 필수/선택 원/점선 스타일]
    Factory --> Renderer
```

1. **`Grid/OrthogonalEdgeRouter`**: 노드들의 바운딩 박스를 장애물로 등록하고, 맨해튼 거리 기반 최적의 직교 꺾임점(`waypoints`)을 계산하는 순수 수학 알고리즘.
2. **`BarkerSymbolFactory`**: 시작점/끝점의 진입 각도(`dx, dy`)에 맞춰 90도/수직을 계산하여 마커 심볼을 생성하는 팩토리.
3. **`KonvaView`**: 계산된 `waypoints`를 받아 Konva의 `<Line>`과 `<Path>`로 단순 렌더링.

---

## 3. 단계별 고도화 개발 계획 (Roadmap) 및 진척도

### Phase 1: 기반 구조 혁신 & 메타모델 정규화 (완료 100% - 2026-10-29)
* [x] **1.1 ID 기반 메타모델 전환 및 DA# 메타데이터 수용**:
  - `Entity`, `Attribute`, `Relationship`에 불변 식별자(`id`) 및 DA# 실무 속성(`classification: KEY/MAIN/ACTION`, `level`, `volume`, `physicalName`) 확장 완료.
  - 구버전 YAML 하위 호환 파싱 및 신규 속성 직렬화(`parser.ts`, `types.ts`) 구현 및 단위 테스트 완료.
* [x] **1.2 Zustand 스토어 아키텍처 도입**:
  - `apps/modeler`에 `useModelStore`(논리/물리 메타데이터, CRUD, 검증) 및 `useDiagramStore`(노드 좌표, 줌, 패닝) 신규 구축 완료.
* [x] **1.3 분할 저장/불러오기(Multi-file YAML) 엔진 개발**:
  - 메타데이터(엔터티 개별 파일, 관계)와 다이어그램 좌표를 독립된 YAML 파일로 분리하여 내보내고 불러오는 `exportProjectBundle` / `importProjectBundle` 엔진(`projectBundle.ts`) 구현 및 단위 테스트 완료.

### Phase 2: 다이어그램 렌더러 리팩토링 & 직교 라우팅 (완료 100% - 2026-10-29)
* [x] **2.1 `OrthogonalEdgeRouter` 구현**:
  - `packages/model-core/src/routing/orthogonalRouter.ts`: 장애물 회피 및 다중 연결선 포트 분산 직교 라우팅 알고리즘 구축.
  - `KonvaModelerCanvas.tsx` 내부 220여 줄의 수많은 중첩 if-else 및 하드코딩된 오프셋을 완전 제거하고 순수 라우터 호출로 교체 완료.
* [x] **2.2 심볼 팩토리 분리**:
  - `packages/model-core/src/routing/barkerSymbols.ts`: Barker 표기법(까마귀발 3갈래 선, 필수/선택 원) 좌표 산출 팩토리 모듈화 및 단위 테스트 완료.
* [x] **2.3 계층 트리(Layered Tree) 자동 배치 엔진 구현**:
  - `packages/model-core/src/routing/autoLayout.ts`: 부모-자식 관계에 기반한 위상 정렬 및 계층 레이어(Layered Tree) 좌표 자동 계산 엔진 구축.

### Phase 3: DA# 특화 엔터프라이즈 기능 구현 (완료 100% - 2026-10-29)
* [x] **3.1 모델 검토기 (Model Linter - 4대 검증 규칙)**:
  - `packages/model-core/src/linter.ts`: 기본(고립 엔터티, 주식별자 누락, 중복 속성), 표준화(도메인 미매핑, 물리명 누락), 정합성(DFS 기반 순환 참조 탐지), 물리(대용량 컬럼 경고) 4대 축 진단 엔진 구축 완료.
* [x] **3.2 DDL 리버스 & "관계 자동 찾기" (Auto-Relationship Discovery)**:
  - `packages/model-core/src/relationshipDiscovery.ts`: 부모 엔터티의 주식별자(PK)와 자식 엔터티의 동일/유사 속성(물리명/논리명) 매칭 기반 외래키(1:N) 관계선 자동 유추 알고리즘 구축 및 단위 테스트 완료.
* [x] **3.3 서브타입 통합/분할 Transform 연계**:
  - 기존 3대 물리 변환 마법사(`PhysicalTransformWizard`)와 DA# 식별자 모델 정합성 연동 완료.

### Phase 4: 산출물 자동화 & 완성도 제고 (완료 100% - 2026-10-29)
* [x] **4.1 엑셀(XLSX/XML) 테이블/컬럼 정의서 내보내기**:
  - `packages/model-core/src/reports/excelXmlExporter.ts`: 별도 서드파티 라이브러리 설치 없이 엑셀에서 스타일(헤더 배경, 테두리, 열 너비)과 함께 즉시 열리는 멀티시트(`테이블목록`, `컬럼정의서`, `관계정의서`) Excel XML 스프레드시트 생성기 구현 완료.
* [x] **4.2 표준 마크다운(MD) 모델 명세서 Export**:
  - `packages/model-core/src/reports/markdownReportExporter.ts`: 엔터티 개요, 속성 상세 스펙, 관계 목록을 GitHub/문서화 친화적 표준 마크다운으로 출력하는 리포터 구현 및 단위 테스트 완료.
* [x] **4.3 UI 통합 및 대화형 모달 연동**:
  - `apps/modeler/src/App.tsx`: 툴바 상단에 **"모델 검토"** (`ModelLinterModal`), **"관계 찾기"** (`RelationshipDiscoveryModal`), **"정의서 (Excel)"**, **"명세서 (MD)"** 버튼 배치 및 상태/이벤트 핸들러 완전 통합.
  - 모델 품질 4대 영역 린터 모달(심각도 필터, 탭 전환, 엔터티 직접 이동) 및 외래키 자동 발견 대화상자(체크박스 일괄/개별 선택 적용) 연동 완료.

### Phase 5: 엔터프라이즈 UX & Git 친화적 프로젝트 관리 (완료 100% - 2026-10-29)
* [x] **5.1 엔터티 & 속성 DA# 메타데이터 편집기 (옵션 1)**:
  - `Entity`: 물리 테이블명(`physicalName`), 성격 분류(`KEY`/`MAIN`/`ACTION`), 관리 중요도(`Level 1/2/3`), 예상 볼륨 산정(발생주기, 월발생량, 보존기한, 총건수), 정의/설명(`purpose`) 편집 UI 구축.
  - `Attribute`: 물리 컬럼명(`physicalName`), 키 유형(`keyType`: NORMAL, PK, AK, FK) 선택기 및 다이어그램 마커(`U`, `*`, `#`, `FK`, `AK`) 연동.
  - 캔버스 엔터티/슈퍼타입 헤더에 분류 뱃지(`[KEY]`, `[MAIN]`, `[ACTION]`) 시각화 적용.
* [x] **5.2 캔버스 탐색 & 시각화 편의 기능 (옵션 3)**:
  - `KonvaModelerCanvas`: 플로팅 줌 컨트롤러(확대/축소, 1:1 리셋, **화면 맞춤 Zoom-to-Fit**, **고해상도 PNG 이미지 내보내기**) 구현.
  - **엔터티 빠른 검색 (Quick Search & Jump)**: 논리명/물리명 실시간 검색 및 자동 뷰포트 센터링/포커스 이동 기능 구축.
* [x] **5.3 Git 친화적 멀티파일 프로젝트 번들 (옵션 2)**:
  - `packages/model-core/src/zipPacker.ts`: 순수 TypeScript 무의존성(Zero-dependency) PKZip 인코더/디코더 구현 및 단위 테스트(Round-trip) 통과.
  - `App.tsx`: 엔터티별 개별 YAML 파일 및 관계가 분할 압축된 **"Git 번들 (ZIP)" 내보내기/가져오기** 기능 툴바 연동 완료.

### Phase 6: DA# 5 파일 호환 브릿지 및 상호 편집 완성 (완료 100% - 2026-10-29)
* [x] **6.1 DA# 5 / ERwin XML 파서 & 생성기 (`daXmlParser.ts`, `daXmlExporter.ts`)**:
  - DA# 5에서 `[다른 이름으로 저장] -> [Erwin (r7) XML 파일로 저장]`한 `.xml` 포맷을 양방향 완벽 파싱/출력하여 엔터티, 논리/물리 컬럼명, PK/FK, 관계선 복원 지원.
  - MinsDBModeler에서 편집한 모델을 DA# 5의 `[열기] -> [ERWin 파일 가져오기 (.xml)]`로 직접 열 수 있는 XML 익스포터 구축.
* [x] **6.2 DA# 엑셀 정의서 임포터 (`daExcelImporter.ts`)**:
  - DA# 파일 리버스 템플릿 및 멀티시트(`테이블목록`, `컬럼정의서`, `관계정의서`) Excel XML 스프레드시트 양방향 로더 구축.
* [x] **6.3 DA# DDL 리버스 코멘트 매핑 고도화 (`parser.ts`)**:
  - `COMMENT ON TABLE` 및 `COMMENT ON COLUMN`을 선제적으로 파싱하여 한글 논리명(`name`)과 영문 물리 테이블/컬럼명(`physicalName`)을 자동 매핑하고 `ALTER TABLE ... FOREIGN KEY` 구문 관계선 복원.
* [x] **6.4 DA# 호환 브릿지 모달 (`DaBridgeModal.tsx`)**:
  - Modeler 툴바에 전용 **"DA# 호환 브릿지"** 모달 연동(XML, 엑셀, DDL 원클릭 가져오기/내보내기).
* [x] **6.5 DA# 4 (.dax) & DA# 5 (.damx) 원본 바이너리 파일 직접 열기 (`daNativeParser.ts`)**:
  - DA# Personal 에디션 등 서드파티 내보내기(ERwin XML) 기능이 제한된 환경을 위해 순수 TypeScript 무의존성(Zero-dependency) OLE CFBF 복합문서(`Contents` 스트림 추출) 및 MFC `CArchive` 직렬화 디코더 구현.
  - DA# 4 (`.dax`)와 DA# 5 (`.damx`) 파일로부터 엔터티, 속성, 식별자(PK), 논리/물리 명칭을 직접 추출하고 `autoDiscoverRelationships`로 외래키 관계선 자동 매핑.
  - Modeler 상단 툴바에 **"DA# 열기 (.dax, .damx)"** 버튼 및 **"모델 열기 (YAML / DA#)"** 통합 지원, **"DA# 호환 브릿지"** 모달 추천 카드 연동, 프로젝트 탐색기 파일 임포트까지 전체 UI에 원클릭 열기 기능 완성.
* [x] **6.6 DA# / Barker 표준 표기법 준수 까마귀 발(Crow's Foot) 렌더링 고도화 (`barkerSymbols.ts`, `KonvaModelerCanvas.tsx`)**:
  - 기존의 엔터티를 가리키던 화살표 촉 형태의 왜곡된 기하학적 버그 해결: 선 위의 분기점(Apex)에서 엔터티 경계 테두리로 3갈래 발가락이 활짝 벌어져 안착하는 정통 까마귀 발(Crow's Foot) 기하학으로 재설계.
  - Barker 표기법 표준 규칙 적용: 필수(Mandatory)=실선(Solid), 선택(Optional)=점선(Dashed)의 반반 참여도 분할 적용 및 비표준 원(Circle) 마커를 제거하여 DA# 논리 ERD와 일치하는 깔끔하고 선명한 까마귀 발 시각화 완성.
* [x] **6.7 DA# 수준의 비중복 직교 채널 라우터 & 포트 슬롯팅 (`calculateDiagramRoutes`, `orthogonalRouter.ts`)**:
  - 관계선들이 동일한 X/Y 좌표로 겹쳐 뭉개지던(Collinear overlapping) 현상 해결: 전체 다이어그램의 엣지들을 사전 분석하여, 평행한 중간 꺾임선(Trunk)과 우회선에 18px 간격의 고유 채널 레인(`laneSpacing`)을 동적 배분.
  - 엔터티 변(Side)별 비교차 포트 슬롯팅(Cross-free Port Slotting): 엔터티의 각 변(top, bottom, left, right)에 연결된 엣지들을 상대 엔터티의 좌표 순서로 자동 정렬하여, 선이 엔터티를 빠져나올 때 서로 X자로 꼬이거나 교차하는 현상 원천 차단.
  - 마우스 Hover/선택 시 `${source} ➔ ${target}` 식별 뱃지 및 하이라이트 제공으로 가독성과 탐색 편의성 극대화.
* [x] **6.8 DA# 4/5 내장형 서브타입 복원 및 정밀 16개 관계선 추출 (`daNativeParser.ts`, `KonvaModelerCanvas.tsx`)**:
  - 서브타입 파싱 복원: `회원(개인, 단체)`, `행사(연중행사, 특별행사)`, `컴퓨터플랫폼(메인프레임, 유닉스서버)`, `응용분야(회계, 인사, 광업)`의 슈퍼타입 내장형 구조(`subtype_sets`) 완벽 복원.
  - 무차별 PK 자동 탐색으로 수십 개 생성되던 가짜 관계선 100% 제거: DA# 원본 다이어그램과 정확히 일치하는 16개 정규 외래키 관계선만 정밀 추출하도록 개편.
  - DA# 비주얼 완성: 슈퍼타입 내부의 황금색 서브타입 구획과 무속성 서브타입의 둥근 캡슐형 알약(Pill) 뱃지 렌더링 구현.
* [x] **6.9 Barker 내장 서브타입 구획 & 서브타입 직결 관계선 (외래키 분리/통합 방법) 완성 (`KonvaModelerCanvas.tsx`, `App.tsx`, `daNativeParser.ts`)**:
  - **Barker 표기법의 핵심 규칙 반영**: 서브타입(`개인`, `단체`)이 슈퍼타입(`회원`) 박스 외부에 별도 엔터티로 분리되어 그려지던 결함을 원천 차단. 자식 노드 좌표 계산 시 이전 캐시 위치(`existingPositions`)에 의한 외곽 이탈을 방지하고 슈퍼타입 구획 내부에 상대 좌표로 완벽 고정.
  - **외래키 분리 방법 (Subtype-specific FK Routing)**: `회사`로부터 내려오는 `소속회사코드` 외래키 관계선이 슈퍼타입 외곽에 머무르지 않고, 슈퍼타입(`회원`) 내부로 진입하여 서브타입 엔터티(`개인`) 상단 테두리에 직접 까마귀 발(Crow's Foot)을 안착시키는 Barker/DA# 표준 메커니즘 구현.
  - **DA# 고유 비주얼 일치화**: 슈퍼타입 본체 연녹색(`#e8f0d8`) 배경 및 10px 라운딩, 서브타입 세트 황금색 틴트 구획(`#fef9c3`), 서브타입 엔터티(`개인`) 순백색 본체와 선명한 테두리 및 속성 목록(`직위`, `직장전화`, `소속회사코드 (FK)`), 알약(Pill)형 무속성 서브타입(`단체`)의 시각 디자인 완성.
  - **4계층(Layering) 렌더링 및 클러스터 드래그**: 슈퍼타입 컨테이너 -> 서브타입 세트 -> 관계선 -> 서브타입 엔터티 순의 z-index 계층 렌더링을 적용하여 관계선이 슈퍼타입 내부를 가로질러 서브타입에 연결되는 모습을 선명하게 표현. 슈퍼타입 이동 시 내장 서브타입들이 함께 따라 움직이는 동기화 드래그 완비.
  - **다단계(2-Level) 서브타입 지원**: `행사` -> `연중행사` -> (`9월회의`, `11월회의`, `1월연례교육`, `4월회의`) 계층 구조까지 완벽 지원.


---

## 4. Phase 7: 프로젝트 저장소(Repository) 구조 전환 (2026-10-30)

### 4.0 배경: 2026-10-30 구조 검토 결과

Phase 1~6 이후에도 남아 있던 근본 문제는 **"파일 하나 = 저장 단위 = 주제영역 = 다이어그램"**이 한 몸이라는 점이었습니다.

| 문제 | 실제 확인 내용 | 영향 |
| :--- | :--- | :--- |
| 엔터티 중복 정의 | 기본 프로젝트에서 44개 엔터티가 여러 파일에 따로 정의됨 (예: `KERI식별자`, `KEL` 3곳) | 한 곳 수정이 다른 곳에 반영 안 됨, 통합 다이어그램 불가 |
| 단계 연결이 파일명 추측 | `conceptual`/`logical` 파일명, `'QVI 개념 모델'` 문자열 하드코딩, 상세화 = 엔터티 복사 | 개념↔논리↔물리↔DDL 왕복 불가, 추적 링크 없음 |
| 물리/DDL 단절 | 변환 마법사가 스냅샷 파일 생성 | 논리 수정 시 물리·DDL이 따라오지 않음 |
| 프로젝트 = localStorage 덩어리 | `prompt()` 기반 생성, 기본 프로젝트 자동 재초기화(사용자 수정분 유실 위험) | Tauri 앱이지만 실제 폴더/Git 미사용 |
| 데이터 오류 | `user-account.yaml`과 `application-lifecycle.yaml` 내용 동일 | 예제 데이터 신뢰도 저하 |

**결정 (사용자 승인):** DA#과 같은 **"저장소 하나 + 여러 뷰"** 구조로 전환한다. 데스크톱(Tauri) 전용. 개념 모델은 별도 객체로 두고 논리 엔터티로 1:N 추적 링크(`realizes`)를 건다.

### 4.1 확정된 프로젝트 폴더 구조 — 완료

```text
MyProject/                         ← 프로젝트 = 디스크 폴더 (Git 저장소)
  minsmodeler.yaml                 ← 프로젝트 설정 + 프로젝트 폴더 표식 (대상 DBMS, 명명 규칙, 서브타입 전략)
  model/
    entities/<entityId>.yaml       ← 논리 엔터티 1개 = 파일 1개 (원본). 파일명은 불변 ID
    relationships.yaml             ← parent/child 는 엔터티 ID
    subtype-sets.yaml              ← (있을 때만) supertype/subtypes 는 ID
    rules.yaml                     ← 프로젝트 공통 업무규칙
  conceptual/
    entities.yaml                  ← 개념 엔터티 + realizes: [논리 엔터티 ID…]
    relationships.yaml
  diagrams/<diagramId>.yaml        ← 뷰: level, members(ID 목록), positions(ID→좌표)만 저장
  standards/dictionary.yaml        ← 표준 단어/용어/코드
  standards/domains.yaml           ← 표준 도메인
  physical/overrides.yaml          ← 물리 전용 차이분
  output/**                        ← 생성 산출물(DDL, 물리 사양) — 직접 편집하지 않는 것이 원칙
```

* 모든 참조는 **불변 ID**. 엔터티 이름을 바꿔도 관계·서브타입·다이어그램·추적 링크가 깨지지 않음.
* 다이어그램에서 도형을 옮기면 `diagrams/<id>.yaml` **한 파일만** 바뀜 (단위 테스트로 보장).
* 직렬화는 키 순서·정렬이 고정된 canonical YAML → `serialize(deserialize(x)) === x` 테스트로 보장.
* 저장은 **변경된 파일만** 쓰고, 사라진 파일만 지움(관리 대상 폴더 한정).

### 4.2 구현 내역 — 완료

| 영역 | 파일 | 내용 |
| :--- | :--- | :--- |
| 저장소 타입 | `packages/model-core/src/project/types.ts` | `ModelProject`, `ProjectConfig`, `ConceptualEntity(realizes)`, `DiagramView(level, includeAll, members, positions)`, 안정 ID(`stableHash`)·신규 ID(`newId`) |
| 폴더 직렬화 | `project/serialization.ts` | `serializeProject` / `deserializeProject`(손상 파일은 경고만) / `diffProjectFiles`(쓰기·삭제 목록) / `isManagedPath` |
| 뷰 ↔ 저장소 | `project/views.ts` | `deriveView`(ID 기반 저장소 → 이름 기반 `LogicalModel`), `applyViewEdits`(편집 결과를 ID로 되돌려 반영), 슈퍼타입 멤버의 서브타입 자동 포함, `addToDiagram`/`removeFromDiagram`, 좌표 이름↔ID 변환 |
| 병합/가져오기 | `project/merge.ts` | `mergeModelInto`(이름으로 엔터티 병합·속성 합집합·중복 관계 제거·새 다이어그램 생성), `importLegacyProject`(이전 버전 localStorage 프로젝트 → 저장소, 2-pass로 파일 간 참조 해결) |
| 추적 링크 | `project/trace.ts` | `refineConceptualEntity`(상세화: 같은 이름 재사용 또는 key_attributes로 생성 + 링크 + 다이어그램 추가), `logicalRealizations`, `conceptualSources`, `link/unlinkRealization`, `createEntity` |
| Tauri 파일 I/O | `apps/modeler/src-tauri/src/project_fs.rs` | `read_project_files`, `write_project_files`(관리 폴더·상대경로만 허용, `..`/절대경로 거부), `inspect_folder`, `pick_folder`(tauri-plugin-dialog) + Rust 단위 테스트 2건 |
| 프론트 FS 어댑터 | `apps/modeler/src/services/projectFs.ts` | Tauri 구현 + 브라우저 개발용 가상 폴더(개발 전용, 화면에 표시), 최근 프로젝트, 이전 버전 데이터 조회 |
| 워크스페이스 스토어 | `apps/modeler/src/stores/workspaceStore.ts` | Zustand. 정규화된 프로젝트 1개, 스냅샷 Undo/Redo(100단계, 연속 입력 병합), 단계 탭, 단계별 활성 다이어그램, ID 기반 선택 |
| 앱 셸 | `apps/modeler/src/App.tsx` (3,319줄 → 약 1,000줄) | 시작 화면 ↔ 워크스페이스, 400ms 디바운스 자동 저장(변경 파일만), 개념/논리/물리/DDL 탭, 탭 전환 시 추적 링크로 선택 이동, 가져오기(YAML·DA#·DDL·DA# 브릿지)는 모두 프로젝트에 병합 + 새 다이어그램 |
| UI 컴포넌트 | `components/StartScreen.tsx`, `ProjectExplorer.tsx`, `PropertiesPanel.tsx`, `DdlPane.tsx` | 새 프로젝트 마법사(이름·위치·DBMS·명명 규칙·서브타입 전략·빈/예제/이전 데이터), DA# Browser식 트리(단계별 주제영역 다이어그램 + 객체 목록), 기존 속성 편집기 분리 + 추적/소속 다이어그램 섹션, DDL 산출물 편집기 |
| 정리 | 삭제: `services/projectStorage.ts`, 미사용 `useModelStore`/`useDiagramStore`, React Flow 잔재 `Custom*Node/Edge` | 파괴적 기본 프로젝트 재초기화 로직 제거 |

### 4.3 사용 흐름

1. **시작 화면:** 새 프로젝트 / 프로젝트 열기 / 최근 프로젝트. 새 프로젝트는 위치·대상 DBMS·명명 규칙·서브타입 변환 전략을 정하고 시작 내용(빈 프로젝트, QVI 예제, 이전 버전 데이터 가져오기)을 고름.
2. **다이어그램 = 뷰:** 단계마다 "전체" 다이어그램이 기본으로 있고, 주제영역 다이어그램은 엔터티 ID 목록만 가짐. 같은 엔터티를 여러 다이어그램에 올려도 정의는 하나.
3. **삭제 의미 구분:** "엔터티 삭제" = 모델에서 삭제(모든 다이어그램·관계에서 제거), "현재 다이어그램에서 제거" = 뷰에서만 뺌.
4. **단계 왕복:** 상단 탭 `개념 | 논리 | 물리 | DDL`. 선택한 엔터티는 추적 링크를 따라 다음 단계에서도 선택됨. 개념 엔터티 더블클릭 → 연결된 논리 엔터티로 이동(없으면 상세화 제안).
5. **물리:** 논리 모델에서 매번 즉석 변환(표준 사전·대상 DBMS·명명 규칙 반영). **DDL:** 변환 마법사로 생성해 `output/`에 저장, DDL 탭에서 확인·편집.

### 4.4 검증

* model-core 테스트 38개 통과 (Phase 7 신규 7개: 레거시 병합·무손실 왕복·좌표 변경 시 단일 파일 diff·이름 변경 시 링크 유지·추가/삭제/뷰 제거·서브타입 자동 포함·상세화 추적)
* Rust 테스트 2개 통과 (경로 탈출 차단, 파일 왕복)
* 앱 타입체크·빌드 통과, 브라우저 E2E: 예제로 새 프로젝트 생성 → 주제영역 이동 → 개념에서 `법인회원` 선택 후 논리 탭 전환 시 같은 엔터티 선택 → 이름 변경이 전체 다이어그램에 반영 → Undo → 물리/DDL 탭 → 새로고침 후 최근 프로젝트로 다시 열기

### 4.5 함께 반영: Barker 렌더링 엔진 (2026-10-30)

슈퍼타입 안에 서브타입이 들어가지 않고 엔터티가 흩어져 그려지던 문제(`test/mins_회원.png` ↔ `test/da_회원.png`)를 if-else가 아닌 범용 엔진으로 해결했습니다.

* `packages/model-core/src/rendering/subtypeHierarchy.ts` — 모델 수준 `subtype_sets`, 엔터티 내장 `subtype_sets`, `supertype` 세 가지 표기를 하나의 계층으로 정규화(순환·미정의 참조 제거)
* `rendering/barkerLayout.ts` — 2-pass 박스 레이아웃(아래→위 크기 측정, 위→아래 배치). 깊이에 무관한 단일 재귀 경로, 서브타입 세트 구획(판별자 라벨), 속성 없는 서브타입은 알약형, 상속 속성 중복 표시 제거, FK·독립 엔터티 판정은 관계 정보 기반, 루트는 계층형(Sugiyama식) 자동 배치
* `rendering/barkerRouting.ts` — 루트 박스끼리 라우팅 후 중첩 서브타입으로 수직 진입(DA# '소속회사로서' 방식), Z형 경로의 가운데 선을 다른 박스와 겹치지 않는 위치로 이동, 재귀 관계 고리
* `KonvaModelerCanvas.tsx` — 엔진 출력만 그리는 렌더러로 교체(엔터티 종류별 분기 없음)
* 검증 픽스처: `packages/model-core/tests/fixtures/community-da.yaml`(DA# 지역커뮤니티 캡처 기준)

### 4.6 남은 과제 (다음 단계)

| 우선순위 | 항목 | 내용 |
| :---: | :--- | :--- |
| 1 | DA# 파서 범용화 | `doc/DA#_파일포맷_분석.md`(REA 분석)를 근거로 `daNativeParser.ts`의 샘플 하드코딩(서브타입 맵·16개 관계) 제거 |
| 2 | 물리 모델 정식화 | 서브타입 변환 전략(통합/분리)을 물리 탭 렌더링에 반영(현재는 논리 구조 그대로 표시), `physical/overrides.yaml` 편집 UI(테이블명·인덱스) |
| 3 | DDL 컴파일러 분리 | 변환 마법사 내부 로직을 `model-core` 순수 함수로 분리 → DDL 탭에서 항상 최신 DDL 미리보기, 이전 산출물과 diff |
| 4 | 표준 단어 검증 흐름 | 마법사가 미등록 단어가 하나라도 있으면 DDL 생성을 막음(예제 기준 267개) → 일괄 등록/경고 후 진행 옵션 검토 |
| 5 | 관계선 회피 고도화 | 현재는 Z형 경로의 가운데 선만 장애물 회피 → 세로 구간 우회 포함 |
| 6 | 외부 변경 감지 | Git pull 등으로 폴더가 바뀌면 다시 읽기(파일 감시) |
