# MinsDBModeler 개발 문서

> 이 문서 하나로 목표·구조·기능 현황·남은 작업을 관리한다. (2026-10-30 통합)
> 이전의 `Barker 모델러 개발 방향.md`와 `MinsDBModeler_고도화_개발계획_및_아키텍처_진단.md`를 합쳤다.
> 바이트 단위 DA# 파일 포맷은 별도 참고 문서 [`참고/DA#_파일포맷_분석.md`](참고/DA%23_파일포맷_분석.md)에 있다.
>
> **최종 갱신:** 2026-10-30 — 물리 컴파일러 분리, DDL 탭 실시간 미리보기, 표준 단어 일괄 등록, 서브타입 세트 편집기

---

## 1. 목표

QVI/vLEI 포털 논리 모델을 작성하면서 Oracle SQL Developer Data Modeler(무거운 UX)와 Mermaid(Barker 서브타입 박스 표현 불가)의 한계를 겪었다. 그래서 **Barker 표기법 중심의 데이터 모델러**를 직접 만든다. 기준(벤치마크)은 DATAWARE™ DA# 5다.

핵심 요구사항:

1. Barker 스타일 논리 모델: 슈퍼타입 박스 안에 서브타입 박스(다단계 포함)
2. 개념 → 논리 → 물리 → DDL을 하나의 저장소에서 왕복 (추적 링크 유지)
3. 표준 단어·용어·도메인·코드 사전과 모델 통합, 물리명 자동 생성
4. 업무규칙을 1급 모델 요소로 관리
5. Git 친화적 저장: 사람이 읽을 수 있는 YAML, 객체 1개 = 파일 1개, 좌표와 의미 분리
6. 산출물: DDL(Oracle/PostgreSQL/MySQL), 물리 사양, 엑셀 정의서, MD 명세서, PNG
7. DA# 호환: ERwin XML, 엑셀 정의서, DDL, `.dax`/`.damx` 원본 파일 읽기

기존 도구와의 차별점:

| 항목 | 기존 범용 ERD 도구 | MinsDBModeler |
| --- | --- | --- |
| Barker 서브타입 | 제한적이거나 불편함 | 슈퍼타입 내부 박스가 기본 |
| 표준 사전 | 별도 관리 | 모델과 통합, 미등록 단어 즉시 등록 |
| 업무규칙 | 주석 수준 | 1급 모델 요소 |
| 단계 연결 | 파일 복사 | 하나의 저장소 + 추적 링크, 물리·DDL은 매번 파생 |
| 저장 형식 | 벤더 바이너리 | 폴더 + YAML + Git |

---

## 2. 아키텍처

### 2.1 패키지 구조

```text
packages/model-core/      순수 TypeScript (UI·파일시스템 의존 없음, 단위 테스트 대상)
  src/types.ts              Entity / Attribute / Relationship / SubtypeSet / LogicalModel
  src/parser.ts             YAML ↔ LogicalModel, DDL 리버스
  src/validation.ts, linter.ts, relationshipDiscovery.ts
  src/project/              저장소 모델: types, serialization(폴더↔객체), views(다이어그램=뷰),
                            merge(가져오기·레거시 변환), trace(개념→논리 추적)
  src/rendering/            Barker 레이아웃 엔진: subtypeHierarchy, barkerLayout, barkerRouting
  src/routing/              직교 라우터, Barker 심볼, 자동 배치(구버전 경로, 일부 재사용)
  src/standards/            표준 사전 파싱/직렬화, 물리명 변환, 데이터 타입 결정, 미등록 단어 탐지
  src/physical/             논리 → 물리 컴파일러, DDL·물리 사양 생성, 물리 다이어그램 모델
  src/reports/              엑셀 XML 정의서, 마크다운 명세서
  src/daBridge/             DA# 호환: ERwin XML, 엑셀, .dax/.damx 원본 파서
  tests/                    node:test (npm test)

apps/modeler/             Tauri 2 + React 19 + Konva + Zustand
  src/App.tsx               시작 화면 ↔ 워크스페이스, 자동 저장, 단계 탭, 가져오기
  src/stores/workspaceStore.ts   프로젝트 1개 + Undo/Redo(스냅샷 100단계)
  src/components/           KonvaModelerCanvas, PropertiesPanel, SubtypeSetEditor, ProjectExplorer,
                            DdlPane, DictionaryManager, StartScreen, 각종 모달
  src/services/projectFs.ts Tauri 파일 I/O (브라우저 개발 모드는 가상 폴더)
  src-tauri/src/project_fs.rs  관리 폴더·상대경로만 허용하는 읽기/쓰기
```

### 2.2 프로젝트 폴더 (저장소)

