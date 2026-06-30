# Barker 모델러 개발 방향

## 1. 배경

QVI/vLEI 포탈의 논리 모델을 작성하면서 Oracle SQL Developer Data Modeler와 Mermaid를 검토했다.

Oracle Data Modeler는 Barker 표기법에 가깝게 슈퍼타입 내부에 서브타입을 표현할 수 있지만, 작업 UX가 무겁고 반복 수정이 불편하다. Mermaid는 Markdown 문서와 Git 관리에는 좋지만, Barker 표기법의 핵심인 서브타입 내부 박스 표현이 어렵다.

Barker식 논리 모델링 도구를 별도 개발한다.

## 2. 목표

단순 ERD 도구가 아니라 다음 기능을 함께 제공하는 전문 모델링 도구를 만든다.

1. Barker 스타일 논리 모델 작성
2. 슈퍼타입 내부 서브타입 표현
3. 표준용어, 표준속성, 표준도메인, 표준코드 관리
4. 업무규칙과 엔터티/속성/관계 연결
5. 논리 모델에서 물리 모델 산출
6. Oracle DDL, PostgreSQL DDL, Prisma schema, DBML 생성
7. YAML/JSON 기반 저장으로 Git diff 가능
8. SVG/PNG/PDF 모델 다이어그램 export
9. 다이어그램 편집 결과를 YAML에 즉시 반영하는 양방향 모델링
10. GUI 화면으로 다이어그램을 그리고, 저장 방식은 YAML로 저장
10. YAML 직접 수정할 경우 다이어그램에 다시 반영하는 round-trip 모델링

## 4. 핵심 차별점

기존 범용 ERD 도구와의 차별점은 다음이다.

| 항목 | 기존 도구 | 목표 모델러 |
| --- | --- | --- |
| Barker 서브타입 | 제한적 또는 불편 | 슈퍼타입 내부 박스 중심 |
| 표준용어 관리 | 별도 관리 필요 | 모델과 통합 |
| 표준도메인 관리 | 일부 지원 | 속성 정의와 강제 연결 |
| 표준코드 관리 | 별도 문서 또는 DB | 모델에서 정의 및 검증 |
| 업무규칙 | 주석 수준 | 1급 모델 요소 |
| 산출물 | 그림/DDL 중심 | 논리 모델, 물리 모델, DDL, Prisma, 문서 |
| 저장 형식 | 벤더 포맷 | YAML/JSON + Git |

## 5. 내부 메타모델 초안

모델러의 핵심은 그림 편집기가 아니라 메타모델이다.

```text
Model
 ├─ SubjectArea
 ├─ Diagram
 │   ├─ DiagramObject
 │   └─ DiagramConnector
 ├─ Entity
 │   ├─ Attribute
 │   ├─ Identifier
 │   └─ SubtypeSet
 ├─ Relationship
 ├─ StandardTerm
 ├─ StandardAttribute
 ├─ StandardDomain
 ├─ StandardCode
 └─ BusinessRule
```

### 5.1 Entity

엔터티는 논리 모델의 기본 단위이다.

주요 속성:

- 엔터티명
- 엔터티유형: 일반, 슈퍼타입, 서브타입
- 설명
- 식별자
- 속성 목록
- 상위 슈퍼타입
- 서브타입 집합
- 관련 업무규칙

### 5.2 Attribute

속성은 반드시 표준속성 또는 표준용어 후보와 연결한다.

주요 속성:

- 속성명
- 표준도메인
- 필수 여부
- 식별자 여부
- 코드 여부
- 기본값
- 설명

### 5.3 SubtypeSet

Barker 모델링에서 중요한 요소이다.

주요 속성:

- 서브타입 집합명
- 구분자 속성
- 배타 여부
- 전체 여부
- 서브타입 목록

### 5.4 Relationship

엔터티 간 관계이다.

주요 속성:

- 관계명
- 부모 엔터티
- 자식 엔터티
- 부모/자식 선택성
- 카디널리티
- 식별 관계 여부
- 부모 쪽 endpoint 표기
- 자식 쪽 endpoint 표기
- 관계선 라우팅 정보
- 설명

관계에는 다음 값을 명시적으로 가진다.

