# DA# 5 (.dax / .damx) 파일 포맷 분석

> 목적: MinsDBModeler가 DA# 4(.dax)/DA# 5(.damx) 파일을 범용적으로(특정 샘플에 하드코딩하지 않고)
> 읽을 수 있도록, 파일에 저장된 데이터의 의미를 정리한다. DA# 실행파일의 그리기(렌더링) 코드는
> 옮겨 적지 않았고, **파일에 저장되는 데이터가 무엇을 뜻하는지**만 기술한다.
>
> 분석 대상 샘플:
> - `D:\Data\DAP\데이터와사람들\(3.고급)31. 지역커뮤니티.dax` — DA# 4 포맷
> - `D:\Data\DAP\데이터와사람들\(4.특급)43. 학사관리 시스템.damx` — DA# 5 포맷
>   (`지역커뮤니티.damx`는 원본 폴더에 존재하지 않아, 동일 폴더의 다른 과제 샘플로 대체했다.)

---

## 0. 조사 방법과 신뢰도 표기 규칙

이 환경에는 REA의 디스어셈블러/디컴파일러 provider(Ghidra, IDA, Hopper, Kuna)가 전혀 설정되어
있지 않았다(`rea doctor` 확인 결과 전부 `missing_analysis_engine`). Windows에서 Hopper는
지원되지 않고, Kuna는 PE 포맷을 지원하지 않으며, Ghidra/IDA는 별도 설치·등록이 필요해 설치하지
않았다 — 어차피 "실행파일의 렌더링 코드를 옮겨 적지 말 것"이라는 요구와도 맞지 않는 방향이라
판단했다.

대신 다음 두 가지 **합법적인 정적 조사**만으로 분석했다:

1. **설치된 DA# 5 바이너리의 스트립되지 않은 C++ 링커 심벌 이름 스캔.**
   `C:\Program Files (x86)\ENCORE\DATAWARE_DA5\DA Modeler\EnData.dll`(핵심 데이터 모델)과
   `DrawBase.dll`(레거시 도형 베이스)에는 디버그 심벌이 제거되지 않아, 클래스명과 멤버 함수명이
   그대로 문자열로 남아 있었다. 이는 코드 역컴파일이 아니라 "링커가 남긴 이름표를 읽는 것"이며,
   각 필드가 *무엇을 의미하는지* 추정하는 데만 사용했다(함수 본문은 보지 않았다/볼 수 없었다).
2. **샘플 파일 2개의 바이트 단위 직접 파싱.** 컨테이너 구조, 문자열 토큰 위치, GUID, 숫자
   필드를 오프셋 단위로 추출해 1번에서 얻은 "필드 의미 사전"과 대조했다.

아래 모든 절에는 신뢰도를 표시한다.
- **[확인]** — 샘플 파일의 바이트를 직접 읽어 반복적으로 재현되는 패턴으로 확정한 사실.
- **[추정-심벌]** — 바이너리의 함수/클래스 이름에서 유추했지만 바이트로 위치를 못박지는 못한 사실.
- **[미확정]** — 가능성 있는 해석이지만 추가 검증(디스어셈블 또는 대조 생성 테스트)이 필요한 부분.

---

## 1. 컨테이너 포맷

### 1.1 `.dax` (DA# 4 레거시) — **[확인]**

표준 **CFBF/OLE2 Compound File**(매직 `D0 CF 11 E0 A1 B1 1A E1`)이다. 디렉터리에는
`Root Entry` 외 스트림이 단 하나, 이름 `Contents` 뿐이다. 모델의 모든 데이터(헤더, 설정,
엔티티, 속성, 관계, 서브타입, 다이어그램)가 이 `Contents` 스트림 하나에 순서대로 직렬화되어
있다. FAT/디렉터리 섹터를 따라가며 `Contents` 스트림을 추출하면(기존
`daNativeParser.ts`의 `extractOleContentsOrRaw`가 이미 구현되어 있음) 내부 포맷은 1.2절과
동일한 토큰 스트림이다.

### 1.2 `.damx` (DA# 5) — **[확인]**

CFBF 매직이 없다. OLE 래퍼 없이 **원시 바이트 스트림이 파일 맨 앞부터 바로 시작**한다.
파일의 첫 4바이트는 리틀엔디안 DWORD이며(샘플에서는 `0x6E`=110), 그 직후 바로 문자열/GUID
토큰 스트림이 시작된다. 이 DWORD의 정확한 의미는 **[미확정]**이나, 값의 크기가 "모델 내
최상위 오브젝트 개수" 혹은 "직렬화 스키마 버전" 범주로 보인다.

### 1.3 전체 포함 관계(컨테인먼트) — **[추정-심벌]**

`EnData.dll`의 클래스 계층에서 파일 하나는 다음을 담는다(심벌 이름 기준):

```
CEnProject (파일)
 └─ CEnModel (모델) — GUID, 이름, 생성/수정일시, 모델 단위 설정(K_MDL_*), 대상 DBMS
     └─ CEnSubject (주제영역, Subject Area) — 여러 개 가능
         └─ CEnPane (다이어그램 캔버스; Logical/Physical 두 종류)
             ├─ CEnEntity / CEnRelation / CEnSubtype / CEnSubset 등 논리 객체
             └─ CEnDrawItemData 가 관리하는 도형(좌표/크기/선/글꼴/웨이포인트)
```

