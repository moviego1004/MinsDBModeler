export const DEFAULT_PROJECT_CONFIG_YAML = `project_name: QVI 이용자 관리 시스템
version: 1.0.0
target_db: POSTGRESQL
subtype_strategy: ROLL_UP
naming_case: SNAKE_CASE
`;

export const DEFAULT_CONCEPTUAL_YAML = `subject_area: QVI 개념 모델
version: 0.1
status: draft
modeling_level: conceptual

scope:
  include:
    - core_entities
    - major_attributes
    - core_relationships
    - key_business_rules
  exclude:
    - full_attribute_definition
    - standard_domains
    - standard_code_values
    - physical_names
    - ddl
    - indexes
    - detailed_constraints

entities:
  - name: 이용자
    purpose: QVI 서비스에서 업무상 식별되는 최상위 주체
    key_attributes: [이용자번호, 이용자구분, 이용자상태]

  - name: 이용자계정
    purpose: 이용자가 포탈에 로그인하고 인증받기 위해 사용하는 접근 계정
    key_attributes: [계정번호, 이용자번호, 로그인식별자, 계정상태]

  - name: 회원가입신청
    purpose: 외부 고객이 QVI 포탈 이용자가 되기 위해 가입을 요청하는 업무 엔터티
    key_attributes: [가입신청번호, 가입신청유형, 가입신청상태, 신청일시]

  - name: 회원가입신청단계이력
    purpose: 회원가입신청이 어떤 단계에 언제 진입했고 어떻게 처리되었는지를 표현하는 이력 엔터티
    key_attributes: [가입신청단계이력번호, 단계구분, 단계상태, 처리일시]

  - name: QVI사업자
    purpose: QVI 자격으로 LE vLEI와 OOR을 발급하는 사업자 주체
    key_attributes: [이용자번호, 사업자명, 사업자상태]

  - name: QVI직원
    purpose: QVI 내부에서 포탈 운영, 심사, 발급, 폐기, 조회 업무를 수행하는 이용자
    key_attributes: [이용자번호, 직원명, 재직상태]

  - name: QVI직원역할부여이력
    purpose: QVI직원에게 역할이 부여되고 회수되는 이력을 관리하는 엔터티
    key_attributes: [역할부여이력번호, 역할구분, 역할상태, 유효기간]

  - name: 회원
    purpose: QVI 서비스를 이용하는 외부 고객의 상위 개념
    key_attributes: [이용자번호, 회원구분, 회원상태]

  - name: 법인회원
    purpose: Legal Entity 단위로 QVI에 가입하여 LE vLEI 발급을 신청하는 회원
    key_attributes: [이용자번호, LEI, 법인명, 국가]

  - name: 개인회원
    purpose: 자연인 단위로 QVI 서비스에 가입하는 회원
    key_attributes: [이용자번호, 개인회원구분, 성명]

  - name: 법인소속개인회원
    purpose: 특정 법인회원에 소속되어 OOR/ECR 등 법인 역할 credential을 받을 수 있는 개인회원
    key_attributes: [이용자번호, 소속상태, 소속기간]

  - name: 법인소속이력
    purpose: 개인회원이 특정 법인회원에 소속되거나 소속 해제되는 사실을 관리하는 관계 이력 엔터티
    key_attributes: [법인회원이용자번호, 개인회원이용자번호, 소속상태, 유효기간]

  - name: 일반개인회원
    purpose: 특정 법인에 소속되지 않고 개인 자격으로 QVI 서비스를 이용하는 개인회원
    key_attributes: [이용자번호, 개인서비스구분]

  - name: 지갑
    purpose: 이용자가 AID와 credential을 보관, 제어, 제시하기 위해 사용하는 wallet 단위
    key_attributes: [지갑번호, 지갑유형, 지갑상태]

  - name: 이용자지갑관계
    purpose: 이용자와 지갑 사이의 관계를 나타내는 교차 엔터티
    key_attributes: [이용자번호, 지갑번호, 지갑관계유형, 유효기간]

  - name: KERI식별자관계
    purpose: 이용자와 KERI식별자 사이의 보유, 운영, 서명, 조회 등 관계를 나타내는 관계 엔터티
    key_attributes: [이용자번호, KERI식별자번호, 관계유형, 유효기간]

  - name: KERI식별자
    purpose: KERI AID를 업무적으로 추적하기 위한 핵심 엔터티
    key_attributes: [KERI식별자번호, AID, 식별자용도, 식별자상태]

  - name: KEL
    purpose: KERI식별자의 Key Event Log 상태를 업무적으로 추적하는 엔터티
    key_attributes: [KERI식별자번호, 현재순번, 현재이벤트식별자, 최종동기화시각]

  - name: CredentialRegistry
    purpose: ACDC Credential 발급과 폐기 상태를 기록하는 registry
    key_attributes: [레지스트리번호, 레지스트리식별자, 레지스트리상태]

  - name: TEL
    purpose: Credential Registry의 Transaction Event Log 상태를 업무적으로 추적하는 엔터티
    key_attributes: [레지스트리번호, 현재순번, 현재이벤트식별자, 최종동기화시각]

  - name: ACDC자격증명
    purpose: QVI Credential, LE vLEI, OOR, ECR 등 ACDC Credential을 업무적으로 추적하는 엔터티
    key_attributes: [자격증명번호, 자격증명식별자, 자격증명유형, 발급상태]

  - name: 외부기관
    purpose: QVI 포탈과 신뢰체인 또는 운영 연계 관계를 갖는 외부 기관 주체
    key_attributes: [이용자번호, 외부기관유형, 외부기관명, 외부기관상태]

  - name: KERI식별자위임관계
    purpose: KERI식별자 사이의 위임 또는 신뢰체인 관계를 업무적으로 추적하는 관계 엔터티
    key_attributes: [위임자KERI식별자번호, 수임자KERI식별자번호, 위임관계유형, 유효기간]

  - name: 발급신청
    purpose: Credential 발급을 요청하고 심사/처리하는 업무 엔터티
    key_attributes: [신청번호, 신청유형, 신청상태, 신청일시]

  - name: 발급신청단계이력
    purpose: 발급신청이 어떤 단계에 언제 진입했고 어떻게 처리되었는지를 recursive 관계로 표현하는 이력 엔터티
    key_attributes: [발급신청단계이력번호, 단계구분, 단계상태, 처리일시]

  - name: 자격증명생명주기신청
    purpose: 이미 발급된 ACDC자격증명에 대한 갱신, 재발급, 폐기, 상태 변경 요청을 관리하는 업무 엔터티
    key_attributes: [생명주기신청번호, 생명주기신청유형, 신청상태, 신청일시]

  - name: 상품
    purpose: QVI가 판매하거나 무료 제공할 수 있는 서비스 또는 credential 발급 단위
    key_attributes: [상품번호, 상품유형, 상품명, 상품상태]

  - name: 요금정책
    purpose: 상품의 가격, 할인, 면제, 적용 기간을 정의하는 기준정보성 엔터티
    key_attributes: [요금정책번호, 상품번호, 기준금액, 유효기간]

  - name: 과금
    purpose: 발급신청 또는 서비스 이용으로 인해 이용자에게 청구되는 금액 단위
    key_attributes: [과금번호, 과금유형, 과금상태, 청구금액, 과금일시]

  - name: 과금항목
    purpose: LE vLEI 발급비, OOR/ECR 발급비, 할인, 면제, 부가세 등을 표현하는 과금의 세부 라인 항목
    key_attributes: [과금항목번호, 과금항목유형, 항목금액, 수량]

  - name: 결제
    purpose: 카드 승인, 가상계좌 입금 확인, 세금계산서 입금 확인, 포인트 차감, 무료 처리 등 실제 정산 사건
    key_attributes: [결제번호, 결제수단, 결제상태, 결제금액, 결제일시]

  - name: 결제적용
    purpose: 결제가 특정 과금에 얼마만큼 적용되었는지를 나타내는 교차 엔터티
    key_attributes: [결제적용번호, 과금번호, 결제번호, 적용금액]

  - name: 세금계산서
    purpose: 세금계산서 발행, 수정, 취소와 입금 확인 연결을 관리하는 엔터티
    key_attributes: [세금계산서번호, 발행유형, 세금계산서상태, 발행금액, 발행일시]

  - name: 취소환불
    purpose: 구매 취소와 환불 처리를 관리하는 엔터티
    key_attributes: [취소환불번호, 취소환불유형, 취소환불상태, 취소환불금액, 처리일시]

  - name: 이용자포인트
    purpose: 이용자의 포인트 발생, 사용, 취소, 소멸, 조정을 관리하는 원장형 이력 엔터티
    key_attributes: [포인트번호, 포인트거래유형, 발생포인트, 사용포인트, 현재포인트, 유효기간]

  - name: 과금통계
    purpose: 과금, 결제, 환불, 포인트 사용 내역을 집계한 파생 통계 엔터티
    key_attributes: [과금통계번호, 통계기준, 통계기간, 집계금액, 집계건수]

  - name: 약관
    purpose: QVI 포탈 이용, 개인정보 처리, vLEI 신청 등에 적용되는 약관 또는 고지문
    key_attributes: [약관번호, 약관유형, 약관버전, 시행일자]

  - name: 약관동의이력
    purpose: 이용자 또는 회원가입신청자가 특정 약관 버전에 동의한 사실을 관리하는 이력 엔터티
    key_attributes: [약관동의이력번호, 약관번호, 동의상태, 동의일시]

  - name: 공통코드
    purpose: 유형, 상태, 단계, 역할처럼 업무 전반에서 사용하는 코드성 기준정보
    key_attributes: [코드그룹, 코드값, 코드명, 사용여부]

  - name: 첨부파일
    purpose: 발급신청 증빙, 자료실 게시물, 기타 포탈 업무에 첨부되는 파일
    key_attributes: [첨부파일번호, 파일명, 파일상태]

  - name: 게시판
    purpose: 공지사항, 자료실, FAQ, 문의 등 포탈 콘텐츠의 게시 채널을 정의하는 엔터티
    key_attributes: [게시판번호, 게시판유형, 게시판명, 게시판상태, 공개범위]

  - name: 게시물
    purpose: 공지, 자료, FAQ 항목, 문의 글처럼 포탈에 게시되는 실제 콘텐츠 엔터티
    key_attributes: [게시물번호, 게시판번호, 제목, 게시물상태, 공개범위, 게시일시]

  - name: 감사로그
    purpose: 업무 행위와 주요 상태 변경을 기록하는 엔터티
    key_attributes: [감사로그번호, 이벤트유형, 행위자, 발생시각]

  - name: 알림통지
    purpose: 가입, 신청, 결제, 발급, 폐기 등 주요 업무 이벤트를 이용자에게 알리는 통지 엔터티
    key_attributes: [통지번호, 통지유형, 통지상태, 발송일시]

  - name: 외부연계시스템
    purpose: QVI 포탈이 호출하거나 통신 상태를 추적해야 하는 외부 또는 주변 시스템
    key_attributes: [연계시스템번호, 연계시스템유형, 연계시스템명, 연계시스템상태]

  - name: 연계엔드포인트
    purpose: 외부연계시스템의 실제 호출 주소와 발견 정보를 관리하는 엔터티
    key_attributes: [엔드포인트번호, 엔드포인트유형, 엔드포인트URL, 엔드포인트상태]

  - name: 연계작업
    purpose: 외부연계시스템 또는 KERIA에 요청한 비동기/동기 작업의 업무 단위
    key_attributes: [연계작업번호, 연계작업유형, 연계작업상태, 재시도횟수, 다음재시도일시]

  - name: 연계시도이력
    purpose: 연계작업을 실제로 시도한 각 호출 또는 polling 시도 이력
    key_attributes: [연계시도이력번호, 시도순번, 시도상태, 응답코드, 시도일시]

relationships:
  - { from: 이용자, to: QVI사업자, type: subtype, description: QVI사업자는 이용자의 서브타입이다. }
  - { from: 이용자, to: QVI직원, type: subtype, description: QVI직원은 이용자의 서브타입이다. }
  - { from: 이용자, to: 회원, type: subtype, description: 회원은 이용자의 서브타입이다. }
  - { from: 이용자, to: 외부기관, type: subtype, description: 외부기관은 이용자의 서브타입이다. }
  - { from: 이용자, to: 이용자계정, type: association, description: 이용자는 포탈 접근 계정을 가진다. }
  - { from: 회원가입신청, to: 이용자, type: result, description: 회원가입신청은 승인 시 이용자와 회원을 생성할 수 있다. }
  - { from: 회원가입신청, to: 회원가입신청단계이력, type: composition, description: 회원가입신청은 진행 단계 이력을 가진다. }
  - { from: 회원가입신청단계이력, to: 회원가입신청단계이력, type: recursive, description: 회원가입신청단계이력은 선행/후행 단계로 연결될 수 있다. }
  - { from: 회원, to: 법인회원, type: subtype, description: 법인회원은 회원의 서브타입이다. }
  - { from: 회원, to: 개인회원, type: subtype, description: 개인회원은 회원의 서브타입이다. }
  - { from: 개인회원, to: 법인소속개인회원, type: subtype, description: 법인소속개인회원은 개인회원의 서브타입이다. }
  - { from: 개인회원, to: 일반개인회원, type: subtype, description: 일반개인회원은 개인회원의 서브타입이다. }
  - { from: QVI직원, to: QVI직원역할부여이력, type: history, description: QVI직원은 역할 부여 이력을 가진다. }
  - { from: 법인회원, to: 법인소속개인회원, type: association, description: 법인소속개인회원은 법인회원에 소속된다. }
  - { from: 법인회원, to: 법인소속이력, type: history, description: 법인회원은 개인회원 소속 이력을 가진다. }
  - { from: 개인회원, to: 법인소속이력, type: history, description: 개인회원은 법인 소속 이력을 가진다. }
  - { from: 이용자, to: 이용자지갑관계, type: identifying, description: 이용자는 지갑 관계의 부모이다. }
  - { from: 지갑, to: 이용자지갑관계, type: identifying, description: 지갑은 이용자 관계의 부모이다. }
  - { from: 이용자, to: KERI식별자관계, type: identifying, description: 이용자는 AID 관계의 부모이다. }
  - { from: KERI식별자, to: KERI식별자관계, type: identifying, description: KERI식별자는 AID 관계의 부모이다. }
  - { from: 지갑, to: KERI식별자, type: association, description: 지갑은 AID를 관리할 수 있다. }
  - { from: KERI식별자, to: KEL, type: composition, description: AID는 KEL을 가진다. }
  - { from: KERI식별자, to: CredentialRegistry, type: association, description: AID는 registry를 생성한다. }
  - { from: CredentialRegistry, to: TEL, type: composition, description: registry는 TEL을 가진다. }
  - { from: CredentialRegistry, to: ACDC자격증명, type: association, description: credential은 registry에 등록된다. }
  - { from: KERI식별자, to: ACDC자격증명, type: issuer_holder, description: AID는 credential의 발급자 또는 보유자이다. }
  - { from: 지갑, to: ACDC자격증명, type: association, description: 지갑은 credential을 보관하거나 제시할 수 있다. }
  - { from: KERI식별자, to: KERI식별자위임관계, type: delegator, description: KERI식별자는 다른 KERI식별자에게 권한을 위임할 수 있다. }
  - { from: KERI식별자, to: KERI식별자위임관계, type: delegatee, description: KERI식별자는 다른 KERI식별자로부터 권한을 위임받을 수 있다. }
  - { from: 발급신청, to: 발급신청단계이력, type: composition, description: 발급신청은 진행 단계 이력을 가진다. }
  - { from: 발급신청단계이력, to: 발급신청단계이력, type: recursive, description: 발급신청단계이력은 선행/후행 단계로 연결된다. }
  - { from: ACDC자격증명, to: 자격증명생명주기신청, type: association, description: 발급된 credential의 갱신, 재발급, 폐기 요청을 관리한다. }
  - { from: 상품, to: 요금정책, type: history, description: 상품은 적용 기간별 요금정책을 가진다. }
  - { from: 과금항목, to: 상품, type: association, description: 과금항목은 청구 산정 기준 상품을 참조할 수 있다. }
  - { from: 과금항목, to: 요금정책, type: association, description: 과금항목은 적용된 요금정책을 참조할 수 있다. }
  - { from: 발급신청, to: 과금, type: association, description: 발급신청은 과금을 발생시킬 수 있다. }
  - { from: 과금, to: 과금항목, type: composition, description: 과금은 세부 항목을 가진다. }
  - { from: 과금, to: 결제적용, type: association, description: 과금은 결제적용을 통해 정산된다. }
  - { from: 결제, to: 결제적용, type: association, description: 결제는 과금에 적용된다. }
  - { from: 과금, to: 세금계산서, type: association, description: 과금은 세금계산서를 가질 수 있다. }
  - { from: 과금, to: 취소환불, type: association, description: 과금은 취소환불의 대상이 될 수 있다. }
  - { from: 결제, to: 취소환불, type: association, description: 결제는 취소환불의 대상이 될 수 있다. }
  - { from: 세금계산서, to: 결제, type: association, description: 세금계산서는 입금 확인 결제와 연결될 수 있다. }
  - { from: 이용자, to: 이용자포인트, type: history, description: 이용자는 포인트 원장 이력을 가진다. }
  - { from: 이용자포인트, to: 과금, type: association, description: 포인트 이력은 관련 과금과 연결될 수 있다. }
  - { from: 이용자포인트, to: 결제, type: association, description: 포인트 이력은 관련 결제와 연결될 수 있다. }
  - { from: 과금통계, to: 과금, type: derived, description: 과금통계는 과금 원천 데이터를 기준으로 산출된다. }
  - { from: 과금통계, to: 결제, type: derived, description: 과금통계는 결제 원천 데이터를 기준으로 산출된다. }
  - { from: 과금통계, to: 취소환불, type: derived, description: 과금통계는 취소환불 원천 데이터를 기준으로 산출된다. }
  - { from: 과금통계, to: 이용자포인트, type: derived, description: 과금통계는 포인트 원장 데이터를 기준으로 산출된다. }
  - { from: 발급신청, to: ACDC자격증명, type: result, description: 발급신청은 처리 결과로 credential을 생성한다. }
  - { from: 발급신청, to: 첨부파일, type: association, description: 발급신청은 증빙 파일을 가진다. }
  - { from: 게시판, to: 게시물, type: composition, description: 게시판은 게시물을 포함한다. }
  - { from: 이용자, to: 게시물, type: actor, description: 이용자는 게시물의 작성자, 수정자, 게시 승인자가 될 수 있다. }
  - { from: 게시물, to: 첨부파일, type: association, description: 게시물은 자료실 파일 등 첨부파일을 가질 수 있다. }
  - { from: 약관, to: 약관동의이력, type: history, description: 약관의 버전별 동의 사실을 관리한다. }
  - { from: 이용자, to: 약관동의이력, type: history, description: 가입 후 약관 동의는 이용자에 연결된다. }
  - { from: 회원가입신청, to: 약관동의이력, type: history, description: 가입 전 약관 동의는 회원가입신청에 연결될 수 있다. }
  - { from: 이용자, to: 감사로그, type: actor, description: 이용자는 업무 행위자로 감사로그에 기록된다. }
  - { from: 이용자, to: 알림통지, type: recipient, description: 이용자는 업무 알림을 받을 수 있다. }
  - { from: 외부기관, to: 외부연계시스템, type: operator, description: 외부기관은 연계 시스템의 운영 주체가 될 수 있다. }
  - { from: 외부연계시스템, to: 연계엔드포인트, type: composition, description: 연계 시스템은 호출 또는 발견 엔드포인트를 가진다. }
  - { from: 외부연계시스템, to: 연계작업, type: target, description: 연계작업은 연계 시스템을 대상으로 한다. }
  - { from: 연계엔드포인트, to: 연계작업, type: target, description: 연계작업은 특정 엔드포인트를 호출 대상으로 삼을 수 있다. }
  - { from: 연계작업, to: 연계시도이력, type: history, description: 연계작업은 실제 호출과 재시도 이력을 가진다. }
  - { from: 발급신청, to: 연계작업, type: trigger, description: 발급신청은 LEI 조회, Reporting API, KERIA 발급 작업을 유발할 수 있다. }
  - { from: 자격증명생명주기신청, to: 연계작업, type: trigger, description: 생명주기신청은 폐기 보고, 키 회전, 상태 조회 작업을 유발할 수 있다. }
  - { from: KERI식별자, to: 연계작업, type: target, description: KERI식별자는 OOBI resolve, witness receipt, watcher 조회, 키 회전 작업의 대상이 될 수 있다. }
  - { from: ACDC자격증명, to: 연계작업, type: target, description: ACDC자격증명은 발급, 검증, 폐기, 보고 작업의 대상이 될 수 있다. }

business_rules:
  - 이용자는 QVI사업자, QVI직원, 회원 또는 외부기관 중 하나이다.
  - 이용자와 이용자계정은 분리한다.
  - 이용자는 업무 주체이고 이용자계정은 포탈 접근 수단이다.
  - 회원가입신청은 승인 전 고객 정보를 관리하고, 승인되면 이용자와 회원 서브타입을 생성할 수 있다.
  - 회원가입신청의 진행 흐름은 회원가입신청단계이력으로 관리한다.
  - 회원은 법인회원 또는 개인회원 중 하나이다.
  - 개인회원은 법인소속개인회원 또는 일반개인회원 중 하나이다.
  - QVI직원의 관리자/담당자 구분은 서브타입이 아니라 역할 코드로 본다.
  - 법인소속개인회원은 법인회원에 소속된다.
  - 법인과 개인의 소속 사실은 법인소속이력으로 관리한다.
  - 법인소속개인회원은 유효한 법인소속이력을 가진 개인회원이다.
  - AID는 이용자 속성이 아니라 KERI식별자 엔터티로 관리한다.
  - AID 관계는 이용자와 KERI식별자의 식별 관계 엔터티로 관리한다.
  - AID 관계유형으로 보유, 운영, 서명, 조회 등을 구분한다.
  - AID를 보유하는 이용자와 AID를 운영하는 이용자는 다를 수 있다.
  - 지갑은 이용자 속성이 아니라 독립 엔터티로 관리한다.
  - 이용자와 지갑의 관계는 이용자지갑관계 교차 엔터티로 관리한다.
  - 한 이용자는 여러 지갑을 가질 수 있고, 하나의 지갑은 여러 이용자와 관계를 맺을 수 있다.
  - 지갑은 AID와 credential의 저장, 제어, 제시 수단이다.
  - QVI 발급자 AID는 QVI사업자가 보유하고 QVI직원이 운영한다.
  - 법인 AID는 법인회원이 보유하고 법인소속개인회원이 운영할 수 있다.
  - 개인 AID는 개인회원이 보유하고 운영할 수 있다.
  - AID 관계는 선분 이력으로 관리한다.
  - KEL/TEL 원문은 KERIA LMDB를 권위 저장소로 본다.
  - 업무 DB는 KEL/TEL의 최신 상태 스냅샷과 업무 참조 식별자만 우선 관리한다.
  - LE vLEI와 OOR은 QVI 발급자 AID가 발급한다.
  - ECR은 법인 AID가 발급한다.
  - QVI 업무 상태의 발급 완료와 holder admit 완료는 구분한다.
  - GLEIF 재단은 외부기관 서브타입의 인스턴스로 관리한다.
  - GEDA는 엔터티가 아니라 GLEIF 계열 KERI식별자 인스턴스이며, 식별자용도와 KERI식별자위임관계로 표현한다.
  - GLEIF Root AID, GEDA, QVI delegated AID의 신뢰체인은 KERI식별자와 KERI식별자위임관계로 업무 추적한다.
  - QVI Credential은 ACDC자격증명의 한 유형으로 관리한다.
  - 역할, 유형, 상태, 단계의 종류는 공통코드로 관리한다.
  - 역할 부여 사실과 기간은 QVI직원역할부여이력으로 관리한다.
  - 발급신청의 기본 진행 흐름은 신청, 접수, 과금, 발급 단계로 본다.
  - 발급신청단계이력은 recursive 관계로 선행/후행 단계를 표현한다.
  - 신규 credential 발급은 발급신청으로 관리하고, 발급 후 갱신/재발급/폐기 등 사후 업무는 자격증명생명주기신청으로 관리한다.
  - 상품과 요금정책은 과금항목 산정의 기준이며, 실제 청구 금액은 과금항목에 스냅샷으로 남긴다.
  - 과금은 발급신청에서 발생하며, 결제/환불/통계의 기준이 된다.
  - 결제수단은 카드, 가상계좌, 세금계산서 입금, 포인트, 무료 처리 등을 포함한다.
  - 한 과금은 여러 결제로 정산될 수 있고, 하나의 결제도 여러 과금에 적용될 수 있다.
  - 포인트 일부 결제와 카드/가상계좌 차액 결제는 결제적용으로 표현한다.
  - 세금계산서 방식은 계산서 발행과 입금 확인을 분리한다.
  - 취소환불은 과금 또는 결제에 대해 별도 엔터티로 관리한다.
  - 이용자포인트는 이용자별 포인트 원장 이력이며, 현재포인트는 각 이력 처리 후 잔액이다.
  - 과금통계는 원천 거래가 아니라 과금/결제/환불/포인트 원천 데이터에서 산출한 집계이다.
  - 약관은 버전 단위로 관리하고, 동의 사실은 약관동의이력으로 관리한다.
  - 알림통지는 업무 상태의 원천이 아니라 발송 이력과 이용자 안내를 위한 엔터티이다.
  - GLEIS API, GLEIF Reporting API, Sally/verifier, Witness, Watcher, KERIA 호출은 연계작업과 연계시도이력으로 추적한다.
  - 재시도와 장애 보정을 위해 연계작업은 상태, 재시도횟수, 다음재시도일시, 외부참조값을 가져야 한다.
  - 연계시도이력은 감사와 장애 분석에 필요한 요청/응답 요약을 남기되, secret과 개인정보 원문 저장은 제한한다.
  - QVI 인증 심사 항목은 운영 시스템의 엔터티가 아니라 구축/인증 참고 자료로 관리한다.
  - 게시판은 공지사항, 자료실, FAQ, 문의 등 포탈 콘텐츠 채널을 구분하는 설정 엔터티이다.
  - 자료실은 별도 엔터티로 분리하지 않고 게시판유형이 자료실인 게시판과 게시물/첨부파일 관계로 표현한다.
  - 게시물의 게시, 숨김, 폐기, 공개범위 변경은 게시물상태와 감사로그로 추적한다.
`;