| 속성 | 예 | 설명 |
| --- | --- | --- |
| cardinality | `one_to_one`, `one_to_many` | 1:1, 1:M 등 |
| parent_participation | `0..1`, `1..1`, `0..M`, `1..M` | 부모 인스턴스가 자식 관계에 참여하는 최소/최대 수 |
| child_participation | `0..1`, `1..1`, `0..M`, `1..M` | 자식 인스턴스가 부모 관계에 참여하는 최소/최대 수 |
| identifying | `true`, `false` | 부모 FK가 자식 PK에 포함되는지 여부 |
| fk_attributes | `[이용자번호]` | 자식 엔터티의 FK 속성 |
| source_port / target_port | `right`, `left` | 다이어그램 연결 포트 |
| routing | orthogonal/polyline | 관계선 라우팅 방식 |

### 5.5 Diagram

다이어그램은 모델의 시각 표현이다. 엔터티와 관계의 업무 의미는 `Entity`, `Relationship`에 두고, 위치와 선 라우팅 같은 시각 정보만 `Diagram` 하위에 둔다.

주요 속성:

- 다이어그램ID
- 주제영역
- 표시 엔터티 목록
- 표시 관계 목록
- zoom, pan 기본값
- canvas 크기

### 5.6 DiagramObject

캔버스에 배치된 엔터티, 슈퍼타입 그룹, 메모, 관계표 같은 시각 오브젝트이다.

주요 속성:

- objectId
- modelRef: entityId, relationshipId, ruleId 등
- x, y, width, height
- zIndex
- collapsed 여부
- locked 여부
- selected 여부는 저장하지 않고 UI 상태로만 관리한다.

### 5.7 DiagramConnector

관계선의 시각 표현이다.

주요 속성:

- connectorId
- relationshipId
- sourceObjectId
- targetObjectId
- sourcePort
- targetPort
- waypoints
- sourceSegmentStyle
- middleSegmentStyle
- targetSegmentStyle
- sourceEndpointSymbol
- targetEndpointSymbol

### 5.8 BusinessRule

업무규칙은 모델의 1급 요소로 관리한다.

예:

- 이용자는 QVI직원 또는 회원 중 하나이다.
- 회원은 법인회원 또는 개인회원 중 하나이다.
- 법인회원의 LEI는 활성 법인회원 내에서 유일해야 한다.
- vLEI 신청의 심사자는 QVI직원 중 심사 권한을 가진 이용자여야 한다.

## 6. 기술 후보

### 6.1 Frontend

| 용도 | 후보 | 이유 |
| --- | --- | --- |
| 다이어그램 편집 | React Flow | custom node, edge, group/subflow, resize, minimap 지원 |
| 자동 배치 | ELK / elkjs | hierarchical node와 compound graph layout 지원 |
| 코드/YAML 편집 | Monaco Editor | VS Code 기반 편집 경험 |
| 문서/규칙 편집 | Tiptap 또는 Markdown editor | 업무규칙 설명 작성 |
| UI | React + Vite | 현재 vLEI workspace와 일관 |

### 6.2 Backend / Core

| 용도 | 후보 | 이유 |
| --- | --- | --- |
| 메타모델 검증 | TypeScript package | vLEI 프로젝트와 일관 |
| 모델 저장 | YAML/JSON file | Git diff와 수작업 편집 용이 |
| DDL 생성 | TypeScript generator | Oracle/Postgres 분기 가능 |
| Prisma 생성 | TypeScript generator | API 구현과 직접 연결 |
| SVG export | 자체 renderer | Barker 표기법 제어 용이 |

## 7. 패키지 구조 후보

```text
apps/modeler
  React 기반 모델링 화면

packages/model-core
  논리 모델 타입
  표준화 검증
  업무규칙 검증
  변환기 인터페이스

packages/model-renderer
  Barker SVG renderer
  PNG/PDF export helper

packages/model-generators
  Oracle DDL generator
  PostgreSQL DDL generator
  Prisma schema generator
  DBML generator

doc/DB설계/model
  YAML 원천 모델

doc/DB설계/out
  SVG/DDL 등 산출물
```

## 8. MVP 범위

MVP는 QVI 이용자 모델만 편집할 수 있으면 충분하다.