```text
MyProject/                         ← 프로젝트 = 디스크 폴더 (Git 저장소)
  minsmodeler.yaml                 ← 프로젝트 설정 + 폴더 표식 (대상 DBMS, 명명 규칙, 서브타입 전략)
  model/
    entities/<entityId>.yaml       ← 논리 엔터티 1개 = 파일 1개. 파일명은 불변 ID
    relationships.yaml             ← parent/child 는 엔터티 ID
    subtype-sets.yaml              ← (있을 때만) supertype/subtypes 는 ID
    rules.yaml                     ← 프로젝트 공통 업무규칙
  conceptual/
    entities.yaml                  ← 개념 엔터티 + realizes: [논리 엔터티 ID…]
    relationships.yaml
  diagrams/<diagramId>.yaml        ← 뷰: level, members(ID 목록), positions(ID→좌표)만
  standards/dictionary.yaml        ← 표준 단어/용어/코드
  standards/domains.yaml           ← 표준 도메인 (DBMS별 데이터 타입)
  physical/overrides.yaml          ← 물리 전용 차이분 (테이블명, 테이블스페이스, 컬럼명/타입)
  output/**                        ← 저장한 산출물(DDL, 물리 사양). 언제든 다시 만들 수 있음
```

- 모든 참조는 **불변 ID**다. 이름을 바꿔도 관계·서브타입·다이어그램·추적 링크가 깨지지 않는다.
- 도형을 옮기면 `diagrams/<id>.yaml` **한 파일만** 바뀐다 (테스트로 보장).
- 직렬화는 키 순서가 고정된 canonical YAML이다. `serialize(deserialize(x)) === x`
- 자동 저장(400ms 디바운스)은 **바뀐 파일만** 쓰고 사라진 파일만 지운다 (관리 폴더 한정).

### 2.3 데이터 흐름

```text
                 ┌──────────── 저장소 (ModelProject, ID 기반) ────────────┐
 개념 탭 ◀── deriveView ── conceptual.*            standards/*   physical/overrides
 논리 탭 ◀── deriveView ── entities/relationships/subtypeSets          │
                                │ (전체 논리 모델)                       │
                                ▼                                       ▼
                     compilePhysicalModel(논리, 사전, DBMS, 서브타입 전략, 명명 규칙, overrides)
                                │
              ┌─────────────────┼──────────────────────┐
              ▼                 ▼                      ▼
   물리 탭 (physicalDiagramModel)  DDL 탭 미리보기 (generateDdl)   output/ 저장 (DDL + physicalSpecYaml)
```

- 화면 편집은 언제나 이름 기반 `LogicalModel` 뷰에서 일어나고, `applyViewEdits`가 ID로 되돌려 저장소에 반영한다.
- 물리·DDL은 **저장하지 않는 파생물**이다. 물리 탭, DDL 미리보기, 저장된 DDL이 모두 같은 컴파일러를 거치므로 서로 어긋날 수 없다.
- 물리 다이어그램의 도형은 논리 엔터티 이름을 키로 쓴다 → 논리 다이어그램 좌표를 그대로 공유한다.

---

## 3. 설계 원칙과 결정 사항

| 주제 | 결정 | 근거 |
| --- | --- | --- |
| 저장 | 폴더 + 객체별 YAML, 좌표는 다이어그램 파일에 분리 | Git diff/merge, DA#도 데이터·도형 직렬화를 분리 (부록 A.1) |
| 참조 | 불변 ID | 이름 변경 시 고아 참조 방지 |
| 다이어그램 | 저장소에 대한 뷰 (members + positions) | DA# 주제영역 다이어그램과 동일. 같은 엔터티를 여러 다이어그램에 |
| 개념→논리 | 개념 엔터티의 `realizes: [논리 ID]` (1:N) | 단계 왕복·추적 |
| 물리/DDL | 매번 컴파일, 저장은 산출물 스냅샷뿐 | 논리 수정이 즉시 반영, 저장본과 diff 가능 |
| 표준 단어 미등록 | **경고 후 진행** (원문을 따옴표로 감싸 DDL 생성) + 일괄 등록 UI | 이전에는 267개 미등록 단어 때문에 DDL 생성 자체가 막혔음 |
| 표기법 | Barker 전용 렌더러. 표기법은 모델 전역 설정 하나로 확장 예정 | DA#도 전역 설정 (부록 A.2) |
| 관계선 | 필수 쪽 반은 실선, 선택 쪽 반은 점선, 다(多)쪽은 까마귀발. **원(○) 마커는 쓰지 않음** | DA# 논리 ERD와 일치 (초기 방향 문서의 원 마커 규칙은 폐기) |
| 서브타입 세트 플래그 | `disjoint`(배타/포괄)와 `total`(완전/부분)은 **서로 다른 두 축** | DA# `Inclusive` = `!disjoint`. DA#에는 완전/부분 플래그가 따로 없음 (부록 A.5) |
| 물리명 | 엔터티/속성 물리명 > overrides > 표준 용어 > 표준 단어 조합. 테이블 접두어 `TB_`, 복수형 없음 | DA#·공공 표준 관례 |

### 3.1 논리 → 물리 변환 규칙 (`physical/compiler.ts`)

- **서브타입 전략**
  - `ROLL_UP` (통합): 서브타입 계층 하나 = 테이블 하나. 서브타입 컬럼은 NULL 허용. 세트마다 구분 컬럼을 두는데, 같은 이름 속성(`이용자구분` ↔ `이용자구분코드`)이 있으면 그 속성을 쓴다. 서브타입을 향한 FK는 NULL 허용이 된다.
  - `ROLL_DOWN` (분리): 말단 서브타입마다 테이블을 만들고 조상 컬럼을 복사한다. 슈퍼타입을 향한 관계는 모든 말단 테이블로 펼친다.
  - `IDENTITY` (1:1): 모든 엔터티가 테이블이다. 서브타입은 슈퍼타입 PK를 공유하며 그 PK가 곧 FK다.
