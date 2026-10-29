# KERI 식별자 논리 모델

> 현재 문서는 상세 논리 모델링 단계에서 참고할 후보 문서이다.
> 현재 기준선은 `doc/DB설계/QVI 개념 모델.md`이며, 개념 모델 확정 전까지 이 문서의 전체 속성/도메인/코드 정의는 확정 사항으로 보지 않는다.
> 새 상세 논리 모델 기준선은 `doc/DB설계/QVI KERI 지갑 논리 모델.md`와 `doc/DB설계/model/qvi-keri-wallet-logical.yaml`이다.
> 특히 이 후보 문서의 `KERI식별주체`, `KERI식별자보유관계`, `KERI식별자운영권한`은 개념 모델 기준선에서 변경되었다.
> 현재 개념 모델은 `이용자`와 `KERI식별자` 사이의 통합 관계 엔터티인 `KERI식별자관계`를 둔다.

## 1. 목적

이 문서는 QVI 포탈 업무 DB에서 KERI AID, KEL, Credential Registry, TEL, ACDC Credential을 어떻게 논리 엔터티로 관리할지 정의한다.

KERIA는 내부적으로 LMDB에 KEL, TEL, credential store를 보관한다. 이 저장소가 암호학적 원본이다. 그러나 QVI 포탈은 신청, 심사, 발급, 수락, 폐기, 감사, 조회 업무를 수행해야 하므로 업무 DB에서도 관련 식별자와 상태를 추적해야 한다.

따라서 업무 DB는 KERIA LMDB의 원문 저장소를 대체하지 않고, 업무 관점의 참조 정보와 상태 스냅샷을 관리한다.

## 2. 모델링 원칙

1. KERIA LMDB는 KEL/TEL/credential 원문의 권위 저장소이다.
2. 업무 DB는 포탈 업무에 필요한 AID, SAID, registry ID, 상태, 처리 일시, 소유/운영 관계를 관리한다.
3. AID는 이용자 속성으로 직접 두지 않고 `KERI식별자` 엔터티로 관리한다.
4. 이용자와 KERI식별자는 관계 엔터티를 통해 연결한다.
5. QVI사업자, 법인회원, 개인회원처럼 AID가 식별하는 대상은 `KERI식별주체`로 추상화한다.
6. AID를 누가 운영할 수 있는지는 `KERI식별자운영권한`으로 별도 관리한다.
7. 보유 관계와 운영 권한은 선분 이력으로 관리한다.
8. KEL/TEL 이벤트 전체 저장은 선택 사항이며, 1차 물리 모델에서는 최신 상태 스냅샷만 구현할 수 있다.

## 3. 핵심 구조

```text
KERI식별주체 --< KERI식별자보유관계 >-- KERI식별자
이용자       --< KERI식별자운영권한 >-- KERI식별자

KERI식별자   --|| KEL
KEL          --< KEL이벤트

KERI식별자   --< CredentialRegistry
CredentialRegistry --|| TEL
TEL          --< TEL이벤트

ACDC자격증명 --> 발급자 KERI식별자
ACDC자격증명 --> 보유자 KERI식별자
ACDC자격증명 --> CredentialRegistry
```

## 4. 엔터티 정의

### 4.1 KERI식별주체

KERI식별자가 식별하는 업무 주체이다. QVI사업자, 법인회원, 개인회원, QVI직원 등이 될 수 있다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| 주체번호 | Y | 주체번호 | KERI 식별 대상 주체 식별자 |
| 주체구분코드 | Y | KERI식별주체구분코드 | QVI사업자/법인회원/개인회원/QVI직원 |
| 참조엔터티명 | Y | 명칭 | 실제 업무 엔터티명 |
| 참조식별자값 | Y | 식별자값 | 실제 업무 엔터티의 식별자 |
| 주체명 | Y | 명칭 | 표시용 주체명 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.2 KERI식별자