export const DEFAULT_LOGICAL_YAML = `subject_area: QVI 이용자
notation: Barker-style nested subtype
version: 0.1
status: draft
source_ddl: doc/DB설계/vlei_qvi_db_oracle.sql

rules:
  - 모든 이용자는 이용자번호로 식별한다.
  - 이용자는 QVI직원 또는 회원 중 하나이다.
  - 회원은 법인회원 또는 개인회원 중 하나이다.
  - 개인회원은 법인소속개인회원 또는 일반개인회원 중 하나이다.
  - QVI직원의 관리자/담당자는 상호배타 서브타입이 아니라 복수 부여 가능한 역할로 관리한다.
  - 법인소속개인회원은 하나의 법인회원에 소속된다.
  - 일반개인회원은 특정 법인회원에 소속되지 않는다.
  - AID는 이용자/회원 속성으로 직접 관리하지 않고 KERI식별자 주제영역에서 관계 엔터티로 관리한다.

entities:
  - name: 이용자
    type: supertype
    identifier: 이용자번호
    discriminator: 이용자구분코드
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 이용자구분코드, domain: 이용자구분코드, required: true }
      - { name: 로그인ID, domain: 이메일주소, required: true }
      - { name: 비밀번호해시값, domain: 해시값, required: false }
      - { name: 이메일주소, domain: 이메일주소, required: false }
      - { name: 휴대전화번호, domain: 전화번호, required: false }
      - { name: 이용자상태코드, domain: 이용자상태코드, required: true }
      - { name: 최종로그인일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }
    subtype_sets:
      - name: 이용자구분
        disjoint: true
        total: true
        subtypes: [QVI직원, 회원]

  - name: QVI직원
    type: subtype
    supertype: 이용자
    identifier: 이용자번호
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 직원번호, domain: 직원번호, required: false }
      - { name: 직원명, domain: 성명, required: true }
      - { name: 부서명, domain: 명칭, required: false }
      - { name: 직위명, domain: 명칭, required: false }
      - { name: 재직상태코드, domain: 재직상태코드, required: true }

  - name: QVI직원역할
    type: entity
    identifier: [이용자번호, QVI직원역할코드]
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: QVI직원역할코드, domain: QVI직원역할코드, required: true, identifier: true }
      - { name: 역할부여일시, domain: 일시, required: true }
      - { name: 역할회수일시, domain: 일시, required: false }
      - { name: 역할부여자이용자번호, domain: 이용자번호, required: false }

  - name: 회원
    type: subtype
    supertype: 이용자
    identifier: 이용자번호
    discriminator: 회원구분코드
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 회원구분코드, domain: 회원구분코드, required: true }
      - { name: 회원가입일시, domain: 일시, required: true }
      - { name: 회원상태코드, domain: 회원상태코드, required: true }
      - { name: 약관동의일시, domain: 일시, required: false }
      - { name: 개인정보동의일시, domain: 일시, required: false }
    subtype_sets:
      - name: 회원구분
        disjoint: true
        total: true
        subtypes: [법인회원, 개인회원]

  - name: 법인회원
    type: subtype
    supertype: 회원
    identifier: 이용자번호
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 법인식별자, domain: LEI, required: true }
      - { name: 법인명, domain: 법인명, required: true }
      - { name: 국가코드, domain: 국가코드, required: true }
      - { name: 사업자등록번호, domain: 사업자등록번호, required: false }
      - { name: 업종명, domain: 명칭, required: false }
      - { name: 대표자명, domain: 성명, required: false }

  - name: 개인회원
    type: subtype
    supertype: 회원
    identifier: 이용자번호
    discriminator: 개인회원구분코드
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 개인회원구분코드, domain: 개인회원구분코드, required: true }
      - { name: 성명, domain: 성명, required: true }
      - { name: 생년월일, domain: 일자, required: false }
    subtype_sets:
      - name: 개인회원구분
        disjoint: true
        total: true
        subtypes: [법인소속개인회원, 일반개인회원]

  - name: 법인소속개인회원
    type: subtype
    supertype: 개인회원
    identifier: 이용자번호
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 소속법인이용자번호, domain: 이용자번호, required: true }
      - { name: 사원번호, domain: 사원번호, required: false }
      - { name: 부서명, domain: 명칭, required: false }
      - { name: 직위명, domain: 명칭, required: false }
      - { name: 소속상태코드, domain: 소속상태코드, required: true }
      - { name: 소속시작일자, domain: 일자, required: false }
      - { name: 소속종료일자, domain: 일자, required: false }

  - name: 일반개인회원
    type: subtype
    supertype: 개인회원
    identifier: 이용자번호
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: 개인서비스구분코드, domain: 개인서비스구분코드, required: false }

relationships:
  - name: 보유
    from: QVI직원
    to: QVI직원역할
    cardinality: one_to_many
    optionality:
      from: mandatory
      to: mandatory
    description: QVI직원은 하나 이상의 역할을 보유한다.

  - name: 소속
    from: 법인회원
    to: 법인소속개인회원
    cardinality: one_to_many
    optionality:
      from: mandatory
      to: optional
    description: 법인소속개인회원은 하나의 법인회원에 소속된다.
`;