- **FK 컬럼 결정**: 부모 PK 속성과 관계의 `fk_attributes`를 짝짓는다. 순서는 ① 같은 이름 ② 접미사 일치(`답변문항보기번호` ↔ `보기번호`) ③ 남은 개수가 같으면 위치 순.
  - 짝이 없으면 자식의 같은 이름 컬럼을 재사용한다(복합키 통합). 단, **같은 부모를 향한 두 번째 관계**에는 새 컬럼을 만든다.
  - 재귀 관계는 `PRNT_` 접두어 컬럼을 쓴다.
- **NULL 여부**: `child_participation`이 `1..`이면 NOT NULL이다. 식별 관계면 FK가 PK에 포함된다.
- **데이터 타입**: 다음 순서로 정한다.
  1. 명시 도메인이 표준 도메인이면 그 도메인 타입
  2. 명시 도메인이 SQL 타입이면 DBMS에 맞게 변환한 타입
  3. 속성명 접미사(…번호, …일시, …코드)로 찾은 표준 도메인 타입
  4. 위 어디에도 해당하지 않으면 `VARCHAR(100)`
- **DDL**: 결정적 출력(타임스탬프 없음)이라 저장본과 diff할 수 있다. 영문이 아닌 식별자는 자동으로 따옴표 처리하고, 미등록 단어와 변환 경고는 머리말 주석으로 남긴다. `DROP`은 기본 미포함이다.

---

## 4. 기능 현황