KERI AID를 관리하는 엔터티이다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| KERI식별자번호 | Y | KERI식별자번호 | 업무 DB 내부 식별자 |
| AID | Y | AID | KERI autonomous identifier |
| 식별자별칭명 | N | 명칭 | KERIA alias |
| KERIA에이전트구분코드 | Y | KERIA에이전트구분코드 | QVI_KERIA/LE_KERIA 등 |
| 식별자용도코드 | Y | KERI식별자용도코드 | QVI발급자/법인/직원/개인 등 |
| 식별자상태코드 | Y | KERI식별자상태코드 | 생성중/활성/회전/폐기 등 |
| 생성일시 | Y | 일시 | KERIA에서 AID가 생성된 시각 |
| 최종회전일시 | N | 일시 | 마지막 key rotation 시각 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.3 KERI식별자보유관계

KERI식별주체와 KERI식별자 사이의 보유 관계를 선분 이력으로 관리한다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| 주체번호 | Y | 주체번호 | KERI식별주체 식별자 |
| KERI식별자번호 | Y | KERI식별자번호 | KERI식별자 식별자 |
| 보유관계유형코드 | Y | 보유관계유형코드 | 식별대상/소유/대표/holder 등 |
| 유효시작일자 | Y | 일자 | 관계 유효 시작일 |
| 유효종료일자 | N | 일자 | 관계 유효 종료일. 현재 유효하면 NULL |
| 기본여부 | Y | 여부 | 해당 주체의 기본 AID 여부 |
| 관계상태코드 | Y | 관계상태코드 | 활성/종료/정지 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.4 KERI식별자운영권한

포탈 이용자가 특정 KERI식별자를 운영할 수 있는 권한을 선분 이력으로 관리한다.

예를 들어 QVI직원이 QVI 발급자 AID를 운영하거나, 법인소속개인회원이 법인 AID를 운영하는 경우를 표현한다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| 이용자번호 | Y | 이용자번호 | 운영 권한을 가진 이용자 |
| KERI식별자번호 | Y | KERI식별자번호 | 운영 대상 KERI식별자 |
| 운영권한유형코드 | Y | 운영권한유형코드 | 운영자/서명자/위임관리자/조회자 등 |
| 유효시작일자 | Y | 일자 | 권한 유효 시작일 |
| 유효종료일자 | N | 일자 | 권한 유효 종료일. 현재 유효하면 NULL |
| 권한상태코드 | Y | 권한상태코드 | 활성/종료/정지 |
| 권한부여자이용자번호 | N | 이용자번호 | 권한을 부여한 이용자 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.5 KEL

KERI식별자의 Key Event Log 상태를 관리한다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| KERI식별자번호 | Y | KERI식별자번호 | KEL의 대상 AID |
| 현재순번 | Y | 순번 | 최신 key event sequence number |
| 현재이벤트SAID | N | SAID | 최신 이벤트 SAID |
| 현재이벤트다이제스트값 | N | 다이제스트값 | 최신 이벤트 digest |
| 최종이벤트유형코드 | N | KEL이벤트유형코드 | inception/rotation/interaction 등 |
| 최종동기화일시 | N | 일시 | KERIA에서 마지막으로 상태를 조회한 시각 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.6 KEL이벤트

KEL의 개별 이벤트이다. 1차 물리 모델에서는 선택 구현으로 둔다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| KERI식별자번호 | Y | KERI식별자번호 | KEL 대상 AID |
| 이벤트순번 | Y | 순번 | 이벤트 순번 |
| 이벤트유형코드 | Y | KEL이벤트유형코드 | inception/rotation/interaction 등 |
| 이벤트SAID | N | SAID | 이벤트 SAID |
| 이벤트다이제스트값 | N | 다이제스트값 | 이벤트 digest |
| 이벤트발생일시 | N | 일시 | 이벤트 발생 시각 |
| 원문참조값 | N | 참조값 | LMDB 또는 파일 저장소 원문 참조 |
| 등록일시 | Y | 일시 | 등록 시각 |

### 4.7 CredentialRegistry

ACDC 발급 상태를 기록하는 registry이다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| 레지스트리번호 | Y | 레지스트리번호 | 업무 DB 내부 식별자 |
| 레지스트리식별자 | Y | 레지스트리식별자 | KERI registry ID |
| 발급자KERI식별자번호 | Y | KERI식별자번호 | registry를 생성한 issuer AID |
| 레지스트리명 | N | 명칭 | registry alias/name |
| 레지스트리상태코드 | Y | 레지스트리상태코드 | 생성중/활성/폐기 |
| 생성일시 | Y | 일시 | KERIA에서 registry가 생성된 시각 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.8 TEL