`.dax`/`.damx` 모두 보통 모델 1개, 서브젝트 1개를 담는 단순한 파일이라 이 계층이 평탄하게
보이지만, 토큰 스트림상에는 이 계층 순서(Project→Model→Subject→Pane→Objects)가 그대로
반영되어 있다.

---

## 2. 직렬화 기본 단위 (MFC `CArchive` 기반)

DA# 5는 MFC(`mfc120u.dll`, `mfc140u.dll`에 링크)로 작성되었고, 클래스 전부가 `CObject`를
상속하며 표준 `Serialize(CArchive&)` 패턴을 쓴다(`EnData.dll` 심벌에 모든 `CEnXxx` 클래스마다
`Serialize`, `GetRuntimeClass`, `CreateObject`가 존재 — MFC `IMPLEMENT_SERIAL` 매크로의
전형적 산물). 이는 DA#의 고유 설계가 아니라 **MFC 프레임워크의 공개된 표준 동작**이므로,
파서를 만들 때 아래 두 가지를 구분해서 처리해야 한다.

### 2.1 문자열(CString) 토큰 — **[확인]**

유니코드 빌드 MFC의 `CString::Serialize`가 쓰는 길이-프리픽스 형식 그대로다:

```
FF FE FF <len:1byte>            len < 0xFF 인 경우, 그 뒤 len*2 바이트 UTF-16LE
FF FE FF FF <len:2byte LE>      len >= 0xFF 인 경우 (255자 이상)
```

본문은 UTF-16LE. 빈 문자열(`len=0`)도 매우 자주 등장하며, 이는 실제로 "값 없음"을 뜻하는
정상적인 필드(마커만 4바이트 소비)다. 기존 `daNativeParser.ts`가 이 패턴을 이미 올바르게
인식하고 있다.

### 2.2 오브젝트 포인터(`CObject*`) 직렬화 오버헤드 — **[확인 + 추정-심벌]**

문자열/GUID 토큰 사이사이에 등장하는 `FF FF FF FF FF FF FF FF`, `0x8000` 비트가 섞인
워드/더블워드, 작은 증가 카운터들은 **모델 데이터가 아니라 MFC `CArchive`가 포인터 멤버
(`CEnAttribute::GetDomainObject()`, `GetEntity()`, `CEnIndex::GetTable()` 같은 `CObject*`
필드)를 직렬화할 때 쓰는 프레임워크 자체의 북키핑**이다 — 처음 등장하는 런타임 클래스의
스키마 테이블, 이미 쓰인 오브젝트에 대한 참조 태그, min/max/default 같이 "설정 안 됨"을 뜻하는
`0xFFFFFFFF` 센티널 등이 섞여 있다. 정확한 바이트 수는 필드마다(포인터가 가리키는 객체 그래프
구조에 따라) 달라지므로, **완전히 일반적인 파서를 만들려면 이 오버헤드를 전부 스킵하는 로직이
아니라 MFC의 오브젝트 테이블 규칙 자체를 구현해야 한다** — 지금의 토큰 스크래핑 방식(문자열/GUID
만 모으고 나머지는 통과)이 "우연히" 동작했던 이유가 바로 이 오버헤드 바이트들이 토큰 마커(`FF FE
FF`)와 혼동되지 않기 때문이다. 다만 이 방식은 숫자 필드(타입, 길이, PK/FK 플래그, 카디널리티
등)를 전혀 읽지 못한다는 한계가 있다(§6, §9 참고).

### 2.3 객체 식별자: GUID 문자열 — **[확인]**

`CEnModel`부터 `CEnEntity`, `CEnAttribute`, `CEnRelation`, `CEnDomain`, `CEnSubtype` 등
거의 모든 논리 객체는 자신의 PK로 **36자 표준 GUID 문자열**(위 §2.1 포맷으로 직렬화)을 갖는다.
부모/소유자/참조 관계는 전부 이 GUID 값을 통해 이루어지며, 파일 내 바이트 오프셋이나 포인터가
아니라 **값 기반 참조**다 — 따라서 모델 전체를 2-pass로 파싱(1차: 모든 GUID→이름/객체 매핑 수집,
2차: 참조 필드를 GUID로 조회해 연결)하는 전략이 유효하다(기존 코드가 이미 이렇게 하고 있다).

오브젝트 헤더는 거의 항상 다음 순서로 나타난다:

```
[자기 자신의 GUID] [소유자/참조 GUID (최상위 객체는 자기 GUID와 동일)] ... [이름 문자열]
```

예) 모델 자신은 소유자가 없으므로 "자기 GUID"가 두 번 반복해서 나온다(§4.1). 서브젝트에 속한
도메인/엔티티는 두 번째 GUID가 자신과 다른 값(소유 주체의 GUID)으로 나타난다.

---

## 3. `.dax`(DA# 4)와 `.damx`(DA# 5)의 구조적 차이 — **[확인]**