### 4.1 모델링·캔버스
- [x] Barker 레이아웃 엔진: 슈퍼타입 안 서브타입 구획(다단계), 판별자 라벨, 속성 없는 서브타입은 알약형, 상속 속성 중복 제거
- [x] 관계선: 루트 박스끼리 직교 라우팅 → 중첩 서브타입으로 수직 진입(DA# '소속회사로서' 방식), 재귀 관계 고리, 채널 레인 분배, 변별 포트 슬롯팅
- [x] 캔버스: 드래그/리사이즈(클러스터 단위), 줌·화면 맞춤·PNG 내보내기, 빠른 검색·이동, Hover 하이라이트
- [x] 속성 편집기: DA# 메타(분류 KEY/MAIN/ACTION, 레벨, 볼륨, 물리명, 키 유형 PK/AK/FK)
- [x] **서브타입 세트 편집기 (10/30)**: 구분 속성, 배타/포괄, 완전/부분, 멤버 추가·제외, 세트 추가·삭제. 캔버스 구획 이름에 `(포괄·부분)` 표시
- [x] YAML 분할 편집기 (현재 다이어그램 뷰를 YAML로 편집 → 저장소 반영)
- [x] Undo/Redo 100단계 (연속 입력은 한 단계로 병합)

### 4.2 프로젝트·저장소
- [x] 폴더 저장소, 시작 화면, 새 프로젝트 마법사(빈/QVI 예제/이전 버전 가져오기), 최근 프로젝트
- [x] 다이어그램 = 뷰: 단계별 "전체" + 주제영역, "모델에서 삭제" vs "다이어그램에서 제거" 구분
- [x] 개념 ↔ 논리 추적: 상세화, 링크/해제, 탭 전환 시 선택 유지, 더블클릭 이동
- [x] 자동 저장(변경 파일만), Tauri 경로 탈출 차단

### 4.3 물리·DDL·표준화
- [x] **물리 컴파일러 (10/30)**: 3가지 서브타입 전략, FK 컬럼 짝짓기·복합키 통합, overrides 반영, 결정적 DDL (Oracle/PostgreSQL/MySQL)
- [x] **물리 탭 (10/30)**: 서브타입 전략이 반영된 실제 테이블/컬럼/타입/FK를 그림 (이전에는 논리 구조에 물리명만 덮어씀). 선택한 엔터티가 어느 테이블로 갔는지 표시
- [x] **DDL 탭 (10/30)**: 논리 모델 전체에서 실시간 DDL 미리보기, 대상 DBMS·서브타입 전략·명명 규칙을 그 자리에서 변경, `output/`에 DDL + 물리 사양 저장, **저장본과 비교(diff)**, 변환 경고 목록
- [x] **표준 단어 흐름 (10/30)**: 미등록 단어를 사용 빈도순으로 보여 주고 약어를 입력해 일괄 등록 → 즉시 물리명 갱신. 등록은 브라우저가 아니라 **프로젝트 사전**에 저장
- [x] 표준화 사전 관리자(단어/용어/도메인/코드, 준수율 감사)
- [x] **버그 수정 (10/30)**: 프로젝트 도메인 파일을 읽을 때 DBMS별 타입이 버려져 모든 컬럼이 `VARCHAR2(100)`이 되던 문제, 사전 관리자가 저장 시 도메인 타입을 지워 버리던 문제
- [x] 엑셀 정의서, MD 명세서

### 4.4 검토·자동화
- [x] 모델 검토기 (고립 엔터티, 주식별자 누락, 중복 속성, 도메인 미매핑, 물리명 누락, 순환 참조, 대용량 컬럼)
- [x] 관계 자동 찾기 (PK ↔ 동일/유사 속성 매칭)
- [x] 계층형 자동 배치

### 4.5 DA# 호환
- [x] ERwin r7 XML 양방향, DA# 엑셀 정의서 가져오기, DDL 리버스(COMMENT로 한글명 복원, ALTER FK)
- [x] `.dax`(OLE `Contents` 스트림) / `.damx` 원본 열기 — 엔터티·속성 추출
- [ ] ⚠ 서브타입·관계는 아직 **샘플 하드코딩**에 의존 (남은 작업 1)

---

## 5. 남은 작업

| # | 항목 | 내용 | 상태 |
| :-: | --- | --- | --- |
| 1 | DA# 파서 범용화 | `daNativeParser.ts`의 서브타입 맵·16개 관계·FK 속성명 하드코딩을 제거하고, 파일의 `CEnSubset`/`CEnSubtype` 부모 GUID, `CEnRelation`의 First/Second 엔터티 GUID, `PrimaryKey` 키그룹으로 일반화. **샘플 `.dax`/`.damx` 파일이 필요** (참고 문서 §13의 차등 분석 방법 사용) | 대기 — 샘플 필요 |
| 2 | 물리 overrides 편집 UI | 테이블스페이스·인덱스·컬럼 타입 재정의를 화면에서 편집 (지금은 엔터티/속성 물리명만 화면 편집, 나머지는 `physical/overrides.yaml` 직접 편집) | |
| 3 | 관계선 회피 고도화 | Z형 가운데 선뿐 아니라 세로 구간까지 장애물 회피. DA#처럼 "노드 배치"와 "선 부착점 최적화"를 별도 단계로 분리하고 고정(Pinned) 노드 도입 (부록 A.4) | |
| 4 | 물리 다이어그램 배치 | 통합 전략에서 커진 테이블이 이웃과 겹칠 수 있음. 물리 전용 배치를 둘지, 논리 좌표 공유를 유지할지 결정 | |
| 5 | 외부 변경 감지 | Git pull 등으로 폴더가 바뀌면 다시 읽기 (Tauri 파일 감시) | |
| 6 | 카디널리티·선택성 파생 정리 | 관계에는 분류값(1:M 식별 등 7종)만 두고 선택성은 FK 속성 NotNull에서 파생하는 단일 경로로 (부록 A.3). 현재는 관계에 participation을 저장하고 컴파일러가 그것으로 NULL 여부를 정함 | |
| 7 | 관계선 직접 편집 | 끝점 드래그로 대상 엔터티 변경, waypoint 드래그, 관계 더블클릭 편집, 슈퍼타입 안으로 끌어 넣어 서브타입 지정 | |
| 8 | 추가 산출물 | Prisma schema, DBML, SVG/PDF 다이어그램 내보내기 | |
| 9 | 관계 라벨 배치 | 제목/부모측 동사구/자식측 동사구를 따로 배치 (부록 A.6) | |
| 10 | 표기법 확장 | IE(크로우풋) 등. 표기법을 모델 전역 설정으로 두고 마커 팩토리를 일반화 (부록 A.2) | |

---

## 6. 개발·검증

- `npm test` (루트) — model-core 단위 테스트 47개. 핵심 시나리오:
  - 저장소 무손실 왕복
  - 좌표 변경 시 파일 하나만 diff
  - 이름 변경 시 링크 유지
  - 서브타입 자동 포함
  - 물리 3전략과 FK 짝짓기
  - DDL 결정성
- Rust: `cargo test` (src-tauri) — 경로 탈출 차단, 파일 왕복
- 앱: `npm run dev` (브라우저, 가상 폴더) / `npm run tauri dev` (데스크톱)
- **model-core를 고친 뒤에는 `npm run build -w @barker-modeler/model-core`로 dist를 다시 만들어야 앱에 반영된다** (앱은 `dist/`를 참조)
- 검증 픽스처:
  - `packages/model-core/tests/fixtures/community-da.yaml` (DA# 지역커뮤니티 캡처 기준)
  - `doc/참고/model/*.yaml` (QVI 모델)

---

## 7. 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-10-29 | Phase 1~6 — ID 메타모델, Zustand, 직교 라우터·Barker 심볼·자동 배치, 모델 검토기·관계 찾기, 엑셀/MD 산출물, DA# 메타 편집기, ZIP 번들, DA# 호환 브릿지(XML·엑셀·DDL·원본 파일), 까마귀발 정정, 채널 라우터, 내장 서브타입·서브타입 직결 FK |
| 2026-10-30 | Phase 7 — 폴더 저장소 전환, 다이어그램=뷰, 개념→논리 추적, Tauri 파일 I/O, App.tsx 3,319→약 1,000줄, Barker 레이아웃 엔진 범용화 |
| 2026-10-30 | Ghidra로 DA# 5 엔진 분석 (부록 A) |
| 2026-10-30 | 물리 컴파일러를 model-core로 분리, 물리 탭 실변환, DDL 탭 실시간 미리보기·diff·설정, 표준 단어 경고 후 진행 + 일괄 등록, 도메인 타입 유실 버그 수정, 서브타입 세트 편집기, 문서 통합 |

---

## 부록 A. DA# 5 엔진·Barker 렌더링 기능 분석 (Ghidra 역공학, 2026-10-30)

### A.0 조사 방법

이번 조사는 `doc/참고/DA#_파일포맷_분석.md`(파일 포맷 분석) 이후, **DA# 5의 "기능"과 "Barker 표기법
렌더링 엔진"**을 대상으로 REA로 재조사한 결과다. 지난 조사와 달리 이번에는 Ghidra 12.1.4를
실제로 설치해 사용했다(`GHIDRA_INSTALL_DIR=D:\tools\ghidra_12.1.4_PUBLIC`,
JDK 21 Temurin: `D:\tools\jdk-21.0.13+9`). 방법은 세 단계:

1. **PE Export 테이블 전수 조사** (`inspect_native_exports`, 디스어셈블 불필요·100% 정확) —
   `EnDiagram.dll`(2,793개), `EnData.dll`(5,479개), `EnAutoLayout.dll`(15개) 전체 export를
   추출. DA#는 공개 빌드에서도 **C++ 심벌을 전혀 스트립하지 않아서**, 모든 클래스/메서드의
   **정확한 타입 시그니처**(인자·리턴 enum 타입까지)가 그대로 드러난다 — 이것만으로도 대부분의
   "무엇을 저장/계산하는가"가 추정이 아니라 사실로 확정됐다.
2. **Ghidra 헤드리스 디컴파일** — 위 1번에서 추린 Barker 렌더링 핵심 함수 22개(아래 A.2~A.4)를
   `EnDiagram.dll` 단일 바이너리에서 디컴파일했다. **디컴파일된 C 코드 자체는 이 문서에 옮기지
   않았고**, 코드가 "무엇을 하는지"만 서술한다.
3. **UI 리소스 문자열(.ini) 대사전** — `DA Modeler\Language\*_ENGLISH.ini`(UTF-16LE)에서 메뉴·
   툴바·속성그리드 라벨 텍스트를 뽑아, 1·2번에서 찾은 내부 enum/함수 이름과 대조해 사람이 보는
   용어로 환산했다(예: `E_LINE_MULTICHILD`+`E_LINE_MANDATORY` 조합 → 툴바의 "1:M Mandatory"
   버튼).

### A.1 전체 저장/엔진 아키텍처

```
Modeler5.exe
 ├─ EnData.dll        — 논리/물리 메타모델 (CEnModel/CEnEntity/CEnAttribute/CEnRelation/CEnSubtype…)
 │                       MFC CObject + CArchive 직렬화. .dax/.damx 본문이 여기 해당(파일포맷 문서 참고).
 ├─ EnDiagram.dll      — 다이어그램(Erd) 레이어: CEnErdEntity/CEnErdRelation/CEnErdAttribute/
 │                       CEnErdExclusiveRelation/CEnCanvas/CEnPage 등. **boost::serialization
 │                       (binary_iarchive/binary_oarchive)** 사용 — EnData.dll의 MFC CArchive와
 │                       다른 직렬화 기술! (양쪽 모두 `ptr_serialization_support` 인스턴스화 심벌로
 │                       확인) IEnDiagram/IEnCanvas/IEnPage 세 인터페이스로 공개 API를 노출한다.
 └─ EnAutoLayout.dll   — 그래프 자동배치 엔진(A.4). EnDiagram.dll과 별도 DLL, C 스타일 플랫 API.
```

**MinsDBModeler 시사점**: "논리 모델 데이터"와 "다이어그램 표현(좌표·선 경로·스타일)"을 DA#도
처음부터 **별개의 직렬화 기술/별개 모듈**로 분리해 두었다 — `model-core`(순수 데이터)와
`rendering/`(Konva 좌표 계산)를 분리한 현재 방향과 같은 결론이다.

### A.2 Barker / IE / IDEF1X — 표기법은 셋 중 하나를 고르는 전역 설정

`IEnDiagram::GetERDNotation()` / `SetERDNotation(E_ERD_NOTATION)` (export로 확인, 디컴파일로
본문까지 확인)은 `CEnModel` 쪽 멤버 데이터 한 칸을 그대로 읽고 쓰는 단순 getter/setter이고,
`CEnModel::UpdateDiagramERDNotation()`이 모델 전체 다이어그램을 다시 그리도록 트리거한다. 즉
**"표기법"은 모델 전체에 적용되는 전역 설정 하나**이며, 관계/엔티티 단위로 다른 표기법을 섞어
쓰지 않는다.

리소스 문자열(`[IDD_COLOR_RELATION]` 다이얼로그, `EnEnvironment_ENGLISH.ini`)에서 실제
라디오버튼 3개를 확인했다:

| 내부 리소스 ID | 라벨 |
| :--- | :--- |
| 9037 | Richard Barker |
| 9038 | IE (Information Engineering) |
| 9039 | IDEF1X |

**MinsDBModeler 시사점**: 지금은 Barker 표기법 전용 렌더러만 만들고 있는데, DA#처럼 "표기법은
모델의 전역 설정 하나"라는 설계를 그대로 따르면 추후 IE/크로우풋 표기 추가가 쉬워진다(개별
`BarkerMarkerFactory`를 표기법별 `MarkerFactory` 인터페이스로 일반화하는 정도로 확장 가능).

### A.3 카디널리티·옵셔널리티·식별관계 — 저장되는 것과 "매번 계산되는 것"

이전 `DA#_파일포맷_분석.md`에서 미확정으로 남겼던 부분이 이번 조사로 거의 다 풀렸다.

**(1) 확정: `CEnRelation`에는 "카디널리티"라는 이름의 필드가 없다.** 대신 두 개의 서로 다른
enum이 있다(Export 시그니처로 확정):

- `CEnRelation::GetRelType()/SetRelType(GlobalEnum::_eRelVirtualType)` — 관계가 **실제
  FK를 만드는 관계인지(Real) / 화면에만 보이는 가상 관계인지(Pseudo/Virtual)** 를 나타내는
  분류다. 카디널리티가 아니다. (이전 문서의 "RelType이 카디널리티를 담을 수도 있다"는 추정은
  틀렸음을 정정한다.)
- `CEnRelation::GetLineType()/SetLineType(GlobalEnum::_eLineType)` — **실제 카디널리티+
  필수여부+식별여부를 한 번에 나타내는 하나의 enum**이다. `CEnModel::CreateRelation(...,
  _eLineType lineType, ...)`처럼 관계를 만들 때 이 enum 하나를 바로 지정한다. 리소스 문자열
  (`EnFrames_ENGLISH.ini`)에서 실제 값 전부를 확인했다 — **툴바에 7개의 "관계선 그리기" 버튼이
  있고, 각 버튼이 `_eLineType`의 값 하나에 대응**한다:

  | 버튼 라벨 | 의미 |
  | :--- | :--- |
  | 1:M Optional | 1:다, 비식별, 자식쪽 선택 |
  | 1:M Mandatory | 1:다, 비식별, 자식쪽 필수 |
  | 1:M Identify | 1:다, **식별** 관계 |
  | M:M | 다:다 (내부적으로 교차 엔티티로 분해되는 것으로 추정) |
  | 1:1 Mandatory | 1:1, 비식별, 필수 |
  | 1:1 Identify | 1:1, **식별** 관계 |
  | 1:M Pseudo | 1:다, 가상(FK 미생성) 관계 — `_eRelVirtualType`과 연동 |

  (주의: "1:1 Optional"에 대응하는 툴바 버튼은 없다 — DA#는 이 조합을 빠른 그리기 메뉴에 넣지
  않았고, 속성 그리드에서 개별 조정하는 쪍으로 처리하는 것으로 보인다.)

**(2) 확정: 관계의 "선택성(옵셔널리티)"은 관계 자체가 아니라 FK 속성에서 유도된다.**
`IEnDiagram::IsEntityAttrChildOptionalByRef(entityId, attrId)` /
`SetEntityAttrChildAsOptionalByRef(entityId, attrId, bool, ...)` — 디컴파일 결과, 이 두
함수는 다이어그램 레이어에서 "이 자식 속성이 선택(옵션)인가"를 **엔티티+속성 쌍을 키로 삼아**
직접 묻고 설정한다. 즉 Barker의 동그라미/바(선택/필수) 표기는 **관계 레코드가 아니라, 그 관계가
만든 FK 속성 하나하나에 붙는 성질**이다. 이는 Barker 표기법의 교과서적 정의(선택성은 "많은 쪽"
끝에, 그 끝의 참여 조건으로 표시)와 정확히 일치한다.

**(3) 확정: 카디널리티/필수여부를 다이어그램에 반영하는 변환 함수가 실제로 존재한다.**
`CEnDrawItemData::ConvRelInfoToDrawItem(CEnRelation*, E_LINE_MULTICHILD&, E_LINE_MANDATORY&)`
— **논리 모델의 `CEnRelation`을 받아서, 다이어그램이 그릴 두 개의 불리언형 enum
(`E_LINE_MULTICHILD`=다자쪽 여부, `E_LINE_MANDATORY`=필수 여부)으로 변환**하는 함수가 Export
테이블에 정확한 시그니처로 남아 있다. 즉 DA#의 파이프라인은:

```
CEnRelation(_eLineType, FK 속성의 NotNull)
   └─[ConvRelInfoToDrawItem]→ (E_LINE_MULTICHILD, E_LINE_MANDATORY)  ← 다이어그램 레이어 전용 캐시값
        └─ CEnErdRelation / tagErdRelationData 에 저장 → 화면에 까마귀발/원/바로 렌더
```

**MinsDBModeler 시사점 (남은 작업 6과 연결)**:
- 관계 객체에 "카디널리티"와 "선택성"을 둘 다 저장하지 말고, DA#처럼 **"관계 하나를 정의하는
  단일 분류값(1:M-Identify, 1:1-Mandatory 등 7종)" + "FK 속성의 required 플래그에서 선택성을
  매번 파생"** 하는 2단 구조로 가면 데이터 불일치(예: 관계는 Mandatory인데 속성은 nullable)가
  구조적으로 불가능해진다.
- "식별 관계"는 `_eLineType` 값 자체에 포함되는 **관계의 1급 속성**이지, 렌더링 시점에 추론하는
  부가 정보가 아니다 — `relationshipDiscovery.ts`가 FK로부터 관계를 역추론할 때도 식별/비식별을
  관계의 핵심 속성으로 먼저 결정하고, 카디널리티·선택성은 그 결정에 종속시키는 순서를 권장한다.
- `_eRelVirtualType`(Real/Pseudo)은 지금 모델에 없는 개념이다 — "그려지지만 FK를 만들지 않는
  주석용 관계선"이 필요해지면(예: 업무규칙 설명용) 참고할 수 있는 선례다.

### A.4 자동 배치 + 관계선 라우팅/포트 슬롯팅 — `EnAutoLayout.dll`

이 DLL은 15개의 **C 스타일 플랫 함수**만 export한다(C++ 클래스가 아니라 독립 엔진으로 분리돼
있음). 함수 시그니처만으로 아키텍처 전체가 드러난다(디컴파일 불필요):

| 함수 | 역할 |
| :--- | :--- |
| `CreateAutoLayoutInstance(id)` / `DestroyAutoLayoutInstance(id)` | 문자열 id로 식별되는 배치 엔진 인스턴스 생성/소멸 (다이어그램마다 독립 실행 가능) |
| `InitAutoLayout(id, origin, size, Map<nodeId,RECT> 현재박스, MultiMap<nodeId,(targetId,edgeId)> 그래프엣지, flags, 커스텀정렬콜백)` | 레이아웃 입력 전체를 한 번에 주입 — **노드 좌표(RECT)와 그래프 토폴로지(엣지)가 완전히 분리된 입력** |
| `InitBaseRect(ids)` / `InitPinnedRect(ids)` / `AddPin(ids)` / `RemovePin(ids)` | 자동배치 대상(Base)과 **고정(Pinned, 사용자가 직접 옮긴 노드는 재배치 제외)** 노드를 구분 |
| `BuildHTreeLayout(id, case)` / `BuildLayeredTreeLayout(id, case)` / `BuildRadialLayout(id, case)` / `BuildGatheredChildLayout(id, case)` | 4종 배치 알고리즘(수평트리/계층트리(Sugiyama류)/방사형/자식모으기) |
| `OptimizeLinePosition(id)` | **노드 배치가 끝난 뒤 별도 단계로, 모든 관계선의 부착점(포트)을 충돌 없이 재계산** — "관계선 회피"는 노드 배치와 독립된 2차 패스임 |
| `GetLayoutResult(id)` → `Map<nodeId,RECT>` / `GetLayoutLineResult(id)` → `Map<lineId,tagLINEATTACH>` | 최종 노드 좌표와, 선마다의 부착정보(`EnAutoLayout::tagLINEATTACH`)를 각각 꺼내옴 |
| `SetAutoLayoutSort(id, 비교콜백)` | 형제 노드 정렬 순서를 사용자 콜백으로 커스터마이즈 |

`EnDiagram.dll` 쪽에서 이 결과를 받아 반영하는 지점도 디컴파일로 확인했다:
- `IEnPage::SetLineAttach(lineId, Map<lineId,tagLINEATTACH>, vector<RECT> 장애물목록, ...)` —
  `EnAutoLayout`이 계산한 부착정보 **묶음을 장애물 사각형 리스트와 함께** 페이지에 한 번에
  반영한다(장애물 목록을 같이 넘기는 것으로 보아, 반영 시점에 추가 보정이 한 번 더 일어날 수
  있음).
- `IEnPage::GetAdjustAttachResult[Directly](entityIdA, entityIdB, 후보점, out 변, out 슬롯)` —
  **사용자가 선을 드래그해서 새 지점에 놓으면, 그 점이 어느 변(상/하/좌/우)의 몇 번 슬롯에
  스냅되는지를 되돌려주는 요청-응답 함수**. 포트 슬롯팅의 실체가 바로 이것이다.
- `IEnCanvas::UpdateAllRelationAttachment()` — 전체 다이어그램의 관계선 부착점을 한 번에
  재계산(리소스 문자열의 "Relayout all relation line" 명령과 일치).
- 위 Set* 계열 함수들은 전부 **먼저 undo/redo용 `CActionBase` 커맨드 객체를 만들어 액션
  리스트에 쌓고, 그 다음 실제 작업 함수를 호출**하는 동일한 패턴이었다(디컴파일로 확인) — DA#의
  모든 다이어그램 편집은 Command 패턴 기반 Undo/Redo로 통일돼 있다.

**MinsDBModeler 시사점 (남은 작업 3과 직결)**:
1. "노드 배치"와 "관계선 포트 슬롯팅"을 **완전히 분리된 2단계**로 만들 것 — 지금의
   `OrthogonalEdgeRouter`가 노드 위치까지 같이 알고 있다면, DA#처럼 (a) 노드 RECT 맵 (b) 장애물
   RECT 목록 (c) 선 연결 토폴로지, 이 세 가지만 입력받는 순수 라우팅 함수로 쪼개는 편이 테스트와
   유지보수에 유리하다.
2. **고정(Pinned) 노드 개념**을 추가하면 "사용자가 옮긴 엔티티는 자동배치가 건드리지 않는다"는
   DA#의 UX를 재현할 수 있다.
3. 드래그 중 실시간 스냅을 구현한다면 `GetAdjustAttachResult`처럼 "후보점 → {변, 슬롯}" 요청-
   응답 형태의 순수 함수로 분리해 두면 드래그 프리뷰와 최종 커밋 로직을 공유하기 쉽다.
4. Undo/Redo가 필요해지면 모든 다이어그램 mutate 함수를 "커맨드 객체 생성 → 실행 → 액션 스택
   push"로 통일하는 DA#식 패턴을 그대로 쓸 수 있다.

### A.5 서브타입 세트 — "Inclusive/Exclusive"가 맞는 용어 (정정)

`CEnSubset::GetInclusive()/SetInclusive(bool)` (Export로 bool 확정)과 리소스 문자열의
"Inclusive"/"Exclusive Combine"/"Inclusive Combine" 라벨을 대조한 결과, 이전 파일포맷
문서에서 "total/partial(전체포함/부분포함)"로 추정했던 플래그는 실제로는 **"Inclusive(포괄,
한 슈퍼타입 인스턴스가 여러 서브타입에 동시에 속할 수 있음=중복 허용)" vs 그 반대인
"Exclusive(배타, 한 번에 하나의 서브타입에만 속함=디스조인트)"** 를 뜻하는 것으로 정정한다.
(`CEnSubset::GetState()/SetState(int)`는 별개의 정수 플래그이며 어떤 명명된 enum도 쓰지 않아,
disjoint/overlap과는 무관한 단순 상태값으로 보인다 — 바이트 의미는 미확정.)