Credential Registry의 Transaction Event Log 상태를 관리한다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| 레지스트리번호 | Y | 레지스트리번호 | 대상 registry |
| 현재순번 | Y | 순번 | 최신 TEL 이벤트 순번 |
| 현재이벤트SAID | N | SAID | 최신 TEL 이벤트 SAID |
| 최종이벤트유형코드 | N | TEL이벤트유형코드 | issue/revoke 등 |
| 최종동기화일시 | N | 일시 | KERIA에서 마지막으로 상태를 조회한 시각 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

### 4.9 TEL이벤트

TEL의 개별 이벤트이다. 1차 물리 모델에서는 선택 구현으로 둔다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| 레지스트리번호 | Y | 레지스트리번호 | 대상 registry |
| 이벤트순번 | Y | 순번 | 이벤트 순번 |
| 이벤트유형코드 | Y | TEL이벤트유형코드 | issue/revoke 등 |
| 이벤트SAID | N | SAID | 이벤트 SAID |
| 이벤트발생일시 | N | 일시 | 이벤트 발생 시각 |
| 원문참조값 | N | 참조값 | LMDB 또는 파일 저장소 원문 참조 |
| 등록일시 | Y | 일시 | 등록 시각 |

### 4.10 ACDC자격증명

vLEI, OOR, ECR 등 ACDC credential의 업무 추적 엔터티이다.

| 속성명 | 필수 | 도메인 | 설명 |
| --- | --- | --- | --- |
| ACDC자격증명번호 | Y | ACDC자격증명번호 | 업무 DB 내부 식별자 |
| 자격증명SAID | Y | SAID | ACDC credential SAID |
| 스키마SAID | Y | SAID | ACDC schema SAID |
| 자격증명유형코드 | Y | ACDC자격증명유형코드 | QVI/LE_VLEI/OOR/ECR |
| 발급자KERI식별자번호 | Y | KERI식별자번호 | issuer AID |
| 보유자KERI식별자번호 | N | KERI식별자번호 | holder AID |
| 대상주체번호 | N | 주체번호 | credential subject |
| 레지스트리번호 | Y | 레지스트리번호 | 발급 registry |
| 발급상태코드 | Y | ACDC발급상태코드 | 생성중/발급/전달/수락/폐기/실패 |
| IPEXGrantSAID | N | SAID | grant exchange SAID |
| Admit여부 | Y | 여부 | holder admit 여부 |
| 폐기여부 | Y | 여부 | revoked 여부 |
| 발급일시 | N | 일시 | issue/grant 완료 시각 |
| 수락일시 | N | 일시 | holder admit 완료 시각 |
| 폐기일시 | N | 일시 | revoke 완료 시각 |
| 등록일시 | Y | 일시 | 등록 시각 |
| 수정일시 | Y | 일시 | 수정 시각 |

## 5. 선분 이력 규칙

`KERI식별자보유관계`와 `KERI식별자운영권한`은 선분 이력으로 관리한다.

1. `유효시작일자`는 필수이다.
2. `유효종료일자`가 NULL이면 현재 유효한 관계이다.
3. 동일 주체, 동일 KERI식별자, 동일 관계유형의 유효기간은 서로 겹칠 수 없다.
4. 동일 이용자, 동일 KERI식별자, 동일 운영권한유형의 유효기간은 서로 겹칠 수 없다.
5. 종료된 관계는 삭제하지 않고 `유효종료일자`와 상태코드로 종료 처리한다.
6. 기간 비교는 물리 구현 시 `[유효시작일자, 유효종료일자]` 또는 `[유효시작일자, 유효종료일자)` 중 하나로 표준화해야 한다.
7. 1차 권장안은 종료일의 중복 해석을 피하기 위해 `[유효시작일자, 유효종료일자)` 반개구간으로 본다.

## 6. 주요 업무 규칙