### 8.1 포함 기능

1. YAML 모델 불러오기
2. 엔터티 목록 표시
3. Barker 스타일 canvas 표시
4. 엔터티/속성 편집 패널
5. 슈퍼타입/서브타입 지정
6. 관계 추가
7. 표준도메인 선택
8. 업무규칙 목록 표시
9. YAML 저장
10. SVG export
11. 캔버스 오브젝트 선택, 이동, 크기 변경
12. 관계선 선택, 라우팅 포인트 이동, 관계 대상 변경
13. 더블클릭으로 엔터티/속성/관계 추가 및 수정
14. 까치발, 선택/필수, 식별/비식별 관계선 표현
15. YAML 직접 편집과 캔버스 편집의 round-trip 동기화
16. DDL import / export 기능

### 8.2 제외 기능

1. 다중 사용자 협업
2. DB reverse engineering
3. 실시간 Oracle Data Modeler 호환
4. 복잡한 물리 모델 튜닝
5. 권한/로그인 기능

### 8.3 필수 캔버스 편집 UX

MVP라도 단순 SVG viewer가 아니라 편집 가능한 모델러여야 한다.

필수 UX:

1. 엔터티 박스를 클릭하면 선택된다.
2. 선택된 엔터티는 드래그로 이동할 수 있다.
3. 선택된 엔터티는 resize handle로 크기를 변경할 수 있다.
4. 엔터티를 더블클릭하면 엔터티명, 설명, 엔터티 유형을 수정하는 dialog 또는 side panel을 연다.
5. 엔터티 내부 속성을 더블클릭하면 속성명, 도메인, 필수 여부, 식별자 여부, FK 여부를 수정한다.
6. 엔터티 내부 빈 영역을 더블클릭하면 새 속성을 추가한다.
7. 캔버스 빈 영역을 더블클릭하면 새 엔터티를 추가한다.
8. 관계선을 클릭하면 관계 편집 패널을 연다.
9. 관계선의 시작점 또는 끝점을 드래그하면 관계 대상 엔터티를 바꿀 수 있다.
10. 관계선의 중간 waypoint를 드래그해서 orthogonal route를 조정할 수 있다.
11. 관계선을 더블클릭하면 관계명, 역관계명, 카디널리티, 부모참여, 자식참여, 식별관계 여부를 수정한다.
12. 슈퍼타입 내부로 엔터티를 드래그하면 서브타입 후보로 지정할 수 있다.
13. 서브타입 박스를 슈퍼타입 밖으로 드래그하면 서브타입 해제 여부를 확인한다.
14. undo/redo는 MVP에 포함한다.
15. 저장 전 validation error를 캔버스와 YAML editor 양쪽에 표시한다.

### 8.4 관계선 렌더링 규칙

관계선은 Barker/IE 표기법의 의미를 손실하지 않도록 렌더링한다.

기본 원칙:

1. `identifying = true`이면 관계선의 기본 stroke는 실선이다.
2. `identifying = false`이면 관계선의 기본 stroke는 점선이다.
3. 선택/필수 참여도는 관계선의 각 endpoint 근처 segment로 표현한다.
4. 선택 참여(`0..1`, `0..M`) endpoint segment는 점선으로 표현한다.
5. 필수 참여(`1..1`, `1..M`) endpoint segment는 실선으로 표현한다.
6. 따라서 한 관계선 안에서도 한쪽은 점선, 중간은 실선, 다른 한쪽은 실선 또는 점선이 될 수 있다.
7. `M` 쪽 endpoint에는 까치발(crow's foot)을 표시한다.
8. `1` 쪽 endpoint에는 단일선 또는 short bar를 표시한다.
9. `0` 쪽 endpoint에는 circle 또는 open marker를 표시한다.
10. 1차 구현에서는 Barker식 선분 스타일과 crow's foot marker를 함께 표시하되, 옵션으로 IE marker를 끌 수 있게 한다.

참여도별 endpoint 표현:

| 참여도 | Endpoint marker | Endpoint segment |
| --- | --- | --- |
| 0..1 | circle + single bar | 점선 |
| 1..1 | single bar | 실선 |
| 0..M | circle + crow's foot | 점선 |
| 1..M | crow's foot + mandatory bar | 실선 |

선분 구성:

```text
source endpoint segment ─ middle segment ─ target endpoint segment
```

예:

- 부모참여 `0..M`, 자식참여 `1..1`, 비식별관계이면 source endpoint는 점선+까치발, middle은 점선, target endpoint는 실선+bar로 그린다.
- 부모참여 `0..M`, 자식참여 `1..1`, 식별관계이면 source endpoint는 점선+까치발, middle은 실선, target endpoint는 실선+bar로 그린다.
- 양쪽 모두 필수이면 모든 endpoint segment가 실선이다.

### 8.5 YAML과 다이어그램 동기화

모델러의 원천 저장 형식은 YAML이다. 다이어그램은 YAML의 projection이며, 편집 결과도 YAML에 반영한다.

동기화 규칙:

1. YAML load 시 `entities`, `relationships`, `subtype_sets`, `diagrams`를 파싱한다.
2. `diagrams`가 없으면 자동 레이아웃으로 초기 좌표를 생성한다.
3. 캔버스에서 엔터티를 이동하면 `DiagramObject.x/y`만 수정한다.
4. 엔터티명, 속성, 관계 의미를 수정하면 `Entity`, `Attribute`, `Relationship`을 수정한다.
5. 관계선 라우팅만 수정하면 `DiagramConnector.waypoints`만 수정한다.
6. 관계 대상 엔터티를 바꾸면 `Relationship.parent/child`와 `DiagramConnector.source/target`을 함께 수정한다.
7. YAML editor에서 직접 수정하면 debounced parse 후 캔버스를 다시 렌더링한다.
8. 파싱 실패 시 기존 캔버스 상태는 유지하고 YAML error 위치를 표시한다.
9. 저장 시 canonical formatting을 적용해 Git diff를 안정화한다.
10. 모델 의미 변경과 다이어그램 배치 변경은 가능하면 diff에서 분리되도록 YAML 섹션을 나눈다.

## 9. 1차 적용 대상

이미 작성된 QVI 이용자 모델을 1차 샘플로 사용한다.

- 원천 모델: `doc/DB설계/model/qvi-user-account-logical.yaml`
- SVG 산출물: `doc/DB설계/out/qvi-user-barker.svg`
- 설명 문서: `doc/DB설계/QVI 이용자 가입 계정 논리 모델.md`
- 작성 기준: `doc/DB설계/QVI 상세 논리 모델 작성 기준.md`

이 모델을 기준으로 다음 기능을 검증한다.

1. 이용자 슈퍼타입 내부에 QVI사업자/QVI직원/회원/외부기관 서브타입 표시
2. 회원 내부에 법인회원/개인회원 서브타입 표시
3. 개인회원 내부에 법인소속개인회원/일반개인회원 표시
4. QVI직원역할부여이력은 서브타입이 아니라 별도 엔터티 관계로 표시
5. 법인회원, 개인회원, 법인소속이력의 식별관계 표시
6. 이용자계정, 회원가입신청, 약관동의이력의 비식별 참조관계 표시
7. R001~R023 관계의 카디널리티, 참여도, 식별관계 여부 표시
8. 엔터티 이동, 관계 대상 변경, 더블클릭 편집 후 YAML 저장 검증

## 10. 후속 개발 단계

### Phase M0. 방향 정리

- 본 문서 작성


### Phase M1. 메타모델 정식화

- TypeScript 타입 정의
- YAML schema 정의
- `Diagram`, `DiagramObject`, `DiagramConnector` 타입 정의
- 표준용어/도메인/코드 구조 정의
- 검증 규칙 작성
- 관계 참여도와 endpoint marker 변환 규칙 작성

### Phase M2. SVG 자동 생성기

- YAML -> Barker SVG 생성
- nested subtype layout
- 관계선 및 Barker cardinality 표현
- 까치발, circle, mandatory bar marker 렌더링
- endpoint segment와 middle segment의 실선/점선 분리 렌더링
- 관계표 자동 생성
- CLI 명령 추가

### Phase M3. Web 모델러 MVP

- `apps/modeler` 생성
- React Flow 기반 canvas
- 엔터티 선택, 이동, resize
- 속성/엔터티/관계 더블클릭 편집
- 관계선 endpoint retarget
- 관계선 waypoint 편집
- 속성 편집 패널
- YAML import/export
- YAML editor와 canvas round-trip 동기화
- SVG export

### Phase M4. 물리 모델 생성

- Oracle DDL 생성
- PostgreSQL DDL 생성
- Prisma schema 생성
- DBML 생성

### Phase M5. 표준화 기능 강화

- 표준용어 사전
- 표준속성 사전
- 표준도메인 사전
- 표준코드 사전
- 명명 규칙 검사

## 12. 다른 세션 작업 지시 프롬프트

다른 Codex/Claude 세션에서 모델러 개발을 시작할 때는 아래 지시를 사용한다.

```text

먼저 다음 문서를 반드시 읽고 기준으로 삼아라.

1. Barker 모델러 개발 방향.md
4. doc/참고/model/qvi-user-account-logical.yaml
5. doc/참고/out/qvi-user-barker.svg

목표는 YAML <-> 다이어그램 round-trip 모델링 도구다.

필수 요구사항:

1. YAML이 논리 모델의 원천이다.
2. YAML을 읽어 Barker 스타일 다이어그램을 렌더링한다.
3. 캔버스에서 엔터티/속성/관계/위치를 편집하면 YAML에 반영한다.
4. YAML editor에서 직접 수정하면 캔버스가 다시 렌더링된다.
5. 엔터티 선택, 이동, 크기 변경을 지원한다.
6. 엔터티 더블클릭으로 엔터티명/설명/유형을 편집한다.
7. 속성 더블클릭으로 속성명/도메인/필수여부/식별자여부/FK여부를 편집한다.
8. 엔터티 내부 빈 영역 더블클릭으로 속성을 추가한다.
9. 캔버스 빈 영역 더블클릭으로 엔터티를 추가한다.
10. 관계선 선택 후 시작점/끝점을 다른 엔터티로 드래그하여 관계 대상을 변경할 수 있다.
11. 관계선 waypoint를 이동하여 라우팅을 조정할 수 있다.
12. 관계선 더블클릭으로 관계명, 역관계명, cardinality, parent_participation, child_participation, identifying을 편집한다.
13. 슈퍼타입 내부에 서브타입 박스를 표현한다.
14. 서브타입 집합의 total/disjoint와 discriminator를 모델에 보존한다.
15. 관계선에는 까치발(crow's foot), circle, mandatory bar를 표시한다.
16. 선택 참여는 endpoint segment를 점선으로 표시하고, 필수 참여는 endpoint segment를 실선으로 표시한다.
17. identifying=true이면 middle segment는 실선, identifying=false이면 middle segment는 점선으로 표시한다.
18. 따라서 한 관계선에서 한쪽 endpoint는 점선, 중간은 실선, 반대쪽 endpoint는 실선처럼 segment별 스타일이 달라질 수 있어야 한다.
19. R001~R023 관계를 샘플로 렌더링하고, SVG export 결과가 doc/DB설계/out/qvi-user-barker.svg와 의미적으로 일치해야 한다.
20. 모델 저장 시 canonical YAML formatting을 적용해 Git diff가 안정적이어야 한다.

권장 구조:

- apps/modeler: React + Vite 기반 UI
- packages/model-core: TypeScript 타입, YAML schema, validation
- packages/model-renderer: Barker/SVG renderer, marker/edge renderer
- packages/model-generators: Oracle DDL, PostgreSQL DDL, DBML, Prisma generator 후보

우선 구현 순서:

1. model-core에 TypeScript 타입과 validator 작성
2. qvi-user-account-logical.yaml loader 작성
3. DiagramObject/DiagramConnector가 없으면 자동 layout 생성
4. Barker SVG renderer 작성
5. React Flow 기반 canvas에서 엔터티 노드 렌더링
6. custom edge로 까치발/선택/필수/식별관계 렌더링
7. 선택/이동/resize/retarget/waypoint 편집 구현
8. double-click 편집 UX 구현
9. YAML editor와 canvas round-trip 동기화
10. SVG export와 validation 테스트 작성

구현 중 애매한 점은 QVI 상세 논리 모델 작성 기준.md의 관계 표기 기준을 우선한다.
```