export const DEFAULT_USER_ACCOUNT_LOGICAL_YAML = `subject_area: QVI 발급신청/생명주기
notation: Barker logical model
version: 0.1
status: draft
source_document: doc/DB설계/QVI 발급신청 생명주기 논리 모델.md
standard_document: doc/DB설계/QVI 상세 논리 모델 작성 기준.md
baseline_conceptual_model: doc/DB설계/QVI 개념 모델.md

relationship_notation:
  participation:
    optional_one: "0..1"
    mandatory_one: "1..1"
    optional_many: "0..M"
    mandatory_many: "1..M"
  identifying_rule: 부모 FK가 자식 PK에 포함되면 식별관계이다.
  non_identifying_rule: FK가 필수라도 자식 PK에 포함되지 않으면 비식별 참조 관계이다.

entities:
  - name: 발급신청
    type: supertype
    identifier: 신청번호
    subtype_set:
      total: true
      disjoint: true
      discriminator: 신청유형코드
      subtypes: [법인vLEI발급신청, OOR발급신청, ECR발급신청]
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true }
      - { name: 신청유형코드, domain: 발급신청유형코드, required: true }
      - { name: 신청상태코드, domain: 발급신청상태코드, required: true }
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 처리담당자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 결과자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 신청제목명, domain: 명칭, required: false }
      - { name: 신청사유내용, domain: 내용, required: false }
      - { name: 신청일시, domain: 일시, required: true }
      - { name: 접수일시, domain: 일시, required: false }
      - { name: 완료일시, domain: 일시, required: false }
      - { name: 반려사유내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 법인vLEI발급신청
    type: subtype
    supertype: 발급신청
    identifier: 신청번호
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 법인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 법인KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: QVI발급자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 신청시점LEI, domain: LEI, required: true }
      - { name: 신청시점법인명, domain: 명칭, required: true }
      - { name: 신청시점국가코드, domain: 국가코드, required: false }
      - { name: LEI상태코드, domain: LEI상태코드, required: false }
      - { name: 법인확인여부, domain: 여부, required: true }

  - name: OOR발급신청
    type: subtype
    supertype: 발급신청
    identifier: 신청번호
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 법인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 대상법인소속개인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 기준LEvLEI자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 수신자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 공식역할명, domain: 명칭, required: true }
      - { name: 역할설명내용, domain: 내용, required: false }
      - { name: 소속확인여부, domain: 여부, required: true }

  - name: ECR발급신청
    type: subtype
    supertype: 발급신청
    identifier: 신청번호
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 법인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 대상법인소속개인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 기준OOR자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: LE발급자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 수신자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 업무맥락명, domain: 명칭, required: true }
      - { name: 역할명, domain: 명칭, required: true }
      - { name: 업무맥락설명내용, domain: 내용, required: false }

  - name: 발급신청단계이력
    type: entity
    identifier: 발급신청단계이력번호
    attributes:
      - { name: 발급신청단계이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 신청번호, domain: 신청번호, required: true, foreign_key: true }
      - { name: 선행발급신청단계이력번호, domain: 이력번호, required: false, foreign_key: true }
      - { name: 단계구분코드, domain: 발급신청단계구분코드, required: true }
      - { name: 단계상태코드, domain: 단계상태코드, required: true }
      - { name: 처리자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 시작일시, domain: 일시, required: false }
      - { name: 처리일시, domain: 일시, required: true }
      - { name: 종료일시, domain: 일시, required: false }
      - { name: 처리내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 첨부파일
    type: entity
    identifier: 첨부파일번호
    attributes:
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true }
      - { name: 원본파일명, domain: 파일명, required: true }
      - { name: 저장파일명, domain: 파일명, required: true }
      - { name: 파일경로값, domain: 경로값, required: true }
      - { name: MIME유형명, domain: 명칭, required: false }
      - { name: 파일크기, domain: 건수, required: false }
      - { name: 파일해시값, domain: 해시값, required: false }
      - { name: 파일상태코드, domain: 첨부파일상태코드, required: true }
      - { name: 업로드자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 업로드일시, domain: 일시, required: true }
      - { name: 삭제일시, domain: 일시, required: false }

  - name: 발급신청첨부파일
    type: relationship_entity
    identifier: [신청번호, 첨부파일번호]
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일유형코드, domain: 첨부파일유형코드, required: true }
      - { name: 첨부순번, domain: 순번, required: true }
      - { name: 필수제출여부, domain: 여부, required: true }
      - { name: 검증상태코드, domain: 첨부파일검증상태코드, required: true }
      - { name: 검증자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 검증일시, domain: 일시, required: false }

  - name: 자격증명생명주기신청
    type: entity
    identifier: 생명주기신청번호
    attributes:
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: true, identifier: true }
      - { name: 대상자격증명번호, domain: ACDC자격증명번호, required: true, foreign_key: true }
      - { name: 생명주기신청유형코드, domain: 생명주기신청유형코드, required: true }
      - { name: 생명주기신청상태코드, domain: 생명주기신청상태코드, required: true }
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 처리담당자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 유발발급신청번호, domain: 신청번호, required: false, foreign_key: true }
      - { name: 신청사유내용, domain: 내용, required: false }
      - { name: 신청일시, domain: 일시, required: true }
      - { name: 접수일시, domain: 일시, required: false }
      - { name: 완료일시, domain: 일시, required: false }
      - { name: 처리결과내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 자격증명생명주기신청단계이력
    type: entity
    identifier: 생명주기신청단계이력번호
    attributes:
      - { name: 생명주기신청단계이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: true, foreign_key: true }
      - { name: 선행생명주기신청단계이력번호, domain: 이력번호, required: false, foreign_key: true }
      - { name: 단계구분코드, domain: 생명주기단계구분코드, required: true }
      - { name: 단계상태코드, domain: 단계상태코드, required: true }
      - { name: 처리자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 시작일시, domain: 일시, required: false }
      - { name: 처리일시, domain: 일시, required: true }
      - { name: 종료일시, domain: 일시, required: false }
      - { name: 처리내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 생명주기신청첨부파일
    type: relationship_entity
    identifier: [생명주기신청번호, 첨부파일번호]
    attributes:
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일유형코드, domain: 첨부파일유형코드, required: true }
      - { name: 첨부순번, domain: 순번, required: true }
      - { name: 필수제출여부, domain: 여부, required: true }
      - { name: 검증상태코드, domain: 첨부파일검증상태코드, required: true }
      - { name: 검증자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 검증일시, domain: 일시, required: false }

external_entities:
  - { name: 이용자, owner: QVI 이용자/가입/계정 }
  - { name: KERI식별자, owner: QVI KERI/지갑 }
  - { name: ACDC자격증명, owner: QVI KERI/지갑 }
  - { name: 과금, owner: QVI 과금/결제/포인트 }
  - { name: 연계작업, owner: QVI 외부연계/감사/알림 }

relationships:
  - id: R-APP-001
    parent: 이용자
    child: 발급신청
    parent_to_child: 신청한다
    child_to_parent: 신청된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [신청자이용자번호]
    barker_sentence: 각 이용자는 발급신청을 0개 이상 신청할 수 있다. 각 발급신청은 반드시 하나의 신청자 이용자를 가진다.
  - id: R-APP-002
    parent: 이용자
    child: 발급신청
    parent_to_child: 처리담당한다
    child_to_parent: 처리담당된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리담당자이용자번호]
    barker_sentence: 각 이용자는 발급신청을 0개 이상 처리담당할 수 있다. 각 발급신청은 처리담당자가 없거나 하나일 수 있다.
  - id: R-APP-003
    parent: 발급신청
    child: 법인vLEI발급신청
    parent_to_child: 서브타입이다
    child_to_parent: 상속한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 법인vLEI발급신청일 수도 있다. 각 법인vLEI발급신청은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-004
    parent: 발급신청
    child: OOR발급신청
    parent_to_child: 서브타입이다
    child_to_parent: 상속한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 OOR발급신청일 수도 있다. 각 OOR발급신청은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-005
    parent: 발급신청
    child: ECR발급신청
    parent_to_child: 서브타입이다
    child_to_parent: 상속한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 ECR발급신청일 수도 있다. 각 ECR발급신청은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-006
    parent: 발급신청
    child: 발급신청단계이력
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 하나 이상의 단계 이력을 가진다. 각 발급신청단계이력은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-007
    parent: 발급신청단계이력
    child: 발급신청단계이력
    parent_to_child: 선행한다
    child_to_parent: 후행한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [선행발급신청단계이력번호]
    recursive: true
    barker_sentence: 각 단계 이력은 후행 단계 이력을 0개 이상 가질 수 있다. 각 단계 이력은 선행 단계 이력이 없거나 하나일 수 있다.
  - id: R-APP-008
    parent: 이용자
    child: 발급신청단계이력
    parent_to_child: 처리한다
    child_to_parent: 처리된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리자이용자번호]
    barker_sentence: 각 이용자는 단계 이력을 0개 이상 처리할 수 있다. 각 단계 이력은 처리자가 없거나 하나일 수 있다.
  - id: R-APP-009
    parent: 발급신청
    child: 발급신청첨부파일
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 첨부파일 관계를 0개 이상 가질 수 있다. 각 발급신청첨부파일은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-010
    parent: 첨부파일
    child: 발급신청첨부파일
    parent_to_child: 첨부된다
    child_to_parent: 연결된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [첨부파일번호]
    barker_sentence: 각 첨부파일은 발급신청에 0회 이상 연결될 수 있다. 각 발급신청첨부파일은 반드시 하나의 첨부파일을 가진다.
  - id: R-APP-011
    parent: 발급신청
    child: 과금
    parent_to_child: 발생시킨다
    child_to_parent: 발생근거가 된다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 과금을 0개 또는 1개 발생시킬 수 있다. 각 과금은 발급신청 근거가 없거나 하나일 수 있다.
  - id: R-APP-012
    parent: ACDC자격증명
    child: 발급신청
    parent_to_child: 결과가 된다
    child_to_parent: 생성한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결과자격증명번호]
    barker_sentence: 각 ACDC자격증명은 발급신청의 결과가 아닐 수도 있고 하나의 결과일 수 있다. 각 발급신청은 결과 credential이 없거나 하나일 수 있다.
  - id: R-APP-013
    parent: 이용자
    child: 법인vLEI발급신청
    parent_to_child: 발급대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [법인회원이용자번호]
    barker_sentence: 각 이용자는 법인회원 자격으로 LE vLEI 신청 대상이 0회 이상 될 수 있다. 각 법인vLEI발급신청은 반드시 하나의 법인회원 이용자를 대상으로 한다.
  - id: R-APP-014
    parent: 이용자
    child: OOR발급신청
    parent_to_child: 소속법인이 된다
    child_to_parent: 소속법인으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [법인회원이용자번호]
    barker_sentence: 각 이용자는 법인회원 자격으로 OOR 신청의 소속 법인이 0회 이상 될 수 있다. 각 OOR발급신청은 반드시 하나의 법인회원 이용자를 가진다.
  - id: R-APP-015
    parent: 이용자
    child: OOR발급신청
    parent_to_child: 발급대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [대상법인소속개인회원이용자번호]
    barker_sentence: 각 이용자는 법인소속개인회원 자격으로 OOR 발급 대상이 0회 이상 될 수 있다. 각 OOR발급신청은 반드시 하나의 대상 법인소속개인회원 이용자를 가진다.
  - id: R-APP-016
    parent: ACDC자격증명
    child: OOR발급신청
    parent_to_child: 기준이 된다
    child_to_parent: 기준으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [기준LEvLEI자격증명번호]
    barker_sentence: 각 LE vLEI credential은 OOR 신청의 기준이 0회 이상 될 수 있다. 각 OOR발급신청은 발급 전까지 기준 LE vLEI credential이 없거나 하나일 수 있다.
  - id: R-APP-017
    parent: 이용자
    child: ECR발급신청
    parent_to_child: 소속법인이 된다
    child_to_parent: 소속법인으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [법인회원이용자번호]
    barker_sentence: 각 이용자는 법인회원 자격으로 ECR 신청의 소속 법인이 0회 이상 될 수 있다. 각 ECR발급신청은 반드시 하나의 법인회원 이용자를 가진다.
  - id: R-APP-018
    parent: 이용자
    child: ECR발급신청
    parent_to_child: 발급대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [대상법인소속개인회원이용자번호]
    barker_sentence: 각 이용자는 법인소속개인회원 자격으로 ECR 발급 대상이 0회 이상 될 수 있다. 각 ECR발급신청은 반드시 하나의 대상 법인소속개인회원 이용자를 가진다.
  - id: R-APP-019
    parent: ACDC자격증명
    child: ECR발급신청
    parent_to_child: 기준이 된다
    child_to_parent: 기준으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [기준OOR자격증명번호]
    barker_sentence: 각 OOR credential은 ECR 신청의 기준이 0회 이상 될 수 있다. 각 ECR발급신청은 발급 전까지 기준 OOR credential이 없거나 하나일 수 있다.
  - id: R-APP-020
    parent: KERI식별자
    child: 법인vLEI발급신청
    parent_to_child: 법인AID가 된다
    child_to_parent: 법인AID로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [법인KERI식별자번호]
    barker_sentence: 각 KERI식별자는 LE vLEI 신청의 법인 AID가 0회 이상 될 수 있다. 각 법인vLEI발급신청은 법인 AID가 없거나 하나일 수 있다.
  - id: R-APP-021
    parent: KERI식별자
    child: 법인vLEI발급신청
    parent_to_child: 발급자AID가 된다
    child_to_parent: 발급자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [QVI발급자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 LE vLEI 신청의 QVI 발급자 AID가 0회 이상 될 수 있다. 각 법인vLEI발급신청은 QVI 발급자 AID가 없거나 하나일 수 있다.
  - id: R-APP-022
    parent: KERI식별자
    child: OOR발급신청
    parent_to_child: 수신자AID가 된다
    child_to_parent: 수신자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [수신자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 OOR 신청의 수신자 AID가 0회 이상 될 수 있다. 각 OOR발급신청은 수신자 AID가 없거나 하나일 수 있다.
  - id: R-APP-023
    parent: KERI식별자
    child: ECR발급신청
    parent_to_child: LE발급자AID가 된다
    child_to_parent: 발급자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [LE발급자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 ECR 신청의 LE 발급자 AID가 0회 이상 될 수 있다. 각 ECR발급신청은 LE 발급자 AID가 없거나 하나일 수 있다.
  - id: R-APP-024
    parent: KERI식별자
    child: ECR발급신청
    parent_to_child: 수신자AID가 된다
    child_to_parent: 수신자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [수신자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 ECR 신청의 수신자 AID가 0회 이상 될 수 있다. 각 ECR발급신청은 수신자 AID가 없거나 하나일 수 있다.
  - id: R-APP-025
    parent: ACDC자격증명
    child: 자격증명생명주기신청
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [대상자격증명번호]
    barker_sentence: 각 ACDC자격증명은 생명주기 요청 대상이 0회 이상 될 수 있다. 각 자격증명생명주기신청은 반드시 하나의 대상 credential을 가진다.
  - id: R-APP-026
    parent: 이용자
    child: 자격증명생명주기신청
    parent_to_child: 신청한다
    child_to_parent: 신청된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [신청자이용자번호]
    barker_sentence: 각 이용자는 생명주기 요청을 0개 이상 신청할 수 있다. 각 생명주기 요청은 반드시 하나의 신청자 이용자를 가진다.
  - id: R-APP-027
    parent: 이용자
    child: 자격증명생명주기신청
    parent_to_child: 처리담당한다
    child_to_parent: 처리담당된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리담당자이용자번호]
    barker_sentence: 각 이용자는 생명주기 요청을 0개 이상 처리담당할 수 있다. 각 생명주기 요청은 처리담당자가 없거나 하나일 수 있다.
  - id: R-APP-028
    parent: 발급신청
    child: 자격증명생명주기신청
    parent_to_child: 유발결과가 된다
    child_to_parent: 유발한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [유발발급신청번호]
    barker_sentence: 각 발급신청은 생명주기 요청이 유발한 신규 발급신청이 아닐 수도 있고 하나일 수 있다. 각 생명주기 요청은 신규 발급신청을 유발하지 않거나 하나만 유발할 수 있다.
  - id: R-APP-029
    parent: 자격증명생명주기신청
    child: 자격증명생명주기신청단계이력
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기 요청은 하나 이상의 단계 이력을 가진다. 각 생명주기 단계 이력은 반드시 하나의 생명주기 요청에 속한다.
  - id: R-APP-030
    parent: 자격증명생명주기신청단계이력
    child: 자격증명생명주기신청단계이력
    parent_to_child: 선행한다
    child_to_parent: 후행한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [선행생명주기신청단계이력번호]
    recursive: true
    barker_sentence: 각 생명주기 단계 이력은 후행 단계 이력을 0개 이상 가질 수 있다. 각 생명주기 단계 이력은 선행 단계 이력이 없거나 하나일 수 있다.
  - id: R-APP-031
    parent: 이용자
    child: 자격증명생명주기신청단계이력
    parent_to_child: 처리한다
    child_to_parent: 처리된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리자이용자번호]
    barker_sentence: 각 이용자는 생명주기 단계 이력을 0개 이상 처리할 수 있다. 각 생명주기 단계 이력은 처리자가 없거나 하나일 수 있다.
  - id: R-APP-032
    parent: 자격증명생명주기신청
    child: 생명주기신청첨부파일
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기 요청은 첨부파일 관계를 0개 이상 가질 수 있다. 각 생명주기신청첨부파일은 반드시 하나의 생명주기 요청에 속한다.
  - id: R-APP-033
    parent: 첨부파일
    child: 생명주기신청첨부파일
    parent_to_child: 첨부된다
    child_to_parent: 연결된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [첨부파일번호]
    barker_sentence: 각 첨부파일은 생명주기 요청에 0회 이상 연결될 수 있다. 각 생명주기신청첨부파일은 반드시 하나의 첨부파일을 가진다.
  - id: R-APP-034
    parent: 발급신청
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 발급신청에서 유발되지 않았거나 하나의 발급신청에서 유발된다.
  - id: R-APP-035
    parent: 자격증명생명주기신청
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기 요청은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 생명주기 요청에서 유발되지 않았거나 하나의 생명주기 요청에서 유발된다.

business_rules:
  - 발급신청 서브타입은 total/disjoint이다.
  - 발급신청 생성 또는 접수 시 최초 발급신청단계이력을 함께 생성한다.
  - 발급 완료 상태의 발급신청은 결과자격증명번호를 반드시 가져야 한다.
  - 발급 실패, 반려, 취소 상태의 발급신청은 결과자격증명번호를 가지지 않는다.
  - OOR 발급 전에는 기준LEvLEI자격증명번호가 필요하다.
  - ECR 발급 전에는 기준OOR자격증명번호가 필요하다.
  - 폐기 생명주기신청 완료는 ACDC자격증명 상태와 TEL 상태가 모두 폐기 반영된 뒤 확정한다.
  - 연계작업 실패와 재시도는 신청 상태와 분리한다.

code_groups:
  발급신청유형코드: [LE_VLEI, OOR, ECR]
  발급신청상태코드: [DRAFT, REQUESTED, RECEIVED, UNDER_REVIEW, PAYMENT_PENDING, PAYMENT_CONFIRMED, READY_TO_ISSUE, ISSUING, ISSUED, REJECTED, CANCELED, FAILED]
  발급신청단계구분코드: [REQUEST, RECEIVE, DOCUMENT_REVIEW, LEI_VERIFY, MEMBER_VERIFY, BILLING, PAYMENT_CONFIRM, ISSUE_PREPARE, ISSUE, ADMIT_CONFIRM, COMPLETE, REJECT, CANCEL]
  단계상태코드: [WAITING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED, CANCELED]
  첨부파일유형코드: [LE_DOCUMENT, AUTHORIZATION, EMPLOYEE_PROOF, ROLE_PROOF, PAYMENT_PROOF, ETC]
  첨부파일상태코드: [UPLOADED, VERIFIED, REJECTED, DELETED]
  첨부파일검증상태코드: [NOT_VERIFIED, VERIFIED, REJECTED]
  생명주기신청유형코드: [RENEWAL, REISSUE, REVOCATION, STATUS_SYNC, HOLDER_CHANGE]
  생명주기신청상태코드: [REQUESTED, RECEIVED, UNDER_REVIEW, PROCESSING, COMPLETED, REJECTED, CANCELED, FAILED]
  생명주기단계구분코드: [REQUEST, RECEIVE, REVIEW, BILLING, PAYMENT_CONFIRM, REVOKE_PREPARE, REVOKE, REISSUE_PREPARE, ISSUE, STATUS_SYNC, COMPLETE, REJECT, CANCEL]
  LEI상태코드: [ISSUED, LAPSED, RETIRED, MERGED, UNKNOWN]
`;

export const DEFAULT_KERI_WALLET_LOGICAL_YAML = `subject_area: QVI KERI/지갑
notation: Barker logical model
version: 0.1
status: draft
source_document: doc/DB설계/QVI KERI 지갑 논리 모델.md
standard_document: doc/DB설계/QVI 상세 논리 모델 작성 기준.md
baseline_conceptual_model: doc/DB설계/QVI 개념 모델.md

relationship_notation:
  participation:
    optional_one: "0..1"
    mandatory_one: "1..1"
    optional_many: "0..M"
    mandatory_many: "1..M"
  identifying_rule: 부모 FK가 자식 PK에 포함되면 식별관계이다.
  non_identifying_rule: FK가 필수라도 자식 PK에 포함되지 않으면 비식별 참조 관계이다.

entities:
  - name: 지갑
    type: entity
    identifier: 지갑번호
    attributes:
      - { name: 지갑번호, domain: 지갑번호, required: true, identifier: true }
      - { name: 지갑유형코드, domain: 지갑유형코드, required: true }
      - { name: 지갑상태코드, domain: 지갑상태코드, required: true }
      - { name: 지갑명, domain: 명칭, required: false }
      - { name: 지갑식별값, domain: 식별값, required: false }
      - { name: 제공자명, domain: 명칭, required: false }
      - { name: 생성일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 이용자지갑관계
    type: relationship_entity
    identifier: [이용자번호, 지갑번호, 지갑관계유형코드, 유효시작일시]
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true, foreign_key: true }
      - { name: 지갑번호, domain: 지갑번호, required: true, identifier: true, foreign_key: true }
      - { name: 지갑관계유형코드, domain: 지갑관계유형코드, required: true, identifier: true }
      - { name: 유효시작일시, domain: 일시, required: true, identifier: true }
      - { name: 유효종료일시, domain: 일시, required: false }
      - { name: 주지갑여부, domain: 여부, required: true }
      - { name: 지갑관계상태코드, domain: 관계상태코드, required: true }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KERI식별자
    type: entity
    identifier: KERI식별자번호
    attributes:
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true }
      - { name: AID, domain: AID, required: true }
      - { name: 식별자별칭명, domain: 명칭, required: false }
      - { name: KERIA에이전트구분코드, domain: KERIA에이전트구분코드, required: true }
      - { name: 식별자용도코드, domain: KERI식별자용도코드, required: true }
      - { name: 식별자상태코드, domain: KERI식별자상태코드, required: true }
      - { name: 관리지갑번호, domain: 지갑번호, required: false, foreign_key: true }
      - { name: 생성일시, domain: 일시, required: false }
      - { name: 최종회전일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KERI식별자관계
    type: relationship_entity
    identifier: [이용자번호, KERI식별자번호, KERI식별자관계유형코드, 유효시작일시]
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true, foreign_key: true }
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true, foreign_key: true }
      - { name: KERI식별자관계유형코드, domain: KERI식별자관계유형코드, required: true, identifier: true }
      - { name: 유효시작일시, domain: 일시, required: true, identifier: true }
      - { name: 유효종료일시, domain: 일시, required: false }
      - { name: 기본여부, domain: 여부, required: true }
      - { name: 관계상태코드, domain: 관계상태코드, required: true }
      - { name: 권한부여자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KERI식별자위임관계
    type: relationship_entity
    identifier: [위임자KERI식별자번호, 수임자KERI식별자번호, 위임관계유형코드, 유효시작일시]
    attributes:
      - { name: 위임자KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true, foreign_key: true }
      - { name: 수임자KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true, foreign_key: true }
      - { name: 위임관계유형코드, domain: 위임관계유형코드, required: true, identifier: true }
      - { name: 유효시작일시, domain: 일시, required: true, identifier: true }
      - { name: 유효종료일시, domain: 일시, required: false }
      - { name: 위임상태코드, domain: 위임상태코드, required: true }
      - { name: 위임근거값, domain: 식별값, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KEL
    type: dependent_entity
    identifier: KERI식별자번호
    attributes:
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true, foreign_key: true }
      - { name: 현재순번, domain: 순번, required: true }
      - { name: 현재이벤트SAID, domain: SAID, required: false }
      - { name: 현재이벤트다이제스트값, domain: 다이제스트값, required: false }
      - { name: 최종이벤트유형코드, domain: KEL이벤트유형코드, required: false }
      - { name: 최종동기화일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: CredentialRegistry
    type: entity
    identifier: 레지스트리번호
    attributes:
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true, identifier: true }
      - { name: 레지스트리식별자, domain: 레지스트리식별자, required: true }
      - { name: 발급자KERI식별자번호, domain: KERI식별자번호, required: true, foreign_key: true }
      - { name: 레지스트리명, domain: 명칭, required: false }
      - { name: 레지스트리상태코드, domain: 레지스트리상태코드, required: true }
      - { name: 생성일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: TEL
    type: dependent_entity
    identifier: 레지스트리번호
    attributes:
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true, identifier: true, foreign_key: true }
      - { name: 현재순번, domain: 순번, required: true }
      - { name: 현재이벤트SAID, domain: SAID, required: false }
      - { name: 최종이벤트유형코드, domain: TEL이벤트유형코드, required: false }
      - { name: 최종동기화일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: ACDC자격증명
    type: entity
    identifier: 자격증명번호
    attributes:
      - { name: 자격증명번호, domain: 자격증명번호, required: true, identifier: true }
      - { name: 자격증명식별자, domain: SAID, required: true }
      - { name: 스키마SAID, domain: SAID, required: true }
      - { name: 자격증명유형코드, domain: ACDC자격증명유형코드, required: true }
      - { name: 발급자KERI식별자번호, domain: KERI식별자번호, required: true, foreign_key: true }
      - { name: 보유자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true, foreign_key: true }
      - { name: 보관지갑번호, domain: 지갑번호, required: false, foreign_key: true }
      - { name: 발급상태코드, domain: ACDC발급상태코드, required: true }
      - { name: IPEXGrantSAID, domain: SAID, required: false }
      - { name: Admit여부, domain: 여부, required: true }
      - { name: 폐기여부, domain: 여부, required: true }
      - { name: 발급일시, domain: 일시, required: false }
      - { name: 수락일시, domain: 일시, required: false }
      - { name: 폐기일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

relationships:
  - id: R-KER-001
    parent: 이용자
    child: KERI식별자관계
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [이용자번호]
    external_parent: true
    barker_sentence: 각 이용자는 KERI식별자관계를 0개 이상 가질 수 있다. 각 KERI식별자관계는 반드시 하나의 이용자에 속한다.

  - id: R-KER-002
    parent: KERI식별자
    child: KERI식별자관계
    parent_to_child: 대상이 된다
    child_to_parent: 연결된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [KERI식별자번호]
    barker_sentence: 각 KERI식별자는 이용자 관계를 0개 이상 가질 수 있다. 각 KERI식별자관계는 반드시 하나의 KERI식별자에 연결된다.

  - id: R-KER-003
    parent: 이용자
    child: 이용자지갑관계
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [이용자번호]
    external_parent: true
    barker_sentence: 각 이용자는 지갑 관계를 0개 이상 가질 수 있다. 각 이용자지갑관계는 반드시 하나의 이용자에 속한다.

  - id: R-KER-004
    parent: 지갑
    child: 이용자지갑관계
    parent_to_child: 대상이 된다
    child_to_parent: 연결된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [지갑번호]
    barker_sentence: 각 지갑은 이용자 관계를 0개 이상 가질 수 있다. 각 이용자지갑관계는 반드시 하나의 지갑에 연결된다.

  - id: R-KER-005
    parent: 지갑
    child: KERI식별자
    parent_to_child: 관리한다
    child_to_parent: 관리된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [관리지갑번호]
    barker_sentence: 각 지갑은 KERI식별자를 0개 이상 관리할 수 있다. 각 KERI식별자는 현재 주 관리 지갑이 없거나 하나일 수 있다.

  - id: R-KER-006
    parent: KERI식별자
    child: KEL
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: one_to_one
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [KERI식별자번호]
    barker_sentence: 각 KERI식별자는 KEL 스냅샷을 0개 또는 1개 가진다. 각 KEL은 반드시 하나의 KERI식별자에 속한다.

  - id: R-KER-007
    parent: KERI식별자
    child: CredentialRegistry
    parent_to_child: 생성한다
    child_to_parent: 생성된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [발급자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 registry를 0개 이상 생성할 수 있다. 각 registry는 반드시 하나의 발급자 KERI식별자가 생성한다.

  - id: R-KER-008
    parent: CredentialRegistry
    child: TEL
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: one_to_one
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [레지스트리번호]
    barker_sentence: 각 registry는 TEL 스냅샷을 0개 또는 1개 가진다. 각 TEL은 반드시 하나의 registry에 속한다.

  - id: R-KER-009
    parent: CredentialRegistry
    child: ACDC자격증명
    parent_to_child: 등록한다
    child_to_parent: 등록된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [레지스트리번호]
    barker_sentence: 각 registry는 credential을 0개 이상 등록할 수 있다. 각 ACDC자격증명은 반드시 하나의 registry에 등록된다.

  - id: R-KER-010
    parent: KERI식별자
    child: KERI식별자위임관계
    parent_to_child: 위임한다
    child_to_parent: 위임자로 연결된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [위임자KERI식별자번호]
    role: delegator
    barker_sentence: 각 KERI식별자는 다른 KERI식별자에게 0회 이상 위임할 수 있다. 각 위임관계는 반드시 하나의 위임자 KERI식별자를 가진다.

  - id: R-KER-011
    parent: KERI식별자
    child: KERI식별자위임관계
    parent_to_child: 위임받는다
    child_to_parent: 수임자로 연결된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [수임자KERI식별자번호]
    role: delegatee
    barker_sentence: 각 KERI식별자는 다른 KERI식별자로부터 0회 이상 위임받을 수 있다. 각 위임관계는 반드시 하나의 수임자 KERI식별자를 가진다.

  - id: R-KER-012
    parent: 지갑
    child: ACDC자격증명
    parent_to_child: 보관한다
    child_to_parent: 보관된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [보관지갑번호]
    barker_sentence: 각 지갑은 credential을 0개 이상 보관할 수 있다. 각 ACDC자격증명은 현재 주 보관 지갑이 없거나 하나일 수 있다.

  - id: R-KER-013
    parent: KERI식별자
    child: ACDC자격증명
    parent_to_child: 발급한다
    child_to_parent: 발급된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [발급자KERI식별자번호]
    role: issuer
    barker_sentence: 각 KERI식별자는 credential을 0개 이상 발급할 수 있다. 각 ACDC자격증명은 반드시 하나의 발급자 KERI식별자를 가진다.

  - id: R-KER-014
    parent: KERI식별자
    child: ACDC자격증명
    parent_to_child: 보유한다
    child_to_parent: 보유된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [보유자KERI식별자번호]
    role: holder
    barker_sentence: 각 KERI식별자는 credential을 0개 이상 보유할 수 있다. 각 ACDC자격증명은 holder KERI식별자가 없거나 하나일 수 있다.

  - id: R-KER-015
    parent: 이용자
    child: KERI식별자관계
    parent_to_child: 부여한다
    child_to_parent: 부여된다
    cardinality: one_to_many
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [권한부여자이용자번호]
    external_parent: true
    barker_sentence: 각 이용자는 KERI식별자관계를 0회 이상 부여할 수 있다. 각 KERI식별자관계는 권한부여자가 없거나 하나의 이용자를 가진다.

relationship_rules:
  - KERI식별자관계와 이용자지갑관계의 유효기간은 동일 부모 조합과 동일 관계유형 안에서 겹칠 수 없다.
  - 활성 지갑은 하나 이상의 현재 유효한 이용자지갑관계를 가져야 한다.
  - 활성 KERI식별자는 하나 이상의 현재 유효한 보유자 또는 운영자 KERI식별자관계를 가져야 한다.
  - KERI식별자.관리지갑번호와 ACDC자격증명.보관지갑번호는 현재 스냅샷이다.
  - KEL과 TEL은 원문 이벤트가 아니라 현재 상태 스냅샷이다.
  - GLEIF Root AID, GEDA, QVI delegated AID는 KERI식별자용도코드와 KERI식별자위임관계로 구분한다.
  - ACDC자격증명의 발급 완료와 holder admit 완료는 다른 업무 상태이다.

business_rules:
  - QVI 발급자 AID는 QVI사업자가 보유하고 QVI직원이 운영할 수 있다.
  - 법인 AID는 법인회원이 보유하고 법인소속개인회원이 운영할 수 있다.
  - 개인 AID는 개인회원이 보유하고 운영할 수 있다.
  - GLEIF 재단은 외부기관 이용자 인스턴스이고, GLEIF Root AID와 GEDA는 KERI식별자 인스턴스이다.
  - GEDA는 엔터티가 아니라 식별자용도 또는 위임관계유형으로 표현한다.
  - LE vLEI와 OOR은 QVI 발급자 AID가 발급한다.
  - ECR은 법인 AID가 발급한다.
  - ACDC자격증명의 발급자는 반드시 활성 KERI식별자여야 한다.
  - ACDC자격증명의 holder가 있는 경우 holder도 활성 KERI식별자여야 한다.
  - QVI 업무 상태의 발급 완료는 issue/grant 성공 기준이며 holder admit 완료와 구분한다.

code_groups:
  지갑유형코드: [BROWSER_EXTENSION, MOBILE_APP, DESKTOP_APP, SERVER_MANAGED]
  지갑상태코드: [CREATING, ACTIVE, SUSPENDED, LOST, CLOSED]
  지갑관계유형코드: [OWNER, OPERATOR, VIEWER, RECOVERY_MANAGER]
  KERIA에이전트구분코드: [QVI_KERIA, LE_KERIA, USER_KERIA]
  KERI식별자용도코드: [GLEIF_ROOT, GLEIF_GEDA, QVI_ISSUER, QVI_DELEGATED, LEGAL_ENTITY, EMPLOYEE, INDIVIDUAL]
  KERI식별자상태코드: [CREATING, ACTIVE, ROTATED, SUSPENDED, CLOSED]
  KERI식별자관계유형코드: [HOLDER, OWNER, OPERATOR, SIGNER, VIEWER]
  위임관계유형코드: [GEDA_DELEGATION, QVI_DELEGATION, TRUST_CHAIN]
  관계상태코드: [ACTIVE, SUSPENDED, ENDED]
  레지스트리상태코드: [CREATING, ACTIVE, CLOSED]
  ACDC자격증명유형코드: [QVI_CREDENTIAL, LE_VLEI, OOR, ECR]
  ACDC발급상태코드: [PREPARED, ISSUED, GRANTED, ADMITTED, REVOKED, FAILED]
  KEL이벤트유형코드: [ICP, ROT, IXN]
  TEL이벤트유형코드: [ISS, REV]
`;

