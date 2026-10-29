# MinsDBModeler 고도화 개발 계획 및 아키텍처 진단 보고서

> **작성일자:** 2026-10-29  
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