**MinsDBModeler 시사점**: `subtype_sets`의 플래그 이름/의미를 "total/partial"이 아니라
"inclusive/exclusive(겹침 허용 여부)"로 재정의할 것. Barker 표기법에서 서브타입 세트의 핵심
질문은 "슈퍼타입 인스턴스가 서브타입 중 정확히 하나에만 속하는가(배타) 아니면 여러 개에 동시에
속할 수 있는가(포괄)"이며, "전체 포함 여부(모든 인스턴스가 서브타입을 가져야 하는가)"는 DA#
기준으로는 다른 개념(현재 조사에서는 못 찾음, 후속 과제)이다.

### A.6 특수 엔티티/관계 종류

리소스 문자열에서 DA#가 구분하는 엔티티·관계 변종을 확인했다(단순 Entity/Relation 외):

- **엔티티**: Normal(일반) / Pseudo(가상) / External(외부 참조) / Drop(삭제됨 표시) /
  Additional(Clone, 복제) — `[IDD_COLOR_ENTITYEX]` 색상 설정 다이얼로그에서 각각 별도 색상을
  지정할 수 있다.
- **관계**: A.3의 7종 `_eLineType` 외에, **배타적 관계(Exclusive Arc)** 는
  `CEnRelExclusive`/`CEnErdExclusiveRelation`이라는 완전히 별도 클래스로 관리되고
  (`AddCrossingRelation`/`GetCrossingRelCount`로 묶음 관리), 다이어그램에서는
  `SetDefItemErdExclusiveRelPenType(id, E_PEN_TYPE, ...)`로 **펜 스타일(실선/점선)을 배타
  관계 그룹 단위로 별도 지정**한다 — 즉 "배타 관계는 보통 점선으로 그린다" 같은 통칙이 아니라
  명시적 설정값이다.