export const DEFAULT_APPLICATION_LIFECYCLE_LOGICAL_YAML = `subject_area: QVI 발급신청/생명주기
notation: Barker logical model
version: 0.1
status: draft
source_document: doc/DB설계/QVI 발급신청 생명주기 논리 모델.md
standard_document: doc/DB설계/QVI 상세 논리 모델 작성 기준.md
baseline_conceptual_model: doc/DB설계/QVI 개념 모델.md

relationship_notation:
  participation:
    optional_one: "0..1"
    mandatory_one: "1..1"
    optional_many: "0..M"
    mandatory_many: "1..M"
  identifying_rule: 부모 FK가 자식 PK에 포함되면 식별관계이다.
  non_identifying_rule: FK가 필수라도 자식 PK에 포함되지 않으면 비식별 참조 관계이다.

entities:
  - name: 발급신청
    type: supertype
    identifier: 신청번호
    subtype_set:
      total: true
      disjoint: true
      discriminator: 신청유형코드
      subtypes: [법인vLEI발급신청, OOR발급신청, ECR발급신청]
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true }
      - { name: 신청유형코드, domain: 발급신청유형코드, required: true }
      - { name: 신청상태코드, domain: 발급신청상태코드, required: true }
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 처리담당자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 결과자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 신청제목명, domain: 명칭, required: false }
      - { name: 신청사유내용, domain: 내용, required: false }
      - { name: 신청일시, domain: 일시, required: true }
      - { name: 접수일시, domain: 일시, required: false }
      - { name: 완료일시, domain: 일시, required: false }
      - { name: 반려사유내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 법인vLEI발급신청
    type: subtype
    supertype: 발급신청
    identifier: 신청번호
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 법인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 법인KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: QVI발급자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 신청시점LEI, domain: LEI, required: true }
      - { name: 신청시점법인명, domain: 명칭, required: true }
      - { name: 신청시점국가코드, domain: 국가코드, required: false }
      - { name: LEI상태코드, domain: LEI상태코드, required: false }
      - { name: 법인확인여부, domain: 여부, required: true }

  - name: OOR발급신청
    type: subtype
    supertype: 발급신청
    identifier: 신청번호
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 법인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 대상법인소속개인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 기준LEvLEI자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 수신자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 공식역할명, domain: 명칭, required: true }
      - { name: 역할설명내용, domain: 내용, required: false }
      - { name: 소속확인여부, domain: 여부, required: true }

  - name: ECR발급신청
    type: subtype
    supertype: 발급신청
    identifier: 신청번호
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 법인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 대상법인소속개인회원이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 기준OOR자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: LE발급자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 수신자KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: 업무맥락명, domain: 명칭, required: true }
      - { name: 역할명, domain: 명칭, required: true }
      - { name: 업무맥락설명내용, domain: 내용, required: false }

  - name: 발급신청단계이력
    type: entity
    identifier: 발급신청단계이력번호
    attributes:
      - { name: 발급신청단계이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 신청번호, domain: 신청번호, required: true, foreign_key: true }
      - { name: 선행발급신청단계이력번호, domain: 이력번호, required: false, foreign_key: true }
      - { name: 단계구분코드, domain: 발급신청단계구분코드, required: true }
      - { name: 단계상태코드, domain: 단계상태코드, required: true }
      - { name: 처리자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 시작일시, domain: 일시, required: false }
      - { name: 처리일시, domain: 일시, required: true }
      - { name: 종료일시, domain: 일시, required: false }
      - { name: 처리내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 첨부파일
    type: entity
    identifier: 첨부파일번호
    attributes:
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true }
      - { name: 원본파일명, domain: 파일명, required: true }
      - { name: 저장파일명, domain: 파일명, required: true }
      - { name: 파일경로값, domain: 경로값, required: true }
      - { name: MIME유형명, domain: 명칭, required: false }
      - { name: 파일크기, domain: 건수, required: false }
      - { name: 파일해시값, domain: 해시값, required: false }
      - { name: 파일상태코드, domain: 첨부파일상태코드, required: true }
      - { name: 업로드자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 업로드일시, domain: 일시, required: true }
      - { name: 삭제일시, domain: 일시, required: false }

  - name: 발급신청첨부파일
    type: relationship_entity
    identifier: [신청번호, 첨부파일번호]
    attributes:
      - { name: 신청번호, domain: 신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일유형코드, domain: 첨부파일유형코드, required: true }
      - { name: 첨부순번, domain: 순번, required: true }
      - { name: 필수제출여부, domain: 여부, required: true }
      - { name: 검증상태코드, domain: 첨부파일검증상태코드, required: true }
      - { name: 검증자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 검증일시, domain: 일시, required: false }

  - name: 자격증명생명주기신청
    type: entity
    identifier: 생명주기신청번호
    attributes:
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: true, identifier: true }
      - { name: 대상자격증명번호, domain: ACDC자격증명번호, required: true, foreign_key: true }
      - { name: 생명주기신청유형코드, domain: 생명주기신청유형코드, required: true }
      - { name: 생명주기신청상태코드, domain: 생명주기신청상태코드, required: true }
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 처리담당자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 유발발급신청번호, domain: 신청번호, required: false, foreign_key: true }
      - { name: 신청사유내용, domain: 내용, required: false }
      - { name: 신청일시, domain: 일시, required: true }
      - { name: 접수일시, domain: 일시, required: false }
      - { name: 완료일시, domain: 일시, required: false }
      - { name: 처리결과내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 자격증명생명주기신청단계이력
    type: entity
    identifier: 생명주기신청단계이력번호
    attributes:
      - { name: 생명주기신청단계이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: true, foreign_key: true }
      - { name: 선행생명주기신청단계이력번호, domain: 이력번호, required: false, foreign_key: true }
      - { name: 단계구분코드, domain: 생명주기단계구분코드, required: true }
      - { name: 단계상태코드, domain: 단계상태코드, required: true }
      - { name: 처리자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 시작일시, domain: 일시, required: false }
      - { name: 처리일시, domain: 일시, required: true }
      - { name: 종료일시, domain: 일시, required: false }
      - { name: 처리내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 생명주기신청첨부파일
    type: relationship_entity
    identifier: [생명주기신청번호, 첨부파일번호]
    attributes:
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일유형코드, domain: 첨부파일유형코드, required: true }
      - { name: 첨부순번, domain: 순번, required: true }
      - { name: 필수제출여부, domain: 여부, required: true }
      - { name: 검증상태코드, domain: 첨부파일검증상태코드, required: true }
      - { name: 검증자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 검증일시, domain: 일시, required: false }

external_entities:
  - { name: 이용자, owner: QVI 이용자/가입/계정 }
  - { name: KERI식별자, owner: QVI KERI/지갑 }
  - { name: ACDC자격증명, owner: QVI KERI/지갑 }
  - { name: 과금, owner: QVI 과금/결제/포인트 }
  - { name: 연계작업, owner: QVI 외부연계/감사/알림 }

relationships:
  - id: R-APP-001
    parent: 이용자
    child: 발급신청
    parent_to_child: 신청한다
    child_to_parent: 신청된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [신청자이용자번호]
    barker_sentence: 각 이용자는 발급신청을 0개 이상 신청할 수 있다. 각 발급신청은 반드시 하나의 신청자 이용자를 가진다.
  - id: R-APP-002
    parent: 이용자
    child: 발급신청
    parent_to_child: 처리담당한다
    child_to_parent: 처리담당된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리담당자이용자번호]
    barker_sentence: 각 이용자는 발급신청을 0개 이상 처리담당할 수 있다. 각 발급신청은 처리담당자가 없거나 하나일 수 있다.
  - id: R-APP-003
    parent: 발급신청
    child: 법인vLEI발급신청
    parent_to_child: 서브타입이다
    child_to_parent: 상속한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 법인vLEI발급신청일 수도 있다. 각 법인vLEI발급신청은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-004
    parent: 발급신청
    child: OOR발급신청
    parent_to_child: 서브타입이다
    child_to_parent: 상속한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 OOR발급신청일 수도 있다. 각 OOR발급신청은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-005
    parent: 발급신청
    child: ECR발급신청
    parent_to_child: 서브타입이다
    child_to_parent: 상속한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 ECR발급신청일 수도 있다. 각 ECR발급신청은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-006
    parent: 발급신청
    child: 발급신청단계이력
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 하나 이상의 단계 이력을 가진다. 각 발급신청단계이력은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-007
    parent: 발급신청단계이력
    child: 발급신청단계이력
    parent_to_child: 선행한다
    child_to_parent: 후행한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [선행발급신청단계이력번호]
    recursive: true
    barker_sentence: 각 단계 이력은 후행 단계 이력을 0개 이상 가질 수 있다. 각 단계 이력은 선행 단계 이력이 없거나 하나일 수 있다.
  - id: R-APP-008
    parent: 이용자
    child: 발급신청단계이력
    parent_to_child: 처리한다
    child_to_parent: 처리된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리자이용자번호]
    barker_sentence: 각 이용자는 단계 이력을 0개 이상 처리할 수 있다. 각 단계 이력은 처리자가 없거나 하나일 수 있다.
  - id: R-APP-009
    parent: 발급신청
    child: 발급신청첨부파일
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [신청번호]
    barker_sentence: 각 발급신청은 첨부파일 관계를 0개 이상 가질 수 있다. 각 발급신청첨부파일은 반드시 하나의 발급신청에 속한다.
  - id: R-APP-010
    parent: 첨부파일
    child: 발급신청첨부파일
    parent_to_child: 첨부된다
    child_to_parent: 연결된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [첨부파일번호]
    barker_sentence: 각 첨부파일은 발급신청에 0회 이상 연결될 수 있다. 각 발급신청첨부파일은 반드시 하나의 첨부파일을 가진다.
  - id: R-APP-011
    parent: 발급신청
    child: 과금
    parent_to_child: 발생시킨다
    child_to_parent: 발생근거가 된다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 과금을 0개 또는 1개 발생시킬 수 있다. 각 과금은 발급신청 근거가 없거나 하나일 수 있다.
  - id: R-APP-012
    parent: ACDC자격증명
    child: 발급신청
    parent_to_child: 결과가 된다
    child_to_parent: 생성한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결과자격증명번호]
    barker_sentence: 각 ACDC자격증명은 발급신청의 결과가 아닐 수도 있고 하나의 결과일 수 있다. 각 발급신청은 결과 credential이 없거나 하나일 수 있다.
  - id: R-APP-013
    parent: 이용자
    child: 법인vLEI발급신청
    parent_to_child: 발급대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [법인회원이용자번호]
    barker_sentence: 각 이용자는 법인회원 자격으로 LE vLEI 신청 대상이 0회 이상 될 수 있다. 각 법인vLEI발급신청은 반드시 하나의 법인회원 이용자를 대상으로 한다.
  - id: R-APP-014
    parent: 이용자
    child: OOR발급신청
    parent_to_child: 소속법인이 된다
    child_to_parent: 소속법인으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [법인회원이용자번호]
    barker_sentence: 각 이용자는 법인회원 자격으로 OOR 신청의 소속 법인이 0회 이상 될 수 있다. 각 OOR발급신청은 반드시 하나의 법인회원 이용자를 가진다.
  - id: R-APP-015
    parent: 이용자
    child: OOR발급신청
    parent_to_child: 발급대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [대상법인소속개인회원이용자번호]
    barker_sentence: 각 이용자는 법인소속개인회원 자격으로 OOR 발급 대상이 0회 이상 될 수 있다. 각 OOR발급신청은 반드시 하나의 대상 법인소속개인회원 이용자를 가진다.
  - id: R-APP-016
    parent: ACDC자격증명
    child: OOR발급신청
    parent_to_child: 기준이 된다
    child_to_parent: 기준으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [기준LEvLEI자격증명번호]
    barker_sentence: 각 LE vLEI credential은 OOR 신청의 기준이 0회 이상 될 수 있다. 각 OOR발급신청은 발급 전까지 기준 LE vLEI credential이 없거나 하나일 수 있다.
  - id: R-APP-017
    parent: 이용자
    child: ECR발급신청
    parent_to_child: 소속법인이 된다
    child_to_parent: 소속법인으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [법인회원이용자번호]
    barker_sentence: 각 이용자는 법인회원 자격으로 ECR 신청의 소속 법인이 0회 이상 될 수 있다. 각 ECR발급신청은 반드시 하나의 법인회원 이용자를 가진다.
  - id: R-APP-018
    parent: 이용자
    child: ECR발급신청
    parent_to_child: 발급대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [대상법인소속개인회원이용자번호]
    barker_sentence: 각 이용자는 법인소속개인회원 자격으로 ECR 발급 대상이 0회 이상 될 수 있다. 각 ECR발급신청은 반드시 하나의 대상 법인소속개인회원 이용자를 가진다.
  - id: R-APP-019
    parent: ACDC자격증명
    child: ECR발급신청
    parent_to_child: 기준이 된다
    child_to_parent: 기준으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [기준OOR자격증명번호]
    barker_sentence: 각 OOR credential은 ECR 신청의 기준이 0회 이상 될 수 있다. 각 ECR발급신청은 발급 전까지 기준 OOR credential이 없거나 하나일 수 있다.
  - id: R-APP-020
    parent: KERI식별자
    child: 법인vLEI발급신청
    parent_to_child: 법인AID가 된다
    child_to_parent: 법인AID로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [법인KERI식별자번호]
    barker_sentence: 각 KERI식별자는 LE vLEI 신청의 법인 AID가 0회 이상 될 수 있다. 각 법인vLEI발급신청은 법인 AID가 없거나 하나일 수 있다.
  - id: R-APP-021
    parent: KERI식별자
    child: 법인vLEI발급신청
    parent_to_child: 발급자AID가 된다
    child_to_parent: 발급자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [QVI발급자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 LE vLEI 신청의 QVI 발급자 AID가 0회 이상 될 수 있다. 각 법인vLEI발급신청은 QVI 발급자 AID가 없거나 하나일 수 있다.
  - id: R-APP-022
    parent: KERI식별자
    child: OOR발급신청
    parent_to_child: 수신자AID가 된다
    child_to_parent: 수신자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [수신자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 OOR 신청의 수신자 AID가 0회 이상 될 수 있다. 각 OOR발급신청은 수신자 AID가 없거나 하나일 수 있다.
  - id: R-APP-023
    parent: KERI식별자
    child: ECR발급신청
    parent_to_child: LE발급자AID가 된다
    child_to_parent: 발급자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [LE발급자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 ECR 신청의 LE 발급자 AID가 0회 이상 될 수 있다. 각 ECR발급신청은 LE 발급자 AID가 없거나 하나일 수 있다.
  - id: R-APP-024
    parent: KERI식별자
    child: ECR발급신청
    parent_to_child: 수신자AID가 된다
    child_to_parent: 수신자로 사용한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [수신자KERI식별자번호]
    barker_sentence: 각 KERI식별자는 ECR 신청의 수신자 AID가 0회 이상 될 수 있다. 각 ECR발급신청은 수신자 AID가 없거나 하나일 수 있다.
  - id: R-APP-025
    parent: ACDC자격증명
    child: 자격증명생명주기신청
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 신청한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [대상자격증명번호]
    barker_sentence: 각 ACDC자격증명은 생명주기 요청 대상이 0회 이상 될 수 있다. 각 자격증명생명주기신청은 반드시 하나의 대상 credential을 가진다.
  - id: R-APP-026
    parent: 이용자
    child: 자격증명생명주기신청
    parent_to_child: 신청한다
    child_to_parent: 신청된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [신청자이용자번호]
    barker_sentence: 각 이용자는 생명주기 요청을 0개 이상 신청할 수 있다. 각 생명주기 요청은 반드시 하나의 신청자 이용자를 가진다.
  - id: R-APP-027
    parent: 이용자
    child: 자격증명생명주기신청
    parent_to_child: 처리담당한다
    child_to_parent: 처리담당된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리담당자이용자번호]
    barker_sentence: 각 이용자는 생명주기 요청을 0개 이상 처리담당할 수 있다. 각 생명주기 요청은 처리담당자가 없거나 하나일 수 있다.
  - id: R-APP-028
    parent: 발급신청
    child: 자격증명생명주기신청
    parent_to_child: 유발결과가 된다
    child_to_parent: 유발한다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [유발발급신청번호]
    barker_sentence: 각 발급신청은 생명주기 요청이 유발한 신규 발급신청이 아닐 수도 있고 하나일 수 있다. 각 생명주기 요청은 신규 발급신청을 유발하지 않거나 하나만 유발할 수 있다.
  - id: R-APP-029
    parent: 자격증명생명주기신청
    child: 자격증명생명주기신청단계이력
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기 요청은 하나 이상의 단계 이력을 가진다. 각 생명주기 단계 이력은 반드시 하나의 생명주기 요청에 속한다.
  - id: R-APP-030
    parent: 자격증명생명주기신청단계이력
    child: 자격증명생명주기신청단계이력
    parent_to_child: 선행한다
    child_to_parent: 후행한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [선행생명주기신청단계이력번호]
    recursive: true
    barker_sentence: 각 생명주기 단계 이력은 후행 단계 이력을 0개 이상 가질 수 있다. 각 생명주기 단계 이력은 선행 단계 이력이 없거나 하나일 수 있다.
  - id: R-APP-031
    parent: 이용자
    child: 자격증명생명주기신청단계이력
    parent_to_child: 처리한다
    child_to_parent: 처리된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [처리자이용자번호]
    barker_sentence: 각 이용자는 생명주기 단계 이력을 0개 이상 처리할 수 있다. 각 생명주기 단계 이력은 처리자가 없거나 하나일 수 있다.
  - id: R-APP-032
    parent: 자격증명생명주기신청
    child: 생명주기신청첨부파일
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기 요청은 첨부파일 관계를 0개 이상 가질 수 있다. 각 생명주기신청첨부파일은 반드시 하나의 생명주기 요청에 속한다.
  - id: R-APP-033
    parent: 첨부파일
    child: 생명주기신청첨부파일
    parent_to_child: 첨부된다
    child_to_parent: 연결된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [첨부파일번호]
    barker_sentence: 각 첨부파일은 생명주기 요청에 0회 이상 연결될 수 있다. 각 생명주기신청첨부파일은 반드시 하나의 첨부파일을 가진다.
  - id: R-APP-034
    parent: 발급신청
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 발급신청에서 유발되지 않았거나 하나의 발급신청에서 유발된다.
  - id: R-APP-035
    parent: 자격증명생명주기신청
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기 요청은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 생명주기 요청에서 유발되지 않았거나 하나의 생명주기 요청에서 유발된다.

business_rules:
  - 발급신청 서브타입은 total/disjoint이다.
  - 발급신청 생성 또는 접수 시 최초 발급신청단계이력을 함께 생성한다.
  - 발급 완료 상태의 발급신청은 결과자격증명번호를 반드시 가져야 한다.
  - 발급 실패, 반려, 취소 상태의 발급신청은 결과자격증명번호를 가지지 않는다.
  - OOR 발급 전에는 기준LEvLEI자격증명번호가 필요하다.
  - ECR 발급 전에는 기준OOR자격증명번호가 필요하다.
  - 폐기 생명주기신청 완료는 ACDC자격증명 상태와 TEL 상태가 모두 폐기 반영된 뒤 확정한다.
  - 연계작업 실패와 재시도는 신청 상태와 분리한다.

code_groups:
  발급신청유형코드: [LE_VLEI, OOR, ECR]
  발급신청상태코드: [DRAFT, REQUESTED, RECEIVED, UNDER_REVIEW, PAYMENT_PENDING, PAYMENT_CONFIRMED, READY_TO_ISSUE, ISSUING, ISSUED, REJECTED, CANCELED, FAILED]
  발급신청단계구분코드: [REQUEST, RECEIVE, DOCUMENT_REVIEW, LEI_VERIFY, MEMBER_VERIFY, BILLING, PAYMENT_CONFIRM, ISSUE_PREPARE, ISSUE, ADMIT_CONFIRM, COMPLETE, REJECT, CANCEL]
  단계상태코드: [WAITING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED, CANCELED]
  첨부파일유형코드: [LE_DOCUMENT, AUTHORIZATION, EMPLOYEE_PROOF, ROLE_PROOF, PAYMENT_PROOF, ETC]
  첨부파일상태코드: [UPLOADED, VERIFIED, REJECTED, DELETED]
  첨부파일검증상태코드: [NOT_VERIFIED, VERIFIED, REJECTED]
  생명주기신청유형코드: [RENEWAL, REISSUE, REVOCATION, STATUS_SYNC, HOLDER_CHANGE]
  생명주기신청상태코드: [REQUESTED, RECEIVED, UNDER_REVIEW, PROCESSING, COMPLETED, REJECTED, CANCELED, FAILED]
  생명주기단계구분코드: [REQUEST, RECEIVE, REVIEW, BILLING, PAYMENT_CONFIRM, REVOKE_PREPARE, REVOKE, REISSUE_PREPARE, ISSUE, STATUS_SYNC, COMPLETE, REJECT, CANCEL]
  LEI상태코드: [ISSUED, LAPSED, RETIRED, MERGED, UNKNOWN]
`;