1. QVI사업자는 하나 이상의 QVI 발급자 AID를 가질 수 있다.
2. 법인회원은 LE vLEI 신청 또는 wallet 수락 과정에서 법인 AID를 가질 수 있다.
3. 개인회원은 OOR/ECR 수락 또는 wallet 생성 과정에서 개인 AID를 가질 수 있다.
4. QVI 발급자 AID의 운영권한은 QVI직원에게만 부여한다.
5. 법인 AID의 운영권한은 해당 법인회원에 소속된 법인소속개인회원에게 부여할 수 있다.
6. 개인 AID의 운영권한은 해당 개인회원 본인에게 부여한다.
7. ACDC자격증명의 발급자는 반드시 활성 KERI식별자여야 한다.
8. ACDC자격증명의 holder가 있는 경우 holder도 활성 KERI식별자여야 한다.
9. LE vLEI와 OOR은 QVI 발급자 AID가 발급한다.
10. ECR은 법인 AID가 발급한다.
11. QVI 업무 상태의 발급 완료는 issue/grant 성공 기준이며, holder admit 상태와 구분한다.
12. KEL/TEL 원문 검증이 필요한 경우 KERIA를 조회하고, 업무 DB의 스냅샷은 조회 시점 기준 캐시로 본다.

## 7. 표준코드 후보

### 7.1 KERI식별주체구분코드

| 코드값 | 코드명 |
| --- | --- |
| QVI_ORG | QVI사업자 |
| LEGAL_ENTITY_MEMBER | 법인회원 |
| INDIVIDUAL_MEMBER | 개인회원 |
| QVI_STAFF | QVI직원 |

### 7.2 KERIA에이전트구분코드

| 코드값 | 코드명 |
| --- | --- |
| QVI_KERIA | QVI KERIA |
| LE_KERIA | LE KERIA |
| USER_KERIA | 개인 KERIA |

### 7.3 KERI식별자용도코드

| 코드값 | 코드명 |
| --- | --- |
| QVI_ISSUER | QVI 발급자 |
| LEGAL_ENTITY | 법인 |
| EMPLOYEE | 법인소속 개인 |
| INDIVIDUAL | 일반 개인 |

### 7.4 보유관계유형코드

| 코드값 | 코드명 |
| --- | --- |
| IDENTIFIES | 식별대상 |
| OWNS | 소유 |
| HOLDER | 보유자 |
| REPRESENTS | 대표 |

### 7.5 운영권한유형코드

| 코드값 | 코드명 |
| --- | --- |
| OPERATOR | 운영자 |
| SIGNER | 서명자 |
| DELEGATED_ADMIN | 위임관리자 |
| VIEWER | 조회자 |

### 7.6 ACDC자격증명유형코드

| 코드값 | 코드명 |
| --- | --- |
| QVI | QVI vLEI |
| LE_VLEI | Legal Entity vLEI |
| OOR | Official Organizational Role |
| ECR | Engagement Context Role |

### 7.7 ACDC발급상태코드

| 코드값 | 코드명 | 설명 |
| --- | --- | --- |
| PREPARED | 준비 | credential 생성 전 |
| ISSUED | 발급 | TEL issue 완료 |
| GRANTED | 전달 | IPEX grant 완료 |
| ADMITTED | 수락 | holder admit 완료 |
| REVOKED | 폐기 | TEL revoke 완료 |
| FAILED | 실패 | 발급/전달/폐기 실패 |

## 8. 물리 모델 구현 순서

1차 물리 모델에서는 다음만 우선 구현해도 충분하다.

1. KERI식별주체
2. KERI식별자
3. KERI식별자보유관계
4. KERI식별자운영권한
5. KEL 상태 스냅샷
6. CredentialRegistry
7. TEL 상태 스냅샷
8. ACDC자격증명

`KEL이벤트`, `TEL이벤트`는 감사/검증 캐시 요구가 분명해진 뒤 추가한다.

## 9. 관련 산출물

- 원천 모델: `doc/DB설계/model/keri-identifier-logical.yaml`
- 이용자 논리 모델: `doc/DB설계/QVI 이용자 논리 모델.md`
- 이용자 모델 원천: `doc/DB설계/model/qvi-user-logical.yaml`