- **관계 이름(역할구문) 배치**: `SetErdRelationTitlePosition` / `...ParentVerbPosition` /
  `...ChildVerbPosition`이 각각 독립 함수로 존재 — 관계 이름표의 "제목/부모측 동사구/자식측
  동사구" 3부분이 **서로 다른 위치 설정을 가질 수 있다**(`E_RELATIONNAME_POSITION`).
  `GetErdRelationTitleDirection`/`SetErdRelationTitleDirection(..., E_RELATIONNAME_DIRECTION,
  tagRECT 텍스트영역, ...)`는 관계별로 라벨 방향까지 따로 저장한다.

**MinsDBModeler 시사점**: 관계 라벨(역할명)을 지금처럼 한 묶음으로 배치하기보다, DA#처럼
제목/부모측 동사구/자식측 동사구를 독립적으로 위치 조정할 수 있게 하면 복잡한 다이어그램에서
라벨 겹침을 사용자가 직접 풀 수 있는 여지가 생긴다. "External/Drop/Pseudo 엔티티"는 현재 모델엔
없는 개념이지만, 물리 리버스엔지니어링·형상관리 기능을 넣게 되면 참고할 선례다.

### A.7 환경 참고: Ghidra 설치 정보

이번 조사를 위해 로컬에 다음을 설치했다(반복 조사 시 참고):

- Ghidra 12.1.4 → `D:\tools\ghidra_12.1.4_PUBLIC` (환경변수 `GHIDRA_INSTALL_DIR`)
- Eclipse Temurin JDK 21.0.13 (zip, 설치형 MSI는 UAC 승인 환경이 아니라 실패) →
  `D:\tools\jdk-21.0.13+9` (환경변수 `JAVA_HOME`)
- 헤드리스 디컴파일 스크립트는 **Java**로 작성(`test/da_format_re/ghidra_scripts/
  DecompileTargets.java`) — Ghidra 12부터 레거시 Jython(.py) 스크립트 엔진이 빠져 PyGhidra
  없이는 `.py` 포스트스크립트가 동작하지 않는다.
- `analyzeHeadless.bat`에 경로를 직접 넘길 때 `Program Files (x86)` 같은 괄호가 든 경로는
  배치 파서가 깨뜨린다 — 대상 DLL을 괄호 없는 경로로 복사한 뒤 분석했다.