export const DEFAULT_BILLING_PAYMENT_POINT_LOGICAL_YAML = `subject_area: QVI 과금/결제/포인트
notation: Barker logical model
version: 0.1
status: draft
source_document: doc/DB설계/QVI 과금 결제 포인트 논리 모델.md
standard_document: doc/DB설계/QVI 상세 논리 모델 작성 기준.md
baseline_conceptual_model: doc/DB설계/QVI 개념 모델.md

relationship_notation:
  participation:
    optional_one: "0..1"
    mandatory_one: "1..1"
    optional_many: "0..M"
    mandatory_many: "1..M"
  identifying_rule: 부모 FK가 자식 PK에 포함되면 식별관계이다.
  non_identifying_rule: FK가 필수라도 자식 PK에 포함되지 않으면 비식별 참조 관계이다.

entities:
  - name: 상품
    type: entity
    identifier: 상품번호
    attributes:
      - { name: 상품번호, domain: 상품번호, required: true, identifier: true }
      - { name: 상품유형코드, domain: 상품유형코드, required: true }
      - { name: 상품상태코드, domain: 상품상태코드, required: true }
      - { name: 상품명, domain: 명칭, required: true }
      - { name: 상품설명내용, domain: 내용, required: false }
      - { name: 판매시작일시, domain: 일시, required: false }
      - { name: 판매종료일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 요금정책
    type: entity
    identifier: 요금정책번호
    attributes:
      - { name: 요금정책번호, domain: 요금정책번호, required: true, identifier: true }
      - { name: 상품번호, domain: 상품번호, required: true, foreign_key: true }
      - { name: 요금정책상태코드, domain: 요금정책상태코드, required: true }
      - { name: 기준금액, domain: 금액, required: true }
      - { name: 통화코드, domain: 통화코드, required: true }
      - { name: 부가세포함여부, domain: 여부, required: true }
      - { name: 할인금액, domain: 금액, required: false }
      - { name: 할인율, domain: 비율, required: false }
      - { name: 무료제공여부, domain: 여부, required: true }
      - { name: 유효시작일시, domain: 일시, required: true }
      - { name: 유효종료일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 과금
    type: entity
    identifier: 과금번호
    attributes:
      - { name: 과금번호, domain: 과금번호, required: true, identifier: true }
      - { name: 발급신청번호, domain: 신청번호, required: false, foreign_key: true }
      - { name: 청구대상이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 과금유형코드, domain: 과금유형코드, required: true }
      - { name: 과금상태코드, domain: 과금상태코드, required: true }
      - { name: 청구금액, domain: 금액, required: true }
      - { name: 공급가액, domain: 금액, required: true }
      - { name: 부가세액, domain: 금액, required: true }
      - { name: 할인금액, domain: 금액, required: true }
      - { name: 면제금액, domain: 금액, required: true }
      - { name: 미납금액, domain: 금액, required: true }
      - { name: 통화코드, domain: 통화코드, required: true }
      - { name: 청구일시, domain: 일시, required: true }
      - { name: 납부기한일시, domain: 일시, required: false }
      - { name: 완납일시, domain: 일시, required: false }
      - { name: 취소일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 과금항목
    type: entity
    identifier: 과금항목번호
    attributes:
      - { name: 과금항목번호, domain: 과금항목번호, required: true, identifier: true }
      - { name: 과금번호, domain: 과금번호, required: true, foreign_key: true }
      - { name: 상품번호, domain: 상품번호, required: false, foreign_key: true }
      - { name: 요금정책번호, domain: 요금정책번호, required: false, foreign_key: true }
      - { name: 과금항목유형코드, domain: 과금항목유형코드, required: true }
      - { name: 항목명, domain: 명칭, required: true }
      - { name: 수량, domain: 수량, required: true }
      - { name: 단가금액, domain: 금액, required: true }
      - { name: 공급가액, domain: 금액, required: true }
      - { name: 부가세액, domain: 금액, required: true }
      - { name: 할인금액, domain: 금액, required: true }
      - { name: 항목금액, domain: 금액, required: true }
      - { name: 과세여부, domain: 여부, required: true }
      - { name: 표시순번, domain: 순번, required: true }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 결제
    type: entity
    identifier: 결제번호
    attributes:
      - { name: 결제번호, domain: 결제번호, required: true, identifier: true }
      - { name: 결제자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 세금계산서번호, domain: 세금계산서번호, required: false, foreign_key: true }
      - { name: 결제수단코드, domain: 결제수단코드, required: true }
      - { name: 결제상태코드, domain: 결제상태코드, required: true }
      - { name: 결제금액, domain: 금액, required: true }
      - { name: 통화코드, domain: 통화코드, required: true }
      - { name: 외부거래식별자, domain: 식별값, required: false }
      - { name: 승인번호, domain: 식별값, required: false }
      - { name: 가상계좌번호, domain: 계좌번호, required: false }
      - { name: 입금자명, domain: 성명, required: false }
      - { name: 결제요청일시, domain: 일시, required: false }
      - { name: 결제승인일시, domain: 일시, required: false }
      - { name: 결제완료일시, domain: 일시, required: false }
      - { name: 실패사유내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 결제적용
    type: relationship_entity
    identifier: 결제적용번호
    attributes:
      - { name: 결제적용번호, domain: 결제적용번호, required: true, identifier: true }
      - { name: 과금번호, domain: 과금번호, required: true, foreign_key: true }
      - { name: 결제번호, domain: 결제번호, required: true, foreign_key: true }
      - { name: 적용금액, domain: 금액, required: true }
      - { name: 적용상태코드, domain: 결제적용상태코드, required: true }
      - { name: 적용일시, domain: 일시, required: true }
      - { name: 취소일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 세금계산서
    type: entity
    identifier: 세금계산서번호
    attributes:
      - { name: 세금계산서번호, domain: 세금계산서번호, required: true, identifier: true }
      - { name: 과금번호, domain: 과금번호, required: true, foreign_key: true }
      - { name: 발행유형코드, domain: 세금계산서발행유형코드, required: true }
      - { name: 세금계산서상태코드, domain: 세금계산서상태코드, required: true }
      - { name: 세금계산서문서번호, domain: 식별값, required: false }
      - { name: 공급받는자사업자등록번호, domain: 사업자등록번호, required: false }
      - { name: 공급받는자명, domain: 명칭, required: false }
      - { name: 공급가액, domain: 금액, required: true }
      - { name: 부가세액, domain: 금액, required: true }
      - { name: 발행금액, domain: 금액, required: true }
      - { name: 발행일시, domain: 일시, required: false }
      - { name: 입금확인일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 취소환불
    type: entity
    identifier: 취소환불번호
    attributes:
      - { name: 취소환불번호, domain: 취소환불번호, required: true, identifier: true }
      - { name: 과금번호, domain: 과금번호, required: false, foreign_key: true }
      - { name: 결제번호, domain: 결제번호, required: false, foreign_key: true }
      - { name: 선행취소환불번호, domain: 취소환불번호, required: false, foreign_key: true }
      - { name: 취소환불유형코드, domain: 취소환불유형코드, required: true }
      - { name: 취소환불상태코드, domain: 취소환불상태코드, required: true }
      - { name: 취소환불금액, domain: 금액, required: true }
      - { name: 포인트복원여부, domain: 여부, required: true }
      - { name: 환불계좌식별값, domain: 식별값, required: false }
      - { name: 요청일시, domain: 일시, required: true }
      - { name: 처리일시, domain: 일시, required: false }
      - { name: 실패사유내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 이용자포인트
    type: ledger_entity
    identifier: 포인트번호
    attributes:
      - { name: 포인트번호, domain: 포인트번호, required: true, identifier: true }
      - { name: 이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 과금번호, domain: 과금번호, required: false, foreign_key: true }
      - { name: 결제번호, domain: 결제번호, required: false, foreign_key: true }
      - { name: 취소환불번호, domain: 취소환불번호, required: false, foreign_key: true }
      - { name: 포인트거래유형코드, domain: 포인트거래유형코드, required: true }
      - { name: 포인트거래상태코드, domain: 포인트거래상태코드, required: true }
      - { name: 발생포인트, domain: 포인트, required: true }
      - { name: 사용포인트, domain: 포인트, required: true }
      - { name: 현재포인트, domain: 포인트, required: true }
      - { name: 유효시작일시, domain: 일시, required: false }
      - { name: 유효종료일시, domain: 일시, required: false }
      - { name: 거래일시, domain: 일시, required: true }
      - { name: 거래내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 과금통계
    type: derived_entity
    identifier: 과금통계번호
    attributes:
      - { name: 과금통계번호, domain: 과금통계번호, required: true, identifier: true }
      - { name: 통계기준코드, domain: 통계기준코드, required: true }
      - { name: 통계기간구분코드, domain: 통계기간구분코드, required: true }
      - { name: 기준시작일자, domain: 일자, required: true }
      - { name: 기준종료일자, domain: 일자, required: true }
      - { name: 기준상품번호, domain: 상품번호, required: false, foreign_key: true }
      - { name: 기준이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 결제수단코드, domain: 결제수단코드, required: false }
      - { name: 과금건수, domain: 건수, required: true }
      - { name: 결제건수, domain: 건수, required: true }
      - { name: 환불건수, domain: 건수, required: true }
      - { name: 집계금액, domain: 금액, required: true }
      - { name: 할인금액, domain: 금액, required: true }
      - { name: 환불금액, domain: 금액, required: true }
      - { name: 포인트사용금액, domain: 금액, required: true }
      - { name: 산출일시, domain: 일시, required: true }
      - { name: 재산출여부, domain: 여부, required: true }

external_entities:
  - { name: 이용자, owner: QVI 이용자/가입/계정 }
  - { name: 발급신청, owner: QVI 발급신청/생명주기 }

relationships:
  - id: R-BIL-001
    parent: 이용자
    child: 과금
    parent_to_child: 청구받는다
    child_to_parent: 청구된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [청구대상이용자번호]
    barker_sentence: 각 이용자는 과금을 0개 이상 청구받을 수 있다. 각 과금은 반드시 하나의 청구 대상 이용자를 가진다.
  - id: R-BIL-002
    parent: 발급신청
    child: 과금
    parent_to_child: 발생시킨다
    child_to_parent: 발생근거가 된다
    cardinality: "1:1"
    parent_participation: "0..1"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 과금을 0개 또는 1개 발생시킬 수 있다. 각 과금은 발급신청 근거가 없거나 하나일 수 있다.
  - id: R-BIL-003
    parent: 상품
    child: 요금정책
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [상품번호]
    barker_sentence: 각 상품은 요금정책을 0개 이상 가질 수 있다. 각 요금정책은 반드시 하나의 상품에 속한다.
  - id: R-BIL-004
    parent: 과금
    child: 과금항목
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 하나 이상의 과금항목을 가진다. 각 과금항목은 반드시 하나의 과금에 속한다.
  - id: R-BIL-005
    parent: 상품
    child: 과금항목
    parent_to_child: 산정기준이 된다
    child_to_parent: 기준으로 산정된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [상품번호]
    barker_sentence: 각 상품은 과금항목의 산정 기준이 0회 이상 될 수 있다. 각 과금항목은 산정 기준 상품이 없거나 하나일 수 있다.
  - id: R-BIL-006
    parent: 요금정책
    child: 과금항목
    parent_to_child: 산정기준이 된다
    child_to_parent: 기준으로 산정된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [요금정책번호]
    barker_sentence: 각 요금정책은 과금항목의 산정 기준이 0회 이상 될 수 있다. 각 과금항목은 산정 기준 요금정책이 없거나 하나일 수 있다.
  - id: R-BIL-007
    parent: 이용자
    child: 결제
    parent_to_child: 결제한다
    child_to_parent: 결제된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [결제자이용자번호]
    barker_sentence: 각 이용자는 결제를 0개 이상 수행할 수 있다. 각 결제는 반드시 하나의 결제자 이용자를 가진다.
  - id: R-BIL-008
    parent: 과금
    child: 결제적용
    parent_to_child: 적용받는다
    child_to_parent: 적용된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 결제적용을 0개 이상 가질 수 있다. 각 결제적용은 반드시 하나의 과금에 적용된다.
  - id: R-BIL-009
    parent: 결제
    child: 결제적용
    parent_to_child: 적용한다
    child_to_parent: 적용된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [결제번호]
    barker_sentence: 각 결제는 결제적용을 0개 이상 가질 수 있다. 각 결제적용은 반드시 하나의 결제에 속한다.
  - id: R-BIL-010
    parent: 과금
    child: 세금계산서
    parent_to_child: 발행한다
    child_to_parent: 발행대상이 된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 세금계산서를 0개 이상 발행할 수 있다. 각 세금계산서는 반드시 하나의 과금에 대해 발행된다.
  - id: R-BIL-011
    parent: 세금계산서
    child: 결제
    parent_to_child: 입금확인을 가진다
    child_to_parent: 입금확인이 된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [세금계산서번호]
    barker_sentence: 각 세금계산서는 입금 확인 결제를 0개 이상 가질 수 있다. 각 결제는 세금계산서 입금 확인이 아니거나 하나의 세금계산서와 연결된다.
  - id: R-BIL-012
    parent: 과금
    child: 취소환불
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 처리된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 취소환불 대상이 0회 이상 될 수 있다. 각 취소환불은 과금 대상이 없거나 하나일 수 있다.
  - id: R-BIL-013
    parent: 결제
    child: 취소환불
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 처리된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결제번호]
    barker_sentence: 각 결제는 취소환불 대상이 0회 이상 될 수 있다. 각 취소환불은 결제 대상이 없거나 하나일 수 있다.
  - id: R-BIL-014
    parent: 취소환불
    child: 취소환불
    parent_to_child: 선행한다
    child_to_parent: 후행한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [선행취소환불번호]
    recursive: true
    barker_sentence: 각 취소환불은 후속 취소환불을 0개 이상 가질 수 있다. 각 취소환불은 선행 취소환불이 없거나 하나일 수 있다.
  - id: R-BIL-015
    parent: 이용자
    child: 이용자포인트
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [이용자번호]
    barker_sentence: 각 이용자는 포인트 원장 이력을 0개 이상 가질 수 있다. 각 이용자포인트는 반드시 하나의 이용자에 속한다.
  - id: R-BIL-016
    parent: 과금
    child: 이용자포인트
    parent_to_child: 관련된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 포인트 이력과 0회 이상 관련될 수 있다. 각 이용자포인트는 관련 과금이 없거나 하나일 수 있다.
  - id: R-BIL-017
    parent: 결제
    child: 이용자포인트
    parent_to_child: 관련된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결제번호]
    barker_sentence: 각 결제는 포인트 이력과 0회 이상 관련될 수 있다. 각 이용자포인트는 관련 결제가 없거나 하나일 수 있다.
  - id: R-BIL-018
    parent: 취소환불
    child: 이용자포인트
    parent_to_child: 복원근거가 된다
    child_to_parent: 복원된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [취소환불번호]
    barker_sentence: 각 취소환불은 포인트 복원 이력과 0회 이상 관련될 수 있다. 각 이용자포인트는 관련 취소환불이 없거나 하나일 수 있다.
  - id: R-BIL-019
    parent: 상품
    child: 과금통계
    parent_to_child: 집계차원이 된다
    child_to_parent: 집계된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [기준상품번호]
    barker_sentence: 각 상품은 과금통계의 기준 차원이 0회 이상 될 수 있다. 각 과금통계는 기준 상품이 없거나 하나일 수 있다.
  - id: R-BIL-020
    parent: 이용자
    child: 과금통계
    parent_to_child: 집계차원이 된다
    child_to_parent: 집계된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [기준이용자번호]
    barker_sentence: 각 이용자는 과금통계의 기준 차원이 0회 이상 될 수 있다. 각 과금통계는 기준 이용자가 없거나 하나일 수 있다.

business_rules:
  - 과금 생성 시 최소 하나의 과금항목을 함께 생성한다.
  - 과금과 결제의 M:N 관계는 결제적용으로 해소한다.
  - 취소환불.과금번호와 취소환불.결제번호는 둘 중 하나 이상 있어야 한다.
  - 이용자포인트.발생포인트와 이용자포인트.사용포인트는 같은 거래에서 둘 다 양수가 될 수 없다.
  - 포인트 사용 결제는 POINT 결제와 이용자포인트 사용 이력을 함께 생성한다.
  - 무료 처리는 통계 정합성을 위해 0원 과금과 FREE 결제 생성을 권장한다.
  - 과금통계는 원천 거래와 직접 FK를 맺지 않는 파생 집계이다.

code_groups:
  상품유형코드: [LE_VLEI_ISSUE, OOR_ISSUE, ECR_ISSUE, RENEWAL, REISSUE, REVOCATION_FEE, POINT_PACKAGE]
  상품상태코드: [ACTIVE, INACTIVE, DISCONTINUED]
  요금정책상태코드: [SCHEDULED, ACTIVE, SUSPENDED, EXPIRED]
  과금유형코드: [ISSUE, RENEWAL, REISSUE, REVOCATION, ADJUSTMENT, FREE_EVENT]
  과금상태코드: [CREATED, INVOICED, PAYMENT_PENDING, PARTIALLY_PAID, PAID, CANCELED, REFUNDED, FAILED]
  과금항목유형코드: [BASE_FEE, ADDITIONAL_FEE, DISCOUNT, EXEMPTION, VAT, ADJUSTMENT]
  결제수단코드: [CARD, VIRTUAL_ACCOUNT, TAX_INVOICE_DEPOSIT, POINT, FREE]
  결제상태코드: [READY, REQUESTED, AUTHORIZED, PAID, FAILED, CANCELED, PARTIALLY_REFUNDED, REFUNDED]
  결제적용상태코드: [APPLIED, CANCELED]
  세금계산서발행유형코드: [ISSUE, MODIFY, CANCEL]
  세금계산서상태코드: [REQUESTED, ISSUED, SENT, PAID, CANCELED, FAILED]
  취소환불유형코드: [CHARGE_CANCEL, PAYMENT_CANCEL, REFUND, PARTIAL_REFUND, POINT_RESTORE]
  취소환불상태코드: [REQUESTED, PROCESSING, COMPLETED, FAILED, CANCELED]
  포인트거래유형코드: [GRANT, USE, CANCEL_USE, EXPIRE, ADJUST, FREE_GRANT]
  포인트거래상태코드: [RECORDED, CANCELED, EXPIRED]
  통계기준코드: [BILLING, PAYMENT, REFUND, POINT, PRODUCT, USER, PAYMENT_METHOD]
  통계기간구분코드: [DAILY, MONTHLY, YEARLY, CUSTOM]
`;