| | `.dax` (DA# 4) | `.damx` (DA# 5) |
|---|---|---|
| 컨테이너 | CFBF/OLE2, `Contents` 스트림 | 래퍼 없음, 파일 맨 앞부터 원시 스트림 |
| 엔티티 블록 경계 | 리터럴 ASCII 태그 `PROPS` ~ `KEYGRPCNT`로 명시적으로 구획됨(§6.1) | 그런 리터럴 태그가 전혀 없음(`PROPS`/`KEYGRPCNT` 0건 확인) — 순수 GUID+이름+숫자필드로만 구성된, 더 촘촘한 MFC 오브젝트 그래프 직렬화 |
| 엔티티 헤더 뒤 보조 섹션 | `ALTNAME`/`SYNONYM`/`BUILD_PROPS`/`RANKSQUE` 리터럴 섹션이 고정 순서로 존재 | 해당 리터럴 섹션 없음(같은 정보가 있다면 이름 없는 고정폭 필드로 추정, 미확정) |
| 생성/수정일시 | 모델 헤더에서 확인(§4.1) | 모델뿐 아니라 **엔티티 단위**에서도 확인(§6.2) — 더 세분화된 변경 추적 |

즉 DA# 4는 (구버전답게) 사람이 읽을 수 있는 리터럴 태그로 레코드 경계를 표시하는 "반(半)
자기서술적" 포맷이고, DA# 5는 리터럴 태그를 걷어내고 MFC 오브젝트 직렬화에 더 가깝게 바뀐
포맷이다. **두 포맷을 하나의 파서로 다루려면 "PROPS/KEYGRPCNT 존재 여부"로 분기하는 기존 코드의
전략이 여전히 올바른 1차 분기 기준**이다.

---

## 4. 모델 헤더 / 모델 단위 설정

### 4.1 모델 헤더 — **[확인]** (두 샘플 모두 동일 패턴)

파일(또는 `Contents` 스트림) 맨 앞부분:

```
[모델 GUID] [동일한 모델 GUID] [모델명 문자열]
<DWORD 카운트/플래그류>
<8바이트 DOUBLE: 생성일시로 추정 — OLE Automation DATE, 1899-12-30 기준 일수.소수부=시각>
<8바이트 DOUBLE: 수정일시로 추정, 생성일시와 같은 가족 포맷>
<DWORD, DWORD: 추가 카운트/플래그, 미확정>
```

`.damx` 샘플에서는 모델명 문자열이 **파일명(확장자 제외)과 정확히 일치**했다(`(4.특급)43.
학사관리 시스템`) — 즉 모델 내부에도 사람이 지정한 모델명이 별도로 저장되며, 보통 저장 시
파일명과 동기화된다.

### 4.2 모델 단위 On/Off 설정 테이블 — **[확인]**

모델 헤더 직후, `K_MDL_`/`K_STD_` 로 시작하는 **리터럴 설정 키 이름**들이 다음 형태로
반복된다:

```
[DWORD 플래그(0/1로 보임)] [설정 키 이름 문자열]
```

두 샘플에서 공통으로 확인된 키: `K_MDL_CREAT_ONLY_PHY`, `K_MDL_INHERIT_PSEUDO_ATTR`,
`K_MDL_PK_ORD_SYNC`, `K_MDL_USE_NONE_STD_TERM`, `K_STD_SYNC_OPTION`. 이름으로 보아 "물리
모델만 생성", "가상/파생 속성 상속 여부", "PK 순서 동기화", "표준 용어 미사용 허용", "표준
동기화 옵션" 같은 모델 환경설정 토글이다 — 모델의 엔티티/관계 데이터와는 무관하므로, 파서는
이 구간을 (존재하는 키 이름들을 그대로) 건너뛰어도 안전하다.

이어서 모델 기본값 리터럴들이 나온다: 기본 모델명 상수 `"새모델"`과 대상 DBMS 이름 문자열
(`ORACLE`, `TIBERO`, `MYSQL`, `POSTGRESQL` 등 — 샘플엔 `ORACLE`). 기존 코드의 ignore 리스트에
있던 문자열들이 바로 여기서 나온다.

---

## 5. 식별자(GUID) 참조 방식 — **[확인]**

모든 상호참조(관계의 부모/자식 엔티티, 서브타입의 상위타입, 속성의 도메인, 인덱스의 테이블 등)는
**36자 GUID 문자열 값**으로 이루어진다. 파일 내에는 "GUID → 사람이 읽는 이름"의 명시적 매핑
테이블은 따로 없고, 각 객체가 자기 자신의 레코드에서 `[GUID][...][이름]`을 함께 저장하므로,
파서는 전체 스트림을 한 번 훑어 `GUID → (타입, 이름)` 딕셔너리를 만든 뒤, 참조 필드에 나오는
GUID를 이 딕셔너리로 치환해야 한다(기존 `daNativeParser.ts`의 1단계 방식과 동일한 전략이
맞다).

---

## 6. 엔티티 레코드 (`CEnEntity` / `CEnEntityBase`)

### 6.1 `.dax`(DA# 4): 리터럴 태그 기반 블록 — **[확인]**

```
[EntityID GUID] [OwnerSubjectID GUID]
... (숫자 필드들, 미확정)
"PROPS"
<엔티티명 문자열>
  <속성 레코드> × N   (§7)
"ALTNAME"   <영문 별칭 문자열, 보통 빈 문자열>
"SYNONYM"   <동의어 문자열, 보통 빈 문자열>
[DWORD]  "BUILD_PROPS"
[DWORD]  "RANKSQUE"
[DWORD]  "KEYGRPCNT"   ← 이 엔티티의 키그룹(PK/AK) 개수
```

`ALTNAME`→`SYNONYM`→`BUILD_PROPS`→`RANKSQUE`→`KEYGRPCNT` 순서는 샘플 파일의 모든 엔티티에서
예외 없이 동일했다 — 엔티티 레코드의 **고정 트레일러**로 간주해도 된다. `EntityID`+
`OwnerSubjectID` 헤더 부분의 바이트 길이도 모든 엔티티에서 동일(166바이트)해, 엔티티 헤더가
고정 크기 구조체라는 뜻이다.

`CEnEntityBase`의 심벌 이름(`GetOwnerSubjectID`/`SetOwnerSubjectID`, `GetRank`/`SetRank`,
`GetLevel`/`SetLevel`, `GetAltName`, `GetSynonym`)이 위 필드들과 대응된다 — **[추정-심벌]**.

### 6.2 `.damx`(DA# 5): 태그 없는 헤더 — **[확인]**

```
[EntityID GUID] [동일한 GUID 반복]
<엔티티명 문자열>
[DWORD: 레코드 크기/카운트로 추정]
<8바이트 DOUBLE: 생성일시>
<8바이트 DOUBLE: 수정일시>
[DWORD, DWORD: 플래그]
```

DA# 5는 `PROPS` 리터럴이 없는 대신, 모델 헤더와 완전히 동일한 모양의 "생성/수정일시" 쌍을
엔티티 단위로도 갖는다 — 이는 **엔티티 수준의 변경이력 추적이 DA# 4보다 세밀해졌음**을
시사한다.

### 6.3 PK 키그룹의 특수 이름 — **[확인]**

엔티티의 기본 키(Primary Key) 키그룹은 리터럴 이름 `"PrimaryKey"`로 식별된다(`CEnEntity::
AddPrimaryKey`, `CEnKeyGroup::GetKeyKind`). 즉 "이 엔티티의 식별자가 무엇인가"는 이름이
`PrimaryKey`인 키그룹에 속한 속성 목록을 보면 된다(§8).

---

## 7. 속성 레코드 (`CEnAttribute` / `CEnAttributeBase`)

### 7.1 관찰된 바이트 구조 — **[확인 + 미확정 혼합]**

```
[AttributeID GUID]
[GUID #2]           ← 도메인(Domain) 또는 타입 연결로 추정 — [미확정]
[GUID #3]           ← 추가 연결(예: 공유/소스 테이블) 추정 — [미확정]
<약 56바이트, 대부분 0xFFFFFFFF>   ← min/max/default 미설정 센티널로 추정 — [미확정]
<약 56바이트, 숫자 필드 모음: 타입코드, 길이, 자리수, 순서, 플래그 등> ← [미확정]
<속성명 문자열>
```

같은 엔티티 안에서 PK가 아닌 속성들은 이 블록이 거의 동일한 바이트 길이(140바이트 전후)로
반복됐다 — 고정폭 레코드임은 확실하나, 56바이트 숫자 블록 안의 **정확한 필드 순서(어느
DWORD가 타입코드이고 어느 것이 길이인지)는 바이트만으로 100% 확정하지 못했다.**

### 7.2 필드 의미 사전 — **[추정-심벌]**

`CEnAttributeBase`의 접근자 이름으로 볼 때, 위 숫자 블록은 다음 정보를 담고 있을 것으로
추정된다:

- `IsPK`/`SetPK`, `IsFK`/`SetFK` — 식별자/외래키 여부 플래그
- `IsNotNull`/`SetNotNull` — 필수(NOT NULL) 여부. **DA#/Barker 표기 관례상, 관계의
  "옵셔널리티"는 이 자식쪽 FK 속성의 NotNull 값에서 유도되는 것으로 보인다**(§9.3 참고 —
  관계 레코드 자체에서 별도의 "Mandatory/Optional" 이름의 필드를 찾지 못했다).
- `GetColType`/`SetColType`, `GetColLen`/`SetColLen`, `GetColScale`/`SetColScale` — 데이터
  타입, 길이, 소수 자리수
- `GetOrder`/`SetOrder` — 엔티티 내 속성 순서(화면/DDL 출력 순서)
- `GetAltName`/`SetAltName`, `GetAttrNote`/`SetAttrNote`, `GetSynonym`/`SetSynonym` — 영문
  별칭, 비고, 동의어
- `GetDomainObject`/`SetDomainLink`, `GetTermObject`/`SetTermLink` — 표준 도메인/표준 용어
  사전과의 연결(§7.1의 GUID #2, #3과 대응될 가능성이 높음)
- `IsUniqueKey`, `IsEncryption`/`GetEncryptionMethod`, `GetPrivacyGrade`/`GetPrivacyType` —
  고유키, 암호화, 개인정보 등급 플래그(모두 부가 속성, 샘플에선 대부분 비활성)

### 7.3 `.dax` 전용 보조 문자열 섹션 — **[추정-심벌]**

§6.1에서 본 엔티티 트레일러의 `ALTNAME`/`SYNONYM`은 엔티티 자체의 별칭/동의어이지만, 속성
레벨에도 `GetAltName`/`GetSynonym` 접근자가 동일하게 존재해, 속성별로도 별도의 (대개 빈)
별칭/동의어 문자열이 저장될 수 있음을 시사한다 — 샘플에서는 대부분 빈 문자열이라 레코드 경계
식별에만 쓰였다.

---

## 8. 식별자(키그룹) 레코드 (`CEnKeyGroup` / `CEnIndex`)

- **[확인]** PK 키그룹의 이름은 리터럴 `"PrimaryKey"`로 고정(§6.3).
- **[추정-심벌]** `CEnKeyGroup`은 `GetKeyKind`/`SetKeyKind`(PK/AK 종류), `GetKeyType`/
  `SetKeyType`, 그리고 `GetAttributeAll`/`AddAttribute`로 참조하는 **소속 속성 GUID 목록**을
  갖는다. 즉 "이 엔티티의 식별자가 몇 개 속성으로 구성되는가"는 키그룹 레코드 안의 속성
  GUID 리스트 개수로 결정된다(복합키 지원).
- **[확인]** 엔티티 트레일러의 `KEYGRPCNT` 필드(DA# 4)가 해당 엔티티에 속한 키그룹의
  **개수**를 담고 있다(값이 거의 항상 `1` — PK 하나만 있는 전형적인 엔티티).
- **[미확정]** `RANKSQUE`(순위 큐)가 정확히 무엇을 저장하는지는 확정하지 못했다. 이름으로
  보아 속성/키 순서 재배열에 쓰이는 보조 큐로 추정된다.
- `CEnIndex`는 키그룹과 별도로 존재하며 `GetColumnAll`/`AddColumnByAttribute`로 컬럼 순서를
  관리하고, `IsPrimary`, `GetReferenceRelation`(FK 인덱스가 어느 관계에서 왔는지)을 갖는다 —
  이는 **물리(Physical) 레벨 인덱스**이며 논리 레벨 키그룹과는 별개의 레코드다.

---

## 9. 관계 레코드 (`CEnRelation` 계열)

### 9.1 클래스 구조 — **[추정-심벌]**

```
CEnRelation (공통 베이스)
 ├─ CEnRelNormal      — 일반 1:M 관계 (배타 그룹 참여 시 GetExclusiveID로 연결)
 ├─ CEnRelSelf         — 재귀(자기참조) 관계 (예: 응용분야→상위응용분야)
 ├─ CEnRelExclusive    — 배타적 아크(Exclusive Arc) 관계 그룹
 └─ CEnRelView         — 뷰(View) 관련 관계
```

### 9.2 관찰된 바이트 구조 — **[확인 + 미확정 혼합]**

`.dax` 샘플에서 역할명(verb) 문자열 `"소속회사로서"` 주변을 바이트 단위로 추적한 결과:

```
[RelationID 로 보이는 GUID]
<역할명(Verb) 문자열>                 ← "소속회사로서" 같은 이름
[관련 엔티티 GUID로 보이는 값]
<추가 GUID, 숫자 필드들>
```

관계 레코드 역시 GUID + 문자열 + GUID가 뒤섞여 등장해 전체 필드 순서를 바이트만으로 100%
확정하지는 못했으나, 다음은 심벌 이름으로 명확히 뒷받침된다.

### 9.3 필드 의미 사전 — **[추정-심벌]**

- `GetEntityFirstID`/`GetEntitySecondID` — **부모(First)/자식(Second) 엔티티를 GUID로
  참조**. `CEnEntityBase`의 `GetHeadRelation`(부모측 관계 목록)/`GetTailRelation`(자식측
  관계 목록) 명명에서 보듯, DA# 내부 용어로는 부모=`Head`, 자식=`Tail`이다.
- `GetCVerb`/`SetCVerb`, `GetPVerb`/`SetPVerb` — 자식(Child)쪽에서 읽는 관계명과 부모
  (Parent)쪽에서 읽는 관계명(양방향 역할구문, 예: "~의" / "~로서"). `GetRoleName`도 존재해
  역할명이 중첩 저장될 수 있다.
- **카디널리티/옵셔널리티 — [확인, 2026-10-30 Ghidra 재조사로 해결]**: 이후
  `doc/MinsDBModeler_개발문서.md` 부록 A.3에서 Ghidra 디컴파일 + Export
  시그니처로 확정했다. 요약:
  - `GetRelType`/`SetRelType`은 `GlobalEnum::_eRelVirtualType`(Real/Pseudo/Virtual 분류)이고
    `GetLineType`/`SetLineType`은 `GlobalEnum::_eLineType`이다 — **카디널리티+필수여부+식별
    여부를 한 번에 나타내는 것은 `LineType` 쪽**이며(1:M Optional / 1:M Mandatory / 1:M
    Identify / M:M / 1:1 Mandatory / 1:1 Identify / 1:M Pseudo, 7종 — 리소스 문자열로
    전부 확인), `RelType`은 카디널리티와 무관하다. (이전 추정을 정정)
  - 자식측 옵셔널리티는 실제로 **관계가 아니라 FK 속성 단위**로 저장/조회된다:
    `IEnDiagram::IsEntityAttrChildOptionalByRef(entityId,attrId)` /
    `SetEntityAttrChildAsOptionalByRef(...)` 두 함수를 디컴파일해 확인.
  - `CEnDrawItemData::ConvRelInfoToDrawItem(CEnRelation*, E_LINE_MULTICHILD&,
    E_LINE_MANDATORY&)`가 논리 `CEnRelation`을 다이어그램이 그릴 두 불리언 enum으로 변환하는
    실제 함수임을 Export 시그니처로 확인(§9.3의 "렌더링 시점에 FK 플래그를 참조" 추정이 맞았음).
- `IsIdentifierInhert`/`SetIdentifierInhert`, `SetIdentifyTail` — **식별 관계(Identifying
  Relationship) 여부**. 이름상 "식별자가 자식(Tail)쪽으로 상속되는가"를 뜻한다.
- `GetSelKeyGroupID` — 부모의 어떤 키그룹(보통 PK)이 자식에게 상속되는지를 가리키는 GUID.
- `GetFkIndex`/`GetForeignKey`/`GetGenerateForeignKeyId` — 이 관계로부터 생성되는 FK 인덱스/
  속성과의 연결.
- `GetInsertRI`/`GetUpdateRI`/`GetDeleteRI` — 참조무결성(RI) 액션 코드(제한/연쇄/널설정 등,
  정확한 enum 값 매핑은 **[미확정]**).
- `GetDbAlias`, `GetNote`/`SetNote` — 물리 DB 별칭, 관계 설명 노트.

### 9.4 배타적 관계(Exclusive Arc) — **[추정-심벌]**

`CEnRelExclusive`는 여러 개의 "교차 관계(Crossing Relation)"를 하나의 배타 그룹으로 묶는다
(`AddCrossingRelation`, `GetCrossingRelCount`, `LoadCrossingRelationIDs`). `GetSepeAttrID`/
`GetSeperateAttribute`는 Barker 표기의 "속성 분리(FK 분리)" 방식과 대응되며, 이는 기존
`daNativeParser.ts`가 "외래키 분리 방법"이라는 주석으로 하드코딩했던 처리(서브타입에 FK를
직접 두는 방식)와 정확히 일치한다 — DA#가 공식적으로 지원하는 메커니즘임이 확인된 셈이다.

---

## 10. 서브타입 / 서브타입 세트 (`CEnSubtype` / `CEnSubset`)

- **[확인, 2026-10-30 정정]** `CEnSubset`이 "서브타입 세트"(판별자 그룹)에 해당한다:
  - `GetInclusive`/`SetInclusive`(bool) — **"total/partial"이 아니라 "Inclusive(포괄,
    한 인스턴스가 여러 서브타입에 동시 소속 가능) vs Exclusive(배타, 디스조인트)"**.
    리소스 문자열("Inclusive", "Exclusive Combine", "Inclusive Combine")과 대조해 정정함.
  - `GetAttrLink`/`MakeAttrLink` — 판별자(discriminator) 속성과의 연결.
  - `GetState`(plain int, 이름 있는 enum 아님) — disjoint/overlap과는 무관해 보이는 단순
    상태값으로 추정되나 **[미확정]**.
  - `GetSubObjectAll`/`AddSubObject` — 이 세트에 속한 하위 서브타입 목록.
- **[추정-심벌]** `CEnSubtype`이 개별 하위타입(엔티티처럼 자신만의 속성을 가질 수 있는 단위)
  이다:
  - `GetParent`/`GetParentID` — 상위(세트 또는 엔티티)를 GUID로 참조.
  - `GetSeparate`/`SetSeparate` — 분리 저장(외래키를 서브타입에 직접 둘지) 여부. §9.4의
    `CEnRelExclusive::GetSeperateAttribute`와 연결되는 개념으로 보인다.
  - `GetEntity` — 이 서브타입이 속한 엔티티.

파서 설계 관점에서, 서브타입은 "엔티티처럼 속성을 가지며, 추가로 상위(Parent) GUID와
판별자(Discriminator) 연결을 갖는 특수 엔티티"로 모델링하면 된다 — 이는 현재
`daNativeParser.ts`가 하드코딩된 매핑 테이블로 흉내 내고 있는 것을, 실제로는 파일 안의
`GetParentID`/discriminator 링크를 그대로 읽어 일반화할 수 있다는 뜻이다.

---

## 11. 다이어그램: 좌표 / 크기 / Waypoint

### 11.1 담당 클래스 — **[추정-심벌, 확인된 함수 목록 기반]**

모든 도형의 저장/로드는 `CEnDrawItemData` 한 클래스가 전담하며, 도형 종류별로 쌍을 이루는
함수가 명확히 분리되어 있다(`EnData.dll` 심벌에서 발견):

| 도형 종류 | 저장 함수 | 비고 |
|---|---|---|
| 엔티티 박스 | `SaveErdEntityItem` / `LoadErdEntityItem` | 좌표/크기 보유 추정 |
| 관계선 | `SaveErdRelationItem` / `LoadErdRelationItem`, `SaveErdBaseRelationItem` | 꺾임점(웨이포인트) 보유 추정 |
| 배타 관계선 | `SaveErdExclusiveRelItem` | §9.4의 교차 관계 시각화 |
| 물리 테이블 | `SaveErdTableItem` | 물리 다이어그램용 |
| 뷰 / 뷰관계 | `SaveErdViewItem`, `SaveErdViewRelationItem` | |
| 엔티티 그룹 박스 | `SaveErdEntityGrpBoxItem` | 다이어그램 주석/묶음 |
| 텍스트박스/말풍선 | `SaveTextBoxItem`, `SaveBalloonNote` | |
| 테이블 셀 | `SaveTableCellData` | |

공용 하위 레코드도 함수명으로 확인된다: `SaveLOGFONT`(글꼴), `SaveTColor`(색상),
`SavePenData`(선 스타일), 그리고 **`SavePOINTVector`/`LoadPOINTVector`** — 이름상 "가변
개수의 점(Point) 목록"을 저장하는 유일한 함수로, **관계선의 waypoint(꺾임점) 목록을 담당하는
함수로 추정**된다. `SaveDiagramGUIDVector`는 다이어그램 도형과 논리 객체(엔티티/관계) GUID를
연결하는 매핑으로 추정된다.

레거시 베이스 클래스(`DrawBase.dll`의 `CDrawObj`/`CDrawItem`, MS의 옛 MFC "Draw Client
Items" 샘플 계열을 계승한 것으로 보임)는 좌표를 `CRect` 하나로 들고 있는 전형적인 패턴을
쓰는 것으로 보이며, DA#의 도형들도 이 유산을 물려받았을 가능성이 높다.

### 11.2 바이트 레벨 실측 — **[미확정, 정황 증거만 확보]**

`.damx` 샘플에서 전체 엔티티/속성/관계/도메인 정의가 끝나는 지점(파일의 약 19% 지점,
오프셋 `0x1DE30` 부근) 이후부터 파일 끝까지, 다음 두 가지 패턴이 조밀하게 반복된다:

1. `(X=0, Y=0, W=.., H=..)` 형태 — 원점 기준 크기 쌍. 텍스트 레이블의 가로/세로 크기를
   미리 계산해 두는 `GetTextExtent` 류의 값으로 추정(위치가 아니라 **크기**).
2. `(X, Y, ..)` 가 100~2300 범위에서 연속으로 이어지는 구간 — 실제 캔버스 좌표값의 범위로
   보이며, 값들이 overlap되며 이어지는 패턴(마지막 두 값이 다음 튜플의 처음 두 값과 겹침)은
   **고정폭 레코드가 아니라 가변 길이의 점 목록(웨이포인트 벡터)일 가능성**을 시사한다 —
   `SavePOINTVector`와 부합하는 정황이다.

다만 4개 정수 중 어느 것이 X/Y/Width/Height인지, 점 목록의 "개수" 필드가 정확히 어느
오프셋에 있는지는 이번 조사에서 바이트 단위로 확정하지 못했다. **엔티티 박스의 절대 위치/크기
필드와 관계선 웨이포인트 벡터가 이 구간에 있다는 것은 구조적으로 확인되었으나, 정확한 필드
순서는 §13의 후속 조사가 필요하다.**

---

## 12. 식별관계 표기 요약 — **[확인, 2026-10-30 Ghidra 재조사로 갱신]**

Barker 표기법(기존 MinsDBModeler가 채택 중인 표기)과 대조했을 때, DA#의 저장 방식은 다음과
같이 매핑된다(상세 근거는
`doc/MinsDBModeler_개발문서.md` 부록 A.3):

- **카디널리티 + 필수여부 + 식별여부**: `CEnRelation::GetLineType()/SetLineType()`의
  `GlobalEnum::_eLineType` **하나**로 결정됨(1:M Optional / 1:M Mandatory / 1:M Identify /
  M:M / 1:1 Mandatory / 1:1 Identify / 1:M Pseudo — 7종, 리소스 문자열로 라벨까지 확인).
  이전에 "RelType에도 카디널리티 정보가 섞여 있을 수 있다"고 추정했던 부분은 틀렸다 —
  `GetRelType()`은 `_eRelVirtualType`(Real/Pseudo/Virtual, FK 생성 여부 분류)이며 카디널리티와
  무관하다.
- **자식측 옵셔널리티**: 관계가 아니라 **FK 속성 단위**로 저장/조회된다
  (`IEnDiagram::IsEntityAttrChildOptionalByRef`/`SetEntityAttrChildAsOptionalByRef`,
  엔티티ID+속성ID가 키). 저장 시점이 아니라 다이어그램 레이어에서 속성별로 관리되는 값임을
  디컴파일로 확인.
- **다대다(M:M)**: `_eLineType`의 `M:M` 값 자체로 표현(별도 `IsMM` 불리언이 따로 있는지는
  미확인).
- **배타적 참여(Exclusive Arc)**: 관계 자체가 아니라 `CEnRelExclusive`라는 별도 클래스로
  그룹핑되어 저장됨(§9.4). 다이어그램에서는 펜 스타일까지 그룹 단위로 별도 지정
  (`SetDefItemErdExclusiveRelPenType`).
- **논리→다이어그램 변환**: `CEnDrawItemData::ConvRelInfoToDrawItem(CEnRelation*,
  E_LINE_MULTICHILD&, E_LINE_MANDATORY&)`가 위 `_eLineType`+FK NotNull을, 다이어그램이 직접
  쓰는 두 개의 불리언 enum으로 변환하는 지점이다.

파서를 구현할 때는 "관계 하나 = `_eLineType` 값 하나(카디널리티+식별여부)" + "FK 속성의
required 플래그(선택성)"의 2단 구조로 가정하면 된다 — 더 이상 추정이 아니라 Export 시그니처와
디컴파일로 확인된 구조다.

---

## 13. 한계 및 후속 조사 제안

이번 조사는 디스어셈블러 없이 "심벌 이름 + 바이트 패턴 대조"만으로 진행했기 때문에, 다음은
확정하지 못한 채로 남는다:

1. **속성 레코드의 56바이트 숫자 블록** 안에서 타입코드/길이/scale/순서/PK·FK 플래그가 정확히
   몇 바이트째에 있는지(§7.1).
2. **관계 레코드의 정확한 필드 순서**(GUID 2~4개와 Verb 문자열이 등장하는 정확한 순서, RI
   액션 코드의 enum 값)(§9.2). (§9.3/§12의 카디널리티·옵셔널리티·식별관계 "의미"는
   2026-10-30 Ghidra 재조사로 해결됨 — 여기서 남은 것은 바이트 상의 정확한 enum 정수값뿐.)
3. **`CEnSubset::GetState()`(plain int)의 정확한 의미** — disjoint/overlap이 아님은 확인했으나
   (§10, Inclusive/Exclusive가 그 역할), `GetState`가 실제 무엇을 나타내는지는 여전히 미확정.
4. **다이어그램 좌표/크기/웨이포인트 필드의 정확한 바이트 순서와 단위**(§11.2). 다만
   `doc/MinsDBModeler_개발문서.md` 부록 A.4에서 `EnAutoLayout.dll`
   Export API로 "노드 배치"와 "관계선 포트 슬롯팅"이 별도 2단계 파이프라인임은 확인됨 —
   남은 것은 파일에 저장된 바이트의 좌표 필드 순서뿐.

이들을 확정하려면 아래 중 하나가 필요하다:

- **차등 분석(권장, 가장 확실)**: 설치되어 있는 `Modeler5.exe`로 엔티티 1개만 있는 최소 모델을
  만들고, 속성의 PK/FK/NotNull, 관계의 카디널리티·식별여부, 엔티티의 좌표를 한 번에 하나씩만
  바꿔가며 저장 → 두 파일을 바이트 diff. 이번 조사에서 쓴 `test/da_format_re/dump.mjs`,
  `findrects*.mjs` 스크립트를 그대로 재사용하면 된다.
- **디스어셈블러 확보**: Ghidra(12.1.x, JDK 21 필요 — 현재 환경엔 JDK 18만 설치됨) 또는 IDA를
  설치해 `CEnRelation::Serialize`, `CEnAttributeBase::Serialize`,
  `CEnDrawItemData::LoadErdEntityItem`을 디컴파일하면 §7.1/§9.2/§11.2를 바이트 단위로 확정할
  수 있다. (이번 조사에서는 "렌더링 코드를 옮겨 적지 말 것"이라는 지시와, 이 환경에
  디스어셈블러가 없다는 두 가지 이유로 시도하지 않았다.)

---

## 부록 A. 조사에 사용한 보조 산출물

`D:\dev\MinsDBModeler\test\da_format_re\`에 1회성 조사 스크립트와 추출 결과를 남겼다
(저장소에 커밋할 필요는 없음):

- `strings.mjs` — PE 파일에서 ASCII/UTF-16LE 문자열을 오프셋과 함께 추출(스트립 안 된
  C++ 심벌 이름 수집용).
- `dump.mjs` — `.dax`/`.damx`에서 CFBF `Contents` 스트림 추출(또는 raw 그대로) 후, MFC
  CString 토큰을 오프셋·앞뒤 바이트와 함께 나열.
- `findrects*.mjs` — 디코딩된 바이트에서 "그럴듯한 사각형/좌표" 패턴을 휴리스틱으로 탐색.
- `*_strings.txt`, `*_classes.txt` — `EnData.dll`/`DrawBase.dll` 등에서 추출한 클래스/심벌
  목록.
- `*.contents.bin`, `*.tokens.txt` — 두 샘플 파일의 디코딩된 스트림과 토큰 덤프.

## 부록 B. 확인된 주요 클래스 목록 (EnData.dll)

```
CEnProject, CEnModel, CEnSubject, CEnPane, CEnPanePhy, CEnPView,
CEnEntity, CEnEntityBase, CEnAttribute, CEnAttributeBase,
CEnKeyGroup, CEnIndex, CEnConstraint, CEnDomain, CEnTerm, CEnSynonym,
CEnRelation, CEnRelNormal, CEnRelSelf, CEnRelExclusive, CEnRelView,
CEnSubtype, CEnSubset, CEnCluster, CEnPartition,
CEnDrawItemData, CEnObject
```
(그 외 다수의 DBMS별 `CEn<DBMS>TableInfo/ColumnInfo/IndexInfo/StorageInfo` 클래스는 물리
모델/리버스엔지니어링 기능용으로, 논리 모델 파일 포맷과는 직접 관련이 적어 생략했다.)