export const DEFAULT_INTEGRATION_AUDIT_NOTIFICATION_LOGICAL_YAML = `subject_area: QVI 외부연계/감사/알림
notation: Barker logical model
version: 0.1
status: draft
source_context:
  - doc/DB설계/QVI 개념 모델.md
  - doc/DB설계/QVI 상세 논리 모델 작성 기준.md
artifact_policy: YAML only. SVG 산출물은 생성하지 않는다.

relationship_notation:
  participation:
    optional_one: "0..1"
    mandatory_one: "1..1"
    optional_many: "0..M"
    mandatory_many: "1..M"
  identifying_rule: 부모 FK가 자식 PK에 포함되면 식별관계이다.
  non_identifying_rule: FK가 필수라도 자식 PK에 포함되지 않으면 비식별 참조 관계이다.

modeling_principles:
  - GLEIS API, GLEIF Reporting API, Sally/verifier, Witness, Watcher, KERIA 호출은 연계작업과 연계시도이력으로 추적한다.
  - QVI KERIA, LE KERIA, User KERIA는 외부기관은 아니지만 포탈 관점에서는 연계시스템으로 관리한다.
  - 연계작업은 업무 상태의 원천이 아니라 외부 호출, 재시도, 장애 보정을 위한 작업 단위이다.
  - 연계작업 실패와 재시도는 발급신청, 생명주기신청, 과금 등 업무 상태와 분리한다.
  - 연계시도이력에는 요청/응답 요약과 오류 정보를 남기되 secret, token, 개인정보 원문 저장은 제한한다.
  - 알림통지는 업무 상태의 원천이 아니라 이용자 안내와 발송 이력을 위한 엔터티이다.
  - 감사로그는 핵심 업무 행위와 상태 변경을 추적한다. 감사 대상은 업무대상유형코드와 대상식별자값을 기본으로 남기고, 주요 대상은 선택 FK도 함께 둘 수 있다.
  - 중복 전송 방지를 위해 연계작업은 idempotency key와 correlation id를 가진다.

entities:
  - name: 외부연계시스템
    type: entity
    identifier: 연계시스템번호
    attributes:
      - { name: 연계시스템번호, domain: 연계시스템번호, required: true, identifier: true }
      - { name: 운영외부기관이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 연계시스템유형코드, domain: 연계시스템유형코드, required: true }
      - { name: 연계시스템상태코드, domain: 연계시스템상태코드, required: true }
      - { name: 연계시스템명, domain: 명칭, required: true }
      - { name: 연계시스템설명내용, domain: 내용, required: false }
      - { name: 내부시스템여부, domain: 여부, required: true }
      - { name: 인증정보참조값, domain: 참조값, required: false }
      - { name: 상태확인주기초수, domain: 건수, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 연계엔드포인트
    type: entity
    identifier: 엔드포인트번호
    attributes:
      - { name: 엔드포인트번호, domain: 엔드포인트번호, required: true, identifier: true }
      - { name: 연계시스템번호, domain: 연계시스템번호, required: true, foreign_key: true }
      - { name: 엔드포인트유형코드, domain: 엔드포인트유형코드, required: true }
      - { name: 엔드포인트상태코드, domain: 엔드포인트상태코드, required: true }
      - { name: 엔드포인트명, domain: 명칭, required: true }
      - { name: 엔드포인트URL, domain: URL, required: true }
      - { name: HTTP메서드코드, domain: HTTP메서드코드, required: false }
      - { name: 인증정보참조값, domain: 참조값, required: false }
      - { name: 제한시간초수, domain: 건수, required: false }
      - { name: 최대재시도횟수, domain: 건수, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 연계작업
    type: entity
    identifier: 연계작업번호
    attributes:
      - { name: 연계작업번호, domain: 연계작업번호, required: true, identifier: true }
      - { name: 연계시스템번호, domain: 연계시스템번호, required: true, foreign_key: true }
      - { name: 엔드포인트번호, domain: 엔드포인트번호, required: false, foreign_key: true }
      - { name: 발급신청번호, domain: 신청번호, required: false, foreign_key: true }
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: false, foreign_key: true }
      - { name: KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: ACDC자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 과금번호, domain: 과금번호, required: false, foreign_key: true }
      - { name: 결제번호, domain: 결제번호, required: false, foreign_key: true }
      - { name: 업무대상유형코드, domain: 업무대상유형코드, required: true }
      - { name: 대상식별자값, domain: 식별값, required: true }
      - { name: 연계작업유형코드, domain: 연계작업유형코드, required: true }
      - { name: 연계작업상태코드, domain: 연계작업상태코드, required: true }
      - { name: 우선순위코드, domain: 우선순위코드, required: true }
      - { name: 멱등키값, domain: 식별값, required: false }
      - { name: 상관관계식별자, domain: 식별값, required: false }
      - { name: 외부참조값, domain: 참조값, required: false }
      - { name: 요청요약내용, domain: 내용, required: false }
      - { name: 응답요약내용, domain: 내용, required: false }
      - { name: 재시도횟수, domain: 건수, required: true }
      - { name: 최대재시도횟수, domain: 건수, required: true }
      - { name: 다음재시도일시, domain: 일시, required: false }
      - { name: DLQ전환일시, domain: 일시, required: false }
      - { name: 수동처리여부, domain: 여부, required: true }
      - { name: 요청일시, domain: 일시, required: true }
      - { name: 완료일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 연계시도이력
    type: history_entity
    identifier: 연계시도이력번호
    attributes:
      - { name: 연계시도이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 연계작업번호, domain: 연계작업번호, required: true, foreign_key: true }
      - { name: 엔드포인트번호, domain: 엔드포인트번호, required: false, foreign_key: true }
      - { name: 시도순번, domain: 순번, required: true }
      - { name: 시도상태코드, domain: 연계시도상태코드, required: true }
      - { name: 요청HTTP메서드코드, domain: HTTP메서드코드, required: false }
      - { name: 요청URL, domain: URL, required: false }
      - { name: 요청해시값, domain: 해시값, required: false }
      - { name: 응답코드, domain: 코드값, required: false }
      - { name: HTTP상태코드, domain: 코드값, required: false }
      - { name: 응답해시값, domain: 해시값, required: false }
      - { name: 요청요약내용, domain: 내용, required: false }
      - { name: 응답요약내용, domain: 내용, required: false }
      - { name: 오류코드, domain: 코드값, required: false }
      - { name: 오류내용, domain: 내용, required: false }
      - { name: 시도시작일시, domain: 일시, required: true }
      - { name: 시도종료일시, domain: 일시, required: false }
      - { name: 소요밀리초수, domain: 건수, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 감사로그
    type: log_entity
    identifier: 감사로그번호
    attributes:
      - { name: 감사로그번호, domain: 감사로그번호, required: true, identifier: true }
      - { name: 행위자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 연계작업번호, domain: 연계작업번호, required: false, foreign_key: true }
      - { name: 발급신청번호, domain: 신청번호, required: false, foreign_key: true }
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: false, foreign_key: true }
      - { name: KERI식별자번호, domain: KERI식별자번호, required: false, foreign_key: true }
      - { name: ACDC자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 과금번호, domain: 과금번호, required: false, foreign_key: true }
      - { name: 결제번호, domain: 결제번호, required: false, foreign_key: true }
      - { name: 게시물번호, domain: 게시물번호, required: false, foreign_key: true }
      - { name: 감사이벤트유형코드, domain: 감사이벤트유형코드, required: true }
      - { name: 감사이벤트결과코드, domain: 감사이벤트결과코드, required: true }
      - { name: 업무대상유형코드, domain: 업무대상유형코드, required: true }
      - { name: 대상식별자값, domain: 식별값, required: true }
      - { name: 변경전요약내용, domain: 내용, required: false }
      - { name: 변경후요약내용, domain: 내용, required: false }
      - { name: 요청IP주소값, domain: IP주소, required: false }
      - { name: 사용자에이전트값, domain: 내용, required: false }
      - { name: 발생일시, domain: 일시, required: true }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 알림템플릿
    type: reference_entity
    identifier: 알림템플릿번호
    attributes:
      - { name: 알림템플릿번호, domain: 알림템플릿번호, required: true, identifier: true }
      - { name: 등록자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 통지유형코드, domain: 통지유형코드, required: true }
      - { name: 통지채널코드, domain: 통지채널코드, required: true }
      - { name: 템플릿상태코드, domain: 알림템플릿상태코드, required: true }
      - { name: 템플릿명, domain: 명칭, required: true }
      - { name: 제목템플릿내용, domain: 내용, required: false }
      - { name: 본문템플릿내용, domain: 내용, required: true }
      - { name: 변수정의내용, domain: 내용, required: false }
      - { name: 템플릿버전값, domain: 식별값, required: true }
      - { name: 유효시작일시, domain: 일시, required: true }
      - { name: 유효종료일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 알림통지
    type: entity
    identifier: 통지번호
    attributes:
      - { name: 통지번호, domain: 통지번호, required: true, identifier: true }
      - { name: 알림템플릿번호, domain: 알림템플릿번호, required: false, foreign_key: true }
      - { name: 연계작업번호, domain: 연계작업번호, required: false, foreign_key: true }
      - { name: 발급신청번호, domain: 신청번호, required: false, foreign_key: true }
      - { name: 생명주기신청번호, domain: 생명주기신청번호, required: false, foreign_key: true }
      - { name: ACDC자격증명번호, domain: ACDC자격증명번호, required: false, foreign_key: true }
      - { name: 과금번호, domain: 과금번호, required: false, foreign_key: true }
      - { name: 결제번호, domain: 결제번호, required: false, foreign_key: true }
      - { name: 통지유형코드, domain: 통지유형코드, required: true }
      - { name: 통지상태코드, domain: 통지상태코드, required: true }
      - { name: 업무대상유형코드, domain: 업무대상유형코드, required: false }
      - { name: 대상식별자값, domain: 식별값, required: false }
      - { name: 통지제목명, domain: 명칭, required: false }
      - { name: 통지본문내용, domain: 내용, required: false }
      - { name: 예약발송일시, domain: 일시, required: false }
      - { name: 발송완료일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 알림통지수신자
    type: relationship_entity
    identifier: [통지번호, 수신자이용자번호]
    attributes:
      - { name: 통지번호, domain: 통지번호, required: true, identifier: true, foreign_key: true }
      - { name: 수신자이용자번호, domain: 이용자번호, required: true, identifier: true, foreign_key: true }
      - { name: 수신상태코드, domain: 수신상태코드, required: true }
      - { name: 읽음여부, domain: 여부, required: true }
      - { name: 읽음일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 알림발송이력
    type: history_entity
    identifier: 알림발송이력번호
    attributes:
      - { name: 알림발송이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 통지번호, domain: 통지번호, required: true, foreign_key: true }
      - { name: 수신자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 통지채널코드, domain: 통지채널코드, required: true }
      - { name: 발송상태코드, domain: 발송상태코드, required: true }
      - { name: 발송시도순번, domain: 순번, required: true }
      - { name: 외부발송식별자, domain: 식별값, required: false }
      - { name: 발송요청일시, domain: 일시, required: true }
      - { name: 발송완료일시, domain: 일시, required: false }
      - { name: 실패사유내용, domain: 내용, required: false }
      - { name: 등록일시, domain: 일시, required: true }

external_entities:
  - { name: 이용자, owner: QVI 이용자/가입/계정 }
  - { name: 외부기관, owner: QVI 이용자/가입/계정, note: 이용자 서브타입 }
  - { name: 발급신청, owner: QVI 발급신청/생명주기 }
  - { name: 자격증명생명주기신청, owner: QVI 발급신청/생명주기 }
  - { name: KERI식별자, owner: QVI KERI/지갑 }
  - { name: ACDC자격증명, owner: QVI KERI/지갑 }
  - { name: 과금, owner: QVI 과금/결제/포인트 }
  - { name: 결제, owner: QVI 과금/결제/포인트 }
  - { name: 게시물, owner: QVI 포탈콘텐츠 }

relationships:
  - id: R-INT-001
    parent: 외부기관
    child: 외부연계시스템
    parent_to_child: 운영한다
    child_to_parent: 운영된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [운영외부기관이용자번호]
    barker_sentence: 각 외부기관은 외부연계시스템을 0개 이상 운영할 수 있다. 각 외부연계시스템은 운영 외부기관이 없거나 하나일 수 있다.
  - id: R-INT-002
    parent: 외부연계시스템
    child: 연계엔드포인트
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [연계시스템번호]
    barker_sentence: 각 외부연계시스템은 하나 이상의 연계엔드포인트를 가진다. 각 연계엔드포인트는 반드시 하나의 외부연계시스템에 속한다.
  - id: R-INT-003
    parent: 외부연계시스템
    child: 연계작업
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 실행된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [연계시스템번호]
    barker_sentence: 각 외부연계시스템은 연계작업의 대상이 0회 이상 될 수 있다. 각 연계작업은 반드시 하나의 외부연계시스템을 대상으로 한다.
  - id: R-INT-004
    parent: 연계엔드포인트
    child: 연계작업
    parent_to_child: 호출대상이 된다
    child_to_parent: 호출한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [엔드포인트번호]
    barker_sentence: 각 연계엔드포인트는 연계작업의 호출 대상이 0회 이상 될 수 있다. 각 연계작업은 특정 엔드포인트가 없거나 하나일 수 있다.
  - id: R-INT-005
    parent: 연계작업
    child: 연계시도이력
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [연계작업번호]
    barker_sentence: 각 연계작업은 연계시도이력을 0개 이상 가질 수 있다. 각 연계시도이력은 반드시 하나의 연계작업에 속한다.
  - id: R-INT-006
    parent: 연계엔드포인트
    child: 연계시도이력
    parent_to_child: 실제호출된다
    child_to_parent: 호출한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [엔드포인트번호]
    barker_sentence: 각 연계엔드포인트는 실제 호출 이력의 대상이 0회 이상 될 수 있다. 각 연계시도이력은 실제 호출 엔드포인트가 없거나 하나일 수 있다.
  - id: R-INT-007
    parent: 발급신청
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 발급신청에서 유발되지 않았거나 하나의 발급신청에서 유발된다.
  - id: R-INT-008
    parent: 자격증명생명주기신청
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 자격증명생명주기신청은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 생명주기신청에서 유발되지 않았거나 하나의 생명주기신청에서 유발된다.
  - id: R-INT-009
    parent: KERI식별자
    child: 연계작업
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 처리한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [KERI식별자번호]
    barker_sentence: 각 KERI식별자는 연계작업의 대상이 0회 이상 될 수 있다. 각 연계작업은 대상 KERI식별자가 없거나 하나일 수 있다.
  - id: R-INT-010
    parent: ACDC자격증명
    child: 연계작업
    parent_to_child: 대상이 된다
    child_to_parent: 대상으로 처리한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [ACDC자격증명번호]
    barker_sentence: 각 ACDC자격증명은 연계작업의 대상이 0회 이상 될 수 있다. 각 연계작업은 대상 ACDC자격증명이 없거나 하나일 수 있다.
  - id: R-INT-011
    parent: 과금
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 과금에서 유발되지 않았거나 하나의 과금에서 유발된다.
  - id: R-INT-012
    parent: 결제
    child: 연계작업
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결제번호]
    barker_sentence: 각 결제는 연계작업을 0개 이상 유발할 수 있다. 각 연계작업은 결제에서 유발되지 않았거나 하나의 결제에서 유발된다.
  - id: R-INT-013
    parent: 이용자
    child: 감사로그
    parent_to_child: 행위한다
    child_to_parent: 기록된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [행위자이용자번호]
    barker_sentence: 각 이용자는 감사로그의 행위자가 0회 이상 될 수 있다. 각 감사로그는 행위자 이용자가 없거나 하나일 수 있다.
  - id: R-INT-014
    parent: 연계작업
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [연계작업번호]
    barker_sentence: 각 연계작업은 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 연계작업이 없거나 하나일 수 있다.
  - id: R-INT-015
    parent: 발급신청
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 발급신청이 없거나 하나일 수 있다.
  - id: R-INT-016
    parent: 자격증명생명주기신청
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 자격증명생명주기신청은 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 생명주기신청이 없거나 하나일 수 있다.
  - id: R-INT-017
    parent: KERI식별자
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [KERI식별자번호]
    barker_sentence: 각 KERI식별자는 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 KERI식별자가 없거나 하나일 수 있다.
  - id: R-INT-018
    parent: ACDC자격증명
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [ACDC자격증명번호]
    barker_sentence: 각 ACDC자격증명은 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 ACDC자격증명이 없거나 하나일 수 있다.
  - id: R-INT-019
    parent: 과금
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 과금이 없거나 하나일 수 있다.
  - id: R-INT-020
    parent: 결제
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결제번호]
    barker_sentence: 각 결제는 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 결제가 없거나 하나일 수 있다.
  - id: R-INT-021
    parent: 게시물
    child: 감사로그
    parent_to_child: 기록된다
    child_to_parent: 관련된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [게시물번호]
    barker_sentence: 각 게시물은 감사로그를 0개 이상 가질 수 있다. 각 감사로그는 관련 게시물이 없거나 하나일 수 있다.
  - id: R-INT-022
    parent: 이용자
    child: 알림템플릿
    parent_to_child: 등록한다
    child_to_parent: 등록된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [등록자이용자번호]
    barker_sentence: 각 이용자는 알림템플릿을 0개 이상 등록할 수 있다. 각 알림템플릿은 등록자가 없거나 하나일 수 있다.
  - id: R-INT-023
    parent: 알림템플릿
    child: 알림통지
    parent_to_child: 생성기준이 된다
    child_to_parent: 기준으로 생성된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [알림템플릿번호]
    barker_sentence: 각 알림템플릿은 알림통지 생성 기준이 0회 이상 될 수 있다. 각 알림통지는 기준 템플릿이 없거나 하나일 수 있다.
  - id: R-INT-024
    parent: 연계작업
    child: 알림통지
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [연계작업번호]
    barker_sentence: 각 연계작업은 알림통지를 0개 이상 유발할 수 있다. 각 알림통지는 연계작업에서 유발되지 않았거나 하나의 연계작업에서 유발된다.
  - id: R-INT-025
    parent: 발급신청
    child: 알림통지
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [발급신청번호]
    barker_sentence: 각 발급신청은 알림통지를 0개 이상 유발할 수 있다. 각 알림통지는 발급신청에서 유발되지 않았거나 하나의 발급신청에서 유발된다.
  - id: R-INT-026
    parent: 자격증명생명주기신청
    child: 알림통지
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [생명주기신청번호]
    barker_sentence: 각 생명주기신청은 알림통지를 0개 이상 유발할 수 있다. 각 알림통지는 생명주기신청에서 유발되지 않았거나 하나의 생명주기신청에서 유발된다.
  - id: R-INT-027
    parent: ACDC자격증명
    child: 알림통지
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [ACDC자격증명번호]
    barker_sentence: 각 ACDC자격증명은 알림통지를 0개 이상 유발할 수 있다. 각 알림통지는 ACDC자격증명에서 유발되지 않았거나 하나의 ACDC자격증명에서 유발된다.
  - id: R-INT-028
    parent: 과금
    child: 알림통지
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [과금번호]
    barker_sentence: 각 과금은 알림통지를 0개 이상 유발할 수 있다. 각 알림통지는 과금에서 유발되지 않았거나 하나의 과금에서 유발된다.
  - id: R-INT-029
    parent: 결제
    child: 알림통지
    parent_to_child: 유발한다
    child_to_parent: 유발된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [결제번호]
    barker_sentence: 각 결제는 알림통지를 0개 이상 유발할 수 있다. 각 알림통지는 결제에서 유발되지 않았거나 하나의 결제에서 유발된다.
  - id: R-INT-030
    parent: 알림통지
    child: 알림통지수신자
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "1..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [통지번호]
    barker_sentence: 각 알림통지는 하나 이상의 수신자를 가진다. 각 알림통지수신자는 반드시 하나의 알림통지에 속한다.
  - id: R-INT-031
    parent: 이용자
    child: 알림통지수신자
    parent_to_child: 수신한다
    child_to_parent: 수신자로 지정된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [수신자이용자번호]
    barker_sentence: 각 이용자는 알림통지를 0개 이상 수신할 수 있다. 각 알림통지수신자는 반드시 하나의 수신자 이용자를 가진다.
  - id: R-INT-032
    parent: 알림통지수신자
    child: 알림발송이력
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [통지번호, 수신자이용자번호]
    barker_sentence: 각 알림통지수신자는 발송 이력을 0개 이상 가질 수 있다. 각 알림발송이력은 반드시 하나의 알림통지수신자에 속한다.

business_rules:
  - 외부연계시스템은 최소 하나의 활성 연계엔드포인트를 가져야 운영 가능 상태가 된다.
  - 연계작업은 연계시스템번호를 반드시 가진다.
  - 연계작업은 발급신청번호, 생명주기신청번호, KERI식별자번호, ACDC자격증명번호, 과금번호, 결제번호 중 하나 이상을 업무 근거로 가져야 한다.
  - 연계작업의 멱등키값은 같은 연계시스템, 같은 연계작업유형, 같은 업무대상 조합 안에서 중복될 수 없다.
  - 연계작업상태코드가 SUCCEEDED이면 완료일시를 가져야 한다.
  - 연계작업상태코드가 RETRY_WAIT이면 다음재시도일시를 가져야 한다.
  - 연계작업상태코드가 DLQ이면 DLQ전환일시를 가져야 한다.
  - 연계시도이력의 시도순번은 동일 연계작업 안에서 중복될 수 없다.
  - 연계시도이력에는 요청/응답 원문 대신 해시값, 요약, 오류코드, 오류내용을 우선 저장한다.
  - 감사로그는 행위자이용자번호가 없는 시스템 이벤트도 허용한다.
  - 감사로그는 업무대상유형코드와 대상식별자값을 반드시 가진다.
  - 알림통지는 하나 이상의 알림통지수신자를 가져야 한다.
  - 알림발송이력의 발송시도순번은 동일 통지번호, 수신자이용자번호, 통지채널코드 안에서 중복될 수 없다.
  - 알림통지는 업무 상태의 원천이 아니며, 통지 실패가 곧 발급신청이나 결제 실패를 의미하지 않는다.

code_groups:
  연계시스템유형코드: [GLEIS_API, GLEIF_REPORTING_API, SALLY_VERIFIER, WITNESS, WATCHER, SCHEMA_SERVER, LEDGER_REGISTRAR, QVI_KERIA, LE_KERIA, USER_KERIA, PAYMENT_GATEWAY, TAX_INVOICE_PROVIDER, NOTIFICATION_PROVIDER]
  연계시스템상태코드: [ACTIVE, INACTIVE, DEGRADED, MAINTENANCE, RETIRED]
  엔드포인트유형코드: [API_BASE, WELL_KNOWN, OOBI, WITNESS, WEBHOOK, ADMIN, HEALTH_CHECK, SCHEMA, REPORTING]
  엔드포인트상태코드: [ACTIVE, INACTIVE, DEGRADED, MAINTENANCE, RETIRED]
  HTTP메서드코드: [GET, POST, PUT, PATCH, DELETE]
  연계작업유형코드: [LEI_LOOKUP, GLEIF_REPORT_ISSUE, GLEIF_REPORT_REVOKE, SALLY_VERIFY, OOBI_RESOLVE, WITNESS_RECEIPT, WATCHER_QUERY, KERIA_CREATE_AID, KERIA_ROTATE, KERIA_REGISTRY_CREATE, KERIA_ISSUE, KERIA_GRANT, KERIA_ADMIT, KERIA_REVOKE, PG_PAYMENT, TAX_INVOICE_ISSUE, NOTIFICATION_SEND]
  연계작업상태코드: [REQUESTED, QUEUED, IN_PROGRESS, SUCCEEDED, RETRY_WAIT, FAILED, DLQ, CANCELED, MANUAL_RESOLVED]
  연계시도상태코드: [STARTED, SUCCEEDED, FAILED, TIMEOUT, CANCELED]
  업무대상유형코드: [USER, SIGNUP_APPLICATION, ISSUE_APPLICATION, LIFECYCLE_APPLICATION, KERI_IDENTIFIER, ACDC_CREDENTIAL, BILLING, PAYMENT, BOARD_POST, INTEGRATION_JOB]
  우선순위코드: [LOW, NORMAL, HIGH, URGENT]
  감사이벤트유형코드: [CREATE, UPDATE, DELETE, STATUS_CHANGE, LOGIN, LOGOUT, APPROVE, REJECT, ISSUE, REVOKE, PAYMENT, REFUND, INTEGRATION_REQUEST, INTEGRATION_RESPONSE, VIEW, DOWNLOAD]
  감사이벤트결과코드: [SUCCESS, FAIL, DENIED, ERROR]
  통지유형코드: [SIGNUP, APPLICATION, REVIEW, ISSUE, REVOKE, PAYMENT, REFUND, POINT, INTEGRATION_FAILURE, NOTICE]
  통지상태코드: [CREATED, SCHEDULED, SENDING, SENT, PARTIALLY_FAILED, FAILED, CANCELED]
  통지채널코드: [IN_APP, EMAIL, SMS, KAKAO, WEBHOOK]
  알림템플릿상태코드: [DRAFT, ACTIVE, INACTIVE, RETIRED]
  수신상태코드: [PENDING, SENT, FAILED, READ, CANCELED]
  발송상태코드: [REQUESTED, SENT, FAILED, CANCELED]

standard_domains:
  연계시스템번호: { type: string, length: 36, description: UUID 기준 }
  엔드포인트번호: { type: string, length: 36, description: UUID 기준 }
  연계작업번호: { type: string, length: 36, description: UUID 기준 }
  이력번호: { type: string, length: 36, description: UUID 기준 }
  감사로그번호: { type: string, length: 36, description: UUID 기준 }
  알림템플릿번호: { type: string, length: 36, description: UUID 기준 }
  통지번호: { type: string, length: 36, description: UUID 기준 }
  이용자번호: { type: string, length: 36, description: 이용자 식별자 }
  신청번호: { type: string, length: 36, description: 발급신청 식별자 }
  생명주기신청번호: { type: string, length: 36, description: 생명주기신청 식별자 }
  KERI식별자번호: { type: string, length: 36, description: KERI식별자 식별자 }
  ACDC자격증명번호: { type: string, length: 36, description: ACDC자격증명 식별자 }
  과금번호: { type: string, length: 36, description: 과금 식별자 }
  결제번호: { type: string, length: 36, description: 결제 식별자 }
  게시물번호: { type: string, length: 36, description: 게시물 식별자 }
  명칭: { type: string, length: 500, description: 시스템명, 엔드포인트명, 제목 등 }
  내용: { type: clob, description: 요약, 본문, 오류내용 등 }
  URL: { type: string, length: 2000, description: 호출 URL }
  참조값: { type: string, length: 255, description: 보안 저장소 참조, 외부 참조값 }
  식별값: { type: string, length: 255, description: 멱등키, correlation id, 대상 식별자 등 }
  해시값: { type: string, length: 128, description: 요청/응답 해시 }
  코드값: { type: string, length: 100, description: 응답코드, 오류코드 등 }
  IP주소: { type: string, length: 45, description: IPv4 또는 IPv6 }
  여부: { type: string, length: 1, description: Y/N }
  건수: { type: number, precision: 19, description: 횟수, 초수, 밀리초수 등 }
  순번: { type: number, precision: 10, description: 시도 순번 }
  일시: { type: timestamp, description: 발생 시각 }
`;

export const DEFAULT_PORTAL_CONTENT_LOGICAL_YAML = `subject_area: QVI 포탈콘텐츠
notation: Barker logical model
version: 0.1
status: draft
source_context:
  - doc/DB설계/QVI 개념 모델.md
  - doc/DB설계/QVI 상세 논리 모델 작성 기준.md
artifact_policy: YAML only. SVG 산출물은 생성하지 않는다.

relationship_notation:
  participation:
    optional_one: "0..1"
    mandatory_one: "1..1"
    optional_many: "0..M"
    mandatory_many: "1..M"
  identifying_rule: 부모 FK가 자식 PK에 포함되면 식별관계이다.
  non_identifying_rule: FK가 필수라도 자식 PK에 포함되지 않으면 비식별 참조 관계이다.

modeling_principles:
  - 공지사항, 자료실, FAQ, 문의는 별도 엔터티로 분리하지 않고 게시판유형코드와 게시물유형코드로 구분한다.
  - 자료실 파일은 게시물과 첨부파일의 관계로 표현한다.
  - 문의 답변은 게시물 본문에 섞지 않고 게시물답변 엔터티로 분리한다.
  - FAQ는 게시물 본문에 질문과 답변을 함께 저장할 수 있고, 운영 정책상 별도 답변 이력이 필요하면 게시물답변을 사용할 수 있다.
  - 게시물의 게시, 숨김, 폐기, 공개범위 변경은 게시물상태코드와 감사로그로 추적한다.
  - 조회 이력과 다운로드 이력은 통계와 감사 요구에 대응하기 위해 포탈콘텐츠 영역에서 관리한다.
  - 첨부파일 원본 메타데이터는 공통 첨부파일 엔터티를 재사용한다.

entities:
  - name: 게시판
    type: entity
    identifier: 게시판번호
    attributes:
      - { name: 게시판번호, domain: 게시판번호, required: true, identifier: true }
      - { name: 상위게시판번호, domain: 게시판번호, required: false, foreign_key: true }
      - { name: 게시판유형코드, domain: 게시판유형코드, required: true }
      - { name: 게시판상태코드, domain: 게시판상태코드, required: true }
      - { name: 게시판명, domain: 명칭, required: true }
      - { name: 게시판설명내용, domain: 내용, required: false }
      - { name: 공개범위코드, domain: 공개범위코드, required: true }
      - { name: 익명작성허용여부, domain: 여부, required: true }
      - { name: 답변사용여부, domain: 여부, required: true }
      - { name: 첨부사용여부, domain: 여부, required: true }
      - { name: 표시순번, domain: 순번, required: true }
      - { name: 등록자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: 게시물
    type: entity
    identifier: 게시물번호
    attributes:
      - { name: 게시물번호, domain: 게시물번호, required: true, identifier: true }
      - { name: 게시판번호, domain: 게시판번호, required: true, foreign_key: true }
      - { name: 게시물유형코드, domain: 게시물유형코드, required: true }
      - { name: 게시물상태코드, domain: 게시물상태코드, required: true }
      - { name: 공개범위코드, domain: 공개범위코드, required: true }
      - { name: 문의처리상태코드, domain: 문의처리상태코드, required: false }
      - { name: 제목명, domain: 명칭, required: true }
      - { name: 본문내용, domain: 내용, required: true }
      - { name: 작성자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 수정자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 게시승인자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 중요공지여부, domain: 여부, required: true }
      - { name: 비밀글여부, domain: 여부, required: true }
      - { name: 조회수, domain: 건수, required: true }
      - { name: 게시시작일시, domain: 일시, required: false }
      - { name: 게시종료일시, domain: 일시, required: false }
      - { name: 게시일시, domain: 일시, required: false }
      - { name: 작성일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }
      - { name: 삭제일시, domain: 일시, required: false }

  - name: 게시물답변
    type: entity
    identifier: 답변번호
    attributes:
      - { name: 답변번호, domain: 답변번호, required: true, identifier: true }
      - { name: 게시물번호, domain: 게시물번호, required: true, foreign_key: true }
      - { name: 답변상태코드, domain: 답변상태코드, required: true }
      - { name: 답변내용, domain: 내용, required: true }
      - { name: 작성자이용자번호, domain: 이용자번호, required: true, foreign_key: true }
      - { name: 수정자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 채택여부, domain: 여부, required: true }
      - { name: 작성일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }
      - { name: 삭제일시, domain: 일시, required: false }

  - name: 게시물첨부파일
    type: relationship_entity
    identifier: [게시물번호, 첨부파일번호]
    attributes:
      - { name: 게시물번호, domain: 게시물번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, identifier: true, foreign_key: true }
      - { name: 첨부파일유형코드, domain: 첨부파일유형코드, required: true }
      - { name: 표시순번, domain: 순번, required: true }
      - { name: 다운로드허용여부, domain: 여부, required: true }
      - { name: 다운로드횟수, domain: 건수, required: true }
      - { name: 검증상태코드, domain: 첨부파일검증상태코드, required: true }
      - { name: 검증자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 검증일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: 게시물조회이력
    type: log_entity
    identifier: 조회이력번호
    attributes:
      - { name: 조회이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 게시물번호, domain: 게시물번호, required: true, foreign_key: true }
      - { name: 조회자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 조회일시, domain: 일시, required: true }
      - { name: IP주소값, domain: IP주소, required: false }
      - { name: 사용자에이전트값, domain: 내용, required: false }

  - name: 첨부파일다운로드이력
    type: log_entity
    identifier: 다운로드이력번호
    attributes:
      - { name: 다운로드이력번호, domain: 이력번호, required: true, identifier: true }
      - { name: 게시물번호, domain: 게시물번호, required: true, foreign_key: true }
      - { name: 첨부파일번호, domain: 첨부파일번호, required: true, foreign_key: true }
      - { name: 다운로드자이용자번호, domain: 이용자번호, required: false, foreign_key: true }
      - { name: 다운로드일시, domain: 일시, required: true }
      - { name: IP주소값, domain: IP주소, required: false }
      - { name: 사용자에이전트값, domain: 내용, required: false }

external_entities:
  - { name: 이용자, owner: QVI 이용자/가입/계정 }
  - { name: 첨부파일, owner: QVI 공통 첨부파일, current_source: QVI 발급신청/생명주기 }
  - { name: 감사로그, owner: QVI 외부연계/감사/알림 }

relationships:
  - id: R-CON-001
    parent: 게시판
    child: 게시판
    parent_to_child: 포함한다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [상위게시판번호]
    recursive: true
    barker_sentence: 각 게시판은 하위 게시판을 0개 이상 포함할 수 있다. 각 게시판은 상위 게시판이 없거나 하나일 수 있다.
  - id: R-CON-002
    parent: 이용자
    child: 게시판
    parent_to_child: 등록한다
    child_to_parent: 등록된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [등록자이용자번호]
    barker_sentence: 각 이용자는 게시판을 0개 이상 등록할 수 있다. 각 게시판은 등록자가 없거나 하나일 수 있다.
  - id: R-CON-003
    parent: 게시판
    child: 게시물
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [게시판번호]
    barker_sentence: 각 게시판은 게시물을 0개 이상 가진다. 각 게시물은 반드시 하나의 게시판에 속한다.
  - id: R-CON-004
    parent: 이용자
    child: 게시물
    parent_to_child: 작성한다
    child_to_parent: 작성된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [작성자이용자번호]
    barker_sentence: 각 이용자는 게시물을 0개 이상 작성할 수 있다. 각 게시물은 반드시 하나의 작성자 이용자를 가진다.
  - id: R-CON-005
    parent: 이용자
    child: 게시물
    parent_to_child: 수정한다
    child_to_parent: 수정된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [수정자이용자번호]
    barker_sentence: 각 이용자는 게시물을 0개 이상 수정할 수 있다. 각 게시물은 수정자가 없거나 하나일 수 있다.
  - id: R-CON-006
    parent: 이용자
    child: 게시물
    parent_to_child: 게시승인한다
    child_to_parent: 게시승인된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [게시승인자이용자번호]
    barker_sentence: 각 이용자는 게시물을 0개 이상 게시승인할 수 있다. 각 게시물은 게시승인자가 없거나 하나일 수 있다.
  - id: R-CON-007
    parent: 게시물
    child: 게시물답변
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [게시물번호]
    barker_sentence: 각 게시물은 답변을 0개 이상 가질 수 있다. 각 게시물답변은 반드시 하나의 게시물에 속한다.
  - id: R-CON-008
    parent: 이용자
    child: 게시물답변
    parent_to_child: 작성한다
    child_to_parent: 작성된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [작성자이용자번호]
    barker_sentence: 각 이용자는 게시물답변을 0개 이상 작성할 수 있다. 각 게시물답변은 반드시 하나의 작성자 이용자를 가진다.
  - id: R-CON-009
    parent: 이용자
    child: 게시물답변
    parent_to_child: 수정한다
    child_to_parent: 수정된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [수정자이용자번호]
    barker_sentence: 각 이용자는 게시물답변을 0개 이상 수정할 수 있다. 각 게시물답변은 수정자가 없거나 하나일 수 있다.
  - id: R-CON-010
    parent: 게시물
    child: 게시물첨부파일
    parent_to_child: 가진다
    child_to_parent: 속한다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [게시물번호]
    barker_sentence: 각 게시물은 첨부파일 관계를 0개 이상 가질 수 있다. 각 게시물첨부파일은 반드시 하나의 게시물에 속한다.
  - id: R-CON-011
    parent: 첨부파일
    child: 게시물첨부파일
    parent_to_child: 첨부된다
    child_to_parent: 연결된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: true
    fk_attributes: [첨부파일번호]
    barker_sentence: 각 첨부파일은 게시물에 0회 이상 연결될 수 있다. 각 게시물첨부파일은 반드시 하나의 첨부파일을 가진다.
  - id: R-CON-012
    parent: 이용자
    child: 게시물첨부파일
    parent_to_child: 검증한다
    child_to_parent: 검증된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [검증자이용자번호]
    barker_sentence: 각 이용자는 게시물첨부파일을 0개 이상 검증할 수 있다. 각 게시물첨부파일은 검증자가 없거나 하나일 수 있다.
  - id: R-CON-013
    parent: 게시물
    child: 게시물조회이력
    parent_to_child: 조회된다
    child_to_parent: 조회대상이다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [게시물번호]
    barker_sentence: 각 게시물은 조회 이력을 0개 이상 가질 수 있다. 각 게시물조회이력은 반드시 하나의 게시물에 대한 조회이다.
  - id: R-CON-014
    parent: 이용자
    child: 게시물조회이력
    parent_to_child: 조회한다
    child_to_parent: 조회된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [조회자이용자번호]
    barker_sentence: 각 이용자는 게시물을 0회 이상 조회할 수 있다. 각 게시물조회이력은 로그인 이용자가 없거나 하나일 수 있다.
  - id: R-CON-015
    parent: 게시물첨부파일
    child: 첨부파일다운로드이력
    parent_to_child: 다운로드된다
    child_to_parent: 다운로드대상이다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "1..1"
    identifying: false
    fk_attributes: [게시물번호, 첨부파일번호]
    barker_sentence: 각 게시물첨부파일은 다운로드 이력을 0개 이상 가질 수 있다. 각 첨부파일다운로드이력은 반드시 하나의 게시물첨부파일에 대한 다운로드이다.
  - id: R-CON-016
    parent: 이용자
    child: 첨부파일다운로드이력
    parent_to_child: 다운로드한다
    child_to_parent: 다운로드된다
    cardinality: "1:M"
    parent_participation: "0..M"
    child_participation: "0..1"
    identifying: false
    fk_attributes: [다운로드자이용자번호]
    barker_sentence: 각 이용자는 첨부파일을 0회 이상 다운로드할 수 있다. 각 첨부파일다운로드이력은 로그인 이용자가 없거나 하나일 수 있다.

business_rules:
  - 게시판유형코드가 DOWNLOAD인 게시판은 첨부사용여부가 Y여야 한다.
  - 게시판유형코드가 INQUIRY인 게시판은 답변사용여부가 Y여야 한다.
  - 게시물유형코드가 INQUIRY인 게시물은 문의처리상태코드를 가져야 한다.
  - 게시물상태코드가 PUBLISHED인 게시물은 게시일시를 가져야 한다.
  - 게시물상태코드가 DELETED인 게시물은 삭제일시를 가져야 한다.
  - 비밀글여부가 Y인 게시물은 작성자, 답변 담당자, 권한 있는 QVI직원만 조회할 수 있다.
  - 게시물첨부파일의 다운로드허용여부가 N이면 다운로드 이력을 생성하지 않고 다운로드를 차단한다.
  - 게시물첨부파일의 검증상태코드가 REJECTED이면 게시물 공개 전에 교체 또는 삭제해야 한다.
  - 조회수와 다운로드횟수는 이력에서 재집계 가능해야 한다.

code_groups:
  게시판유형코드: [NOTICE, DOWNLOAD, FAQ, INQUIRY]
  게시판상태코드: [ACTIVE, INACTIVE, CLOSED]
  게시물유형코드: [NOTICE, DOWNLOAD, FAQ, INQUIRY, GUIDE]
  게시물상태코드: [DRAFT, REQUESTED, PUBLISHED, HIDDEN, DELETED, REJECTED]
  공개범위코드: [PUBLIC, MEMBER_ONLY, LE_MEMBER_ONLY, QVI_ONLY, PRIVATE]
  문의처리상태코드: [REQUESTED, RECEIVED, ANSWERING, ANSWERED, CLOSED, REJECTED]
  답변상태코드: [DRAFT, PUBLISHED, HIDDEN, DELETED]
  첨부파일유형코드: [CONTENT, DOWNLOAD, IMAGE, FORM, ETC]
  첨부파일검증상태코드: [NOT_VERIFIED, VERIFIED, REJECTED]

standard_domains:
  게시판번호: { type: string, length: 36, description: UUID 기준 }
  게시물번호: { type: string, length: 36, description: UUID 기준 }
  답변번호: { type: string, length: 36, description: UUID 기준 }
  첨부파일번호: { type: string, length: 36, description: UUID 기준 }
  이력번호: { type: string, length: 36, description: UUID 기준 }
  이용자번호: { type: string, length: 36, description: 이용자 식별자 }
  명칭: { type: string, length: 500, description: 제목, 게시판명 등 }
  내용: { type: clob, description: 본문, 답변, 사용자 에이전트 등 }
  여부: { type: string, length: 1, description: Y/N }
  순번: { type: number, precision: 10, description: 표시 순서 }
  건수: { type: number, precision: 19, description: 조회수, 다운로드횟수 }
  IP주소: { type: string, length: 45, description: IPv4 또는 IPv6 }
  일시: { type: timestamp, description: 발생 시각 }
`;

export const DEFAULT_IDENTIFIER_LOGICAL_YAML = `subject_area: KERI 식별자 및 Credential
notation: Barker-style logical model
version: 0.1
status: draft
source_context:
  - doc/DB설계/QVI 이용자 논리 모델.md
  - doc/DB설계/vlei_qvi_db_oracle.sql

rules:
  - KERIA LMDB는 KEL, TEL, credential 원문의 권위 저장소이다.
  - 업무 DB는 포탈, 심사, 발급, 폐기, 감사에 필요한 식별자와 상태 스냅샷을 관리한다.
  - KERI식별자(AID)는 특정 이용자에게 직접 종속되지 않고 KERI식별주체와 관계 엔터티로 연결한다.
  - 이용자는 KERI식별자에 대해 운영, 서명, 보유, 위임관리 등 권한 관계를 가질 수 있다.
  - KERI식별자보유관계와 KERI식별자운영권한은 선분 이력으로 관리한다.
  - 선분 이력의 유효종료일자는 현재 유효한 관계인 경우 비워둘 수 있다.
  - 동일 관계유형에 대해 동일 주체/이용자와 동일 KERI식별자의 유효기간은 중복될 수 없다.
  - 하나의 KERI식별자는 하나의 KEL을 가진다.
  - KEL이벤트 전체 저장은 선택 사항이며, 1차 물리 모델에서는 최신 상태 스냅샷만 구현할 수 있다.
  - ACDC Credential은 issuer KERI식별자와 holder KERI식별자를 참조한다.

entities:
  - name: KERI식별주체
    type: entity
    identifier: 주체번호
    attributes:
      - { name: 주체번호, domain: 주체번호, required: true, identifier: true }
      - { name: 주체구분코드, domain: KERI식별주체구분코드, required: true }
      - { name: 참조엔터티명, domain: 명칭, required: true }
      - { name: 참조식별자값, domain: 식별자값, required: true }
      - { name: 주체명, domain: 명칭, required: true }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KERI식별자
    type: entity
    identifier: KERI식별자번호
    attributes:
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true }
      - { name: AID, domain: AID, required: true }
      - { name: 식별자별칭명, domain: 명칭, required: false }
      - { name: KERIA에이전트구분코드, domain: KERIA에이전트구분코드, required: true }
      - { name: 식별자용도코드, domain: KERI식별자용도코드, required: true }
      - { name: 식별자상태코드, domain: KERI식별자상태코드, required: true }
      - { name: 생성일시, domain: 일시, required: true }
      - { name: 최종회전일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KERI식별자보유관계
    type: relationship_entity
    identifier: [주체번호, KERI식별자번호, 보유관계유형코드, 유효시작일자]
    attributes:
      - { name: 주체번호, domain: 주체번호, required: true, identifier: true }
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true }
      - { name: 보유관계유형코드, domain: 보유관계유형코드, required: true, identifier: true }
      - { name: 유효시작일자, domain: 일자, required: true, identifier: true }
      - { name: 유효종료일자, domain: 일자, required: false }
      - { name: 기본여부, domain: 여부, required: true }
      - { name: 관계상태코드, domain: 관계상태코드, required: true }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KERI식별자운영권한
    type: relationship_entity
    identifier: [이용자번호, KERI식별자번호, 운영권한유형코드, 유효시작일자]
    attributes:
      - { name: 이용자번호, domain: 이용자번호, required: true, identifier: true }
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true }
      - { name: 운영권한유형코드, domain: 운영권한유형코드, required: true, identifier: true }
      - { name: 유효시작일자, domain: 일자, required: true, identifier: true }
      - { name: 유효종료일자, domain: 일자, required: false }
      - { name: 권한상태코드, domain: 권한상태코드, required: true }
      - { name: 권한부여자이용자번호, domain: 이용자번호, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KEL
    type: dependent_entity
    identifier: KERI식별자번호
    attributes:
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true }
      - { name: 현재순번, domain: 순번, required: true }
      - { name: 현재이벤트SAID, domain: SAID, required: false }
      - { name: 현재이벤트다이제스트값, domain: 다이제스트값, required: false }
      - { name: 최종이벤트유형코드, domain: KEL이벤트유형코드, required: false }
      - { name: 최종동기화일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: KEL이벤트
    type: dependent_entity
    identifier: [KERI식별자번호, 이벤트순번]
    optional_physical: true
    attributes:
      - { name: KERI식별자번호, domain: KERI식별자번호, required: true, identifier: true }
      - { name: 이벤트순번, domain: 순번, required: true, identifier: true }
      - { name: 이벤트유형코드, domain: KEL이벤트유형코드, required: true }
      - { name: 이벤트SAID, domain: SAID, required: false }
      - { name: 이벤트다이제스트값, domain: 다이제스트값, required: false }
      - { name: 이벤트발생일시, domain: 일시, required: false }
      - { name: 원문참조값, domain: 참조값, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: CredentialRegistry
    type: dependent_entity
    identifier: 레지스트리번호
    attributes:
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true, identifier: true }
      - { name: 레지스트리식별자, domain: 레지스트리식별자, required: true }
      - { name: 발급자KERI식별자번호, domain: KERI식별자번호, required: true }
      - { name: 레지스트리명, domain: 명칭, required: false }
      - { name: 레지스트리상태코드, domain: 레지스트리상태코드, required: true }
      - { name: 생성일시, domain: 일시, required: true }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: TEL
    type: dependent_entity
    identifier: 레지스트리번호
    attributes:
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true, identifier: true }
      - { name: 현재순번, domain: 순번, required: true }
      - { name: 현재이벤트SAID, domain: SAID, required: false }
      - { name: 최종이벤트유형코드, domain: TEL이벤트유형코드, required: false }
      - { name: 최종동기화일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

  - name: TEL이벤트
    type: dependent_entity
    identifier: [레지스트리번호, 이벤트순번]
    optional_physical: true
    attributes:
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true, identifier: true }
      - { name: 이벤트순번, domain: 순번, required: true, identifier: true }
      - { name: 이벤트유형코드, domain: TEL이벤트유형코드, required: true }
      - { name: 이벤트SAID, domain: SAID, required: false }
      - { name: 이벤트발생일시, domain: 일시, required: false }
      - { name: 원문참조값, domain: 참조값, required: false }
      - { name: 등록일시, domain: 일시, required: true }

  - name: ACDC자격증명
    type: entity
    identifier: ACDC자격증명번호
    attributes:
      - { name: ACDC자격증명번호, domain: ACDC자격증명번호, required: true, identifier: true }
      - { name: 자격증명SAID, domain: SAID, required: true }
      - { name: 스키마SAID, domain: SAID, required: true }
      - { name: 자격증명유형코드, domain: ACDC자격증명유형코드, required: true }
      - { name: 발급자KERI식별자번호, domain: KERI식별자번호, required: true }
      - { name: 보유자KERI식별자번호, domain: KERI식별자번호, required: false }
      - { name: 대상주체번호, domain: 주체번호, required: false }
      - { name: 레지스트리번호, domain: 레지스트리번호, required: true }
      - { name: 발급상태코드, domain: ACDC발급상태코드, required: true }
      - { name: IPEXGrantSAID, domain: SAID, required: false }
      - { name: Admit여부, domain: 여부, required: true }
      - { name: 폐기여부, domain: 여부, required: true }
      - { name: 발급일시, domain: 일시, required: false }
      - { name: 수락일시, domain: 일시, required: false }
      - { name: 폐기일시, domain: 일시, required: false }
      - { name: 등록일시, domain: 일시, required: true }
      - { name: 수정일시, domain: 일시, required: true }

relationships:
  - { name: 식별한다, from: KERI식별주체, to: KERI식별자보유관계, cardinality: one_to_many }
  - { name: 보유된다, from: KERI식별자, to: KERI식별자보유관계, cardinality: one_to_many }
  - { name: 운영한다, from: 이용자, to: KERI식별자운영권한, cardinality: one_to_many, external_entity: true }
  - { name: 운영대상이다, from: KERI식별자, to: KERI식별자운영권한, cardinality: one_to_many }
  - { name: 가진다, from: KERI식별자, to: KEL, cardinality: one_to_one }
  - { name: 포함한다, from: KEL, to: KEL이벤트, cardinality: one_to_many }
  - { name: 생성한다, from: KERI식별자, to: CredentialRegistry, cardinality: one_to_many }
  - { name: 가진다, from: CredentialRegistry, to: TEL, cardinality: one_to_one }
  - { name: 포함한다, from: TEL, to: TEL이벤트, cardinality: one_to_many }
  - { name: 발급한다, from: KERI식별자, to: ACDC자격증명, cardinality: one_to_many, role: issuer }
  - { name: 보유한다, from: KERI식별자, to: ACDC자격증명, cardinality: one_to_many, role: holder }
  - { name: 등록된다, from: CredentialRegistry, to: ACDC자격증명, cardinality: one_to_many }
`;

export const DEFAULT_DICTIONARY_YAML = `words:
  - { logical: 이용자, physical: USR }
  - { logical: 사용자, physical: USR }
  - { logical: 신청, physical: APPL }
  - { logical: 유형, physical: TYP }
  - { logical: 구분, physical: DIV }
  - { logical: 코드, physical: CD }
  - { logical: 번호, physical: NO }
  - { logical: 이력, physical: HIST }
  - { logical: 상태, physical: STAT }
  - { logical: 명, physical: NM }
  - { logical: 이름, physical: NM }
  - { logical: 사유, physical: RSN }
  - { logical: 일시, physical: DT }
  - { logical: 일자, physical: DT }
  - { logical: 접수, physical: RCV }
  - { logical: 완료, physical: CMPL }
  - { logical: 반려, physical: REJ }
  - { logical: 등록, physical: REG }
  - { logical: 수정, physical: MOD }
  - { logical: 비밀번호, physical: PWD }
  - { logical: 해시, physical: HASH }
  - { logical: 이메일, physical: EMAIL }
  - { logical: 주소, physical: ADDR }
  - { logical: 휴대폰, physical: MP }
  - { logical: 최종, physical: LST }
  - { logical: 로그인, physical: LGIN }
  - { logical: 법인, physical: CORP }
  - { logical: 회원, physical: MBR }
  - { logical: 직원, physical: EMP }
  - { logical: 가입, physical: JOIN }
  - { logical: 동의, physical: AGR }
  - { logical: 개인정보, physical: PRIV }
  - { logical: 단계, physical: STEP }
  - { logical: 처리, physical: PROC }
  - { logical: 담당자, physical: PIC }
  - { logical: 결과, physical: RST }
  - { logical: 자격증명, physical: CRED }
  - { logical: 식별자, physical: ID }
  - { logical: 소속, physical: DEPT }
  - { logical: 역할, physical: ROLE }
  - { logical: 설명, physical: DESC }
  - { logical: 업무, physical: BIZ }
  - { logical: 외부, physical: EXT }
  - { logical: 내부, physical: INT }
  - { logical: 연계, physical: LINK }
  - { logical: 시스템, physical: SYS }
  - { logical: 기관, physical: INST }
  - { logical: 운영, physical: OPR }
  - { logical: 인증, physical: AUTH }
  - { logical: 정보, physical: INFO }
  - { logical: 참조, physical: REF }
  - { logical: 값, physical: VAL }
  - { logical: 확인, physical: CHK }
  - { logical: 주기, physical: CYC }
  - { logical: 초수, physical: SEC }
  - { logical: 여부, physical: YN }
  - { logical: 시작, physical: STRT }
  - { logical: 종료, physical: END }
  - { logical: 생명주기, physical: LC }
terms:
  - { logical: 이용자번호, physical: USR_NO }
  - { logical: 이용자구분코드, physical: USR_DIV_CD }
  - { logical: 신청번호, physical: APPL_NO }
  - { logical: 신청유형코드, physical: APPL_TYP_CD }
  - { logical: 신청상태코드, physical: APPL_STAT_CD }
`;

export const DEFAULT_DOMAINS_YAML = `domains:
  - { logicalName: 번호, dataTypeOracle: "NUMBER(10)", dataTypePostgres: "INTEGER", dataTypeMysql: "INT" }
  - { logicalName: 일시, dataTypeOracle: "TIMESTAMP", dataTypePostgres: "TIMESTAMP", dataTypeMysql: "DATETIME" }
  - { logicalName: 구분, dataTypeOracle: "VARCHAR2(10)", dataTypePostgres: "VARCHAR(10)", dataTypeMysql: "VARCHAR(10)" }
  - { logicalName: 코드, dataTypeOracle: "VARCHAR2(20)", dataTypePostgres: "VARCHAR(20)", dataTypeMysql: "VARCHAR(20)" }
  - { logicalName: 여부, dataTypeOracle: "CHAR(1)", dataTypePostgres: "CHAR(1)", dataTypeMysql: "CHAR(1)" }
  - { logicalName: 이름, dataTypeOracle: "VARCHAR2(100)", dataTypePostgres: "VARCHAR(100)", dataTypeMysql: "VARCHAR(100)" }
  - { logicalName: 명, dataTypeOracle: "VARCHAR2(100)", dataTypePostgres: "VARCHAR(100)", dataTypeMysql: "VARCHAR(100)" }
  - { logicalName: 내용, dataTypeOracle: "VARCHAR2(1000)", dataTypePostgres: "VARCHAR(1000)", dataTypeMysql: "TEXT" }
  - { logicalName: 설명, dataTypeOracle: "VARCHAR2(1000)", dataTypePostgres: "VARCHAR(1000)", dataTypeMysql: "TEXT" }
  - { logicalName: 일자, dataTypeOracle: "DATE", dataTypePostgres: "DATE", dataTypeMysql: "DATE" }
  - { logicalName: 금액, dataTypeOracle: "NUMBER(15,2)", dataTypePostgres: "NUMERIC(15,2)", dataTypeMysql: "DECIMAL(15,2)" }
  - { logicalName: 주소, dataTypeOracle: "VARCHAR2(200)", dataTypePostgres: "VARCHAR(200)", dataTypeMysql: "VARCHAR(200)" }
  - { logicalName: 전화번호, dataTypeOracle: "VARCHAR2(20)", dataTypePostgres: "VARCHAR(20)", dataTypeMysql: "VARCHAR(20)" }
`;

export const DEFAULT_OVERRIDES_YAML = `table_overrides:
  - entity_ref: 이용자
    table_name: TB_SYSTEM_USER
    tablespace: TS_USER_DATA
    columns:
      - attribute_ref: 등록일시
        column_name: REG_DTM
`;

export const DEFAULT_MODEL_YAML = DEFAULT_LOGICAL_YAML;
