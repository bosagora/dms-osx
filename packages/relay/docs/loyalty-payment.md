# 로열티를 사용한 결제 프로세스

-   [1. 시퀀스 다이어그램](#1-시퀀스-다이어그램)
    -   [1.1. 신규결제에 대한 사용자가 승인 했을 때 과정](#11-신규결제에-대한-사용자가-승인-했을-때-과정)
    -   [1.2. 신규결제에 대한 사용자가 거부 했을 때 과정](#12-신규결제에-대한-사용자가-거부-했을-때-과정)
    -   [1.3. 취소결제에 대한 상점주가 승인 했을 때 과정](#13-취소결제에-대한-상점주가-승인-했을-때-과정)
    -   [1.4. 취소결제에 대한 상점주가 거부 했을 때 과정](#14-취소결제에-대한-상점주가-거부-했을-때-과정)
    -   [1.5. 상점의 정산 요청 및 처리 과정](#15-상점의-정산-요청-및-처리-과정)
-   [2. URL](#2-url)
-   [3. KIOSK 를 위한 엔드포인트](#3-kiosk-를-위한-엔드포인트)
    -   [3.1. 사용자의 로열티 잔고](#31-사용자의-로열티-잔고)
    -   [3.2. 지불에 사용될 예상 로열티 산출](#32-지불에-사용될-예상-로열티-산출)
    -   [3.3. 신규결제생성](#33-신규결제생성)
    -   [3.4. 신규결제완료](#34-신규결제완료)
    -   [3.5. 취소결제생성](#35-취소결제생성)
    -   [3.6. 취소결제완료](#36-취소결제완)
    -   [3.7. 상점의 정보](#37-상점의-정보)
    -   [3.8. 상점의 인출 요청정보](#38-상점의-인출-요청정보)
-   [4. KIOSK 의 콜백엔드포인트로 결제의 응답](#4-KIOSK-의-콜백엔드포인트로-전달되는-데이터)
    -   [4.1 응답 데이터의 형태](#41-응답-데이터의-형태)
    -   [4.2 응답 데이터의 예시](#42-응답-데이터의-예시)
-   [5. 모바일 앱을 위한 엔드포인트](#5-모바일-앱을-위한-엔드포인트)
    -   [5.1 결제정보 요청](#51-결제정보-요청)
    -   [5.2 결제승인](#52-결제승인)
    -   [5.3 결제거부](#53-결제거부)
    -   [5.4 취소승인](#54-취소승인)
    -   [5.5 취소거부](#55-취소거부)

## 1. 시퀀스 다이어그램

### 1.1. 신규결제에 대한 사용자가 승인 했을 때 과정

![](loyalty-pament-diagram01.png)

1. 사용자가 모바일앱에서 결제용 QR코드를 생성한다.
2. 사용자가 모바일화면의 QR코드를 KIOSK 에 입력한다.
3. KIOSK가 임시지갑주소를 이용하여 사용자의 잔고를 조회한다.
4. 잔고정보 응답
5. KIOSK에서 DMS Relay 의 엔드포인트를 호출한다.
6. 응답
7. 지갑이 내장된 모바일앱에 푸쉬메세지를 전송한다.
8. 사용자는 푸쉬메세지를 받고 해당 결제에 승인한다.
9. 결제를 진행하기 위해 컨트랙트를 호출한다. (자산을 임시계정으로 이동)
10. 컨트랙트의 실행후 이벤트를 수집한다.
11. 최종 결제 결과를 KIOSK로 전달한다.
12. 응답
13. 최종승인
14. 결제완료(자산을 이동함)
15. 응답
16. 응답

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 1.2. 신규결제에 대한 사용자가 거부 했을 때 과정

![](loyalty-pament-diagram02.png)

1. 사용자가 모바일앱에서 결제용 QR코드를 생성한다.
2. 사용자가 모바일화면의 QR코드를 KIOSK 에 입력한다.
3. KIOSK가 임시지갑주소를 이용하여 사용자의 잔고를 조회한다.
4. 잔고정보 응답
5. KIOSK에서 DMS Relay 의 신규결제를 엔드포인트를 호출한다.
6. 응답
7. 지갑이 내장된 모바일앱에 푸쉬메세지를 전송한다.
8. 사용자는 푸쉬메세지를 받고 해당 결제에 거부한다.
9. 최종 거부된 결과를 KIOSK로 전달한다.
10. 응답

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 1.3. 취소결제에 대한 상점주가 승인 했을 때 과정

![](loyalty-pament-diagram03.png)

1. KIOSK에서 DMS Relay 의 취소결제 엔드포인트를 호출한다.
2. 응답
3. 지갑이 내장된 모바일앱에 푸쉬메세지를 전송한다.
4. 상점주는 푸쉬메세지를 받고 해당 결제에 대해서 취소를 승인한다.
5. 취소결제를 진행하기 위해 컨트랙트를 호출한다. (자산을 임시계정으로 이동)
6. 컨트랙트의 실행후 이벤트를 수집한다.
7. 최종 결제 결과를 KIOSK로 전달한다.
8. 응답
9. 최종승인
10. 결제완료(자산을 이동함)
11. 응답
12. 응답

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 1.4. 취소결제에 대한 상점주가 거부 했을 때 과정

![](loyalty-pament-diagram04.png)

1. KIOSK에서 DMS Relay 의 취소결제 엔드포인트를 호출한다.
2. 응답
3. 지갑이 내장된 모바일앱에 푸쉬메세지를 전송한다.
4. 상점주는 푸쉬메세지를 받고 해당 결제에 대해서 취소를 거부한다.
5. 결제거부를 KIOSK로 전달한다.
6. 응답

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 1.5. 상점의 정산 요청 및 처리 과정

![](loyalty-pament-diagram10.png)

1. 상점주가 정산금을 앱을 통해 요청한다.
2.
3. 모바일 앱은 직접 스마트컨트랙트를 호출하지 않고 DMS Relay에 전달한다.(DMS-SDK를 이용한다)
4.
5. DMS Relay는 스마트컨트랙트의 인출을 등록한다.
6.
7. 인출이 등록되면 이벤트가 발생한다. 이것을 수집하여 데이타베이스에 인덱싱한다.
8. 수집된 이벤트들을 제공하는 관리자 페이지에서 관리자가 확인 후 정산금을 상점주에게 이체한다.
9. 상점주는 인출금을 확인한다.
10. 인출금이 정상적으로 입금된 것을 확인한 후 인출완료를 하여 과정을 종결한다. 그렇지 않으면 추가적인 인출등록이 불가능하다.(DMS-SDK를 이용한다)
11.
12. 스마트컨트랙트를 호출하여 인출완료 처리한다. 이때 컨트랙트 내부의 누적 인출된 금액이 증가된다.

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

## 2. URL

-   메인넷: https://relay.kios.bosagora.org
-   테스트넷: https://relay.kios.testnet.bosagora.org
-   개발넷: https://relay.kios.devnet.bosagora.org

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

## 3. KIOSK 를 위한 엔드포인트

주의: 모든 금액은 소수점 18자리의 문자로 표현됩니다. 그리고 소수점은 포함하지 않습니다.

### 3.1. 사용자의 로열티 잔고

#### - HTTP Request

`GET /v1/payment/user/balance`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명     |
| ---------- | ------ | ---- | -------- |
| account    | string | Yes  | 월렛주소 |

#### - 결과

| 필드명      | 유형   | 필수 | 설명                                                         |
| ----------- | ------ | ---- | ------------------------------------------------------------ |
| account     | string | Yes  | 월렛주소                                                     |
| loyaltyType | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                   |
| balance     | string | Yes  | 잔고 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음) |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.2. 지불에 사용될 예상 로열티 산출

#### - HTTP Request

`GET /v1/payment/info`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명                                                             |
| ---------- | ------ | ---- | ---------------------------------------------------------------- |
| account    | string | Yes  | 월렛주소                                                         |
| amount     | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음) |
| currency   | string | Yes  | 환률코드(usd, krw, the9, point...)                               |

#### - 결과

| 필드명      | 유형   | 필수 | 설명                                                             |
| ----------- | ------ | ---- | ---------------------------------------------------------------- |
| account     | string | Yes  | 월렛주소                                                         |
| loyaltyType | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                       |
| amount      | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음) |
| currency    | string | Yes  | 환률코드(usd, krw, the9, point...)                               |
| balance     | string | Yes  | 잔고 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)     |
| paidPoint   | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다           |
| paidToken   | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다             |
| paidValue   | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                   |
| feePoint    | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다           |
| feeToken    | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다             |
| feeValue    | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                   |
| totalPoint  | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다             |
| totalToken  | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다               |
| totalValue  | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                     |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.3. 신규결제생성

[1.1. 시퀀스 다이어그램] 의 5번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/openNew`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명                                                             |
| ---------- | ------ | ---- | ---------------------------------------------------------------- |
| accessKey  | string | Yes  | 비밀키                                                           |
| purchaseId | string | Yes  | 구매 아이디                                                      |
| amount     | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음) |
| currency   | string | Yes  | 환률코드(usd, krw, the9, point...)                               |
| shopId     | string | Yes  | 상점 아이디                                                      |
| account    | string | Yes  | 월렛주소                                                         |

#### - 결과

| 필드명           | 유형   | 필수 | 설명                                                                                                                         |
| ---------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId        | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId       | string | Yes  | 구매 아이디                                                                                                                  |
| amount           | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency         | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId           | string | Yes  | 상점 아이디                                                                                                                  |
| account          | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType      | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint        | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken        | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue        | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| feePoint         | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken         | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue         | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint       | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken       | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue       | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus    | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| openNewTimestamp | number | Yes  | 신규결제 생성 명령어 접수 시간                                                                                               |

#### - 기타

-   요청후 45초간 콜백엔드포인트로 응답이 없으면 타입아웃 처리 할 수 있다.

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.4. 신규결제완료

[1.1. 시퀀스 다이어그램] 의 13번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/closeNew`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| accessKey  | string | Yes  | 비밀키      |
| paymentId  | string | Yes  | 지불 아이디 |

#### - 결과

| 필드명            | 유형   | 필수 | 설명                                                                                                                         |
| ----------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId         | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId        | string | Yes  | 구매 아이디                                                                                                                  |
| amount            | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency          | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId            | string | Yes  | 상점 아이디                                                                                                                  |
| account           | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType       | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint         | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken         | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue         | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| feePoint          | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken          | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue          | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint        | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken        | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue        | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus     | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| openNewTimestamp  | number | Yes  | 신규결제 생성 명령어 접수 시간                                                                                               |
| closeNewTimestamp | number | Yes  | 신규결제 완료 명령어 접수 시간                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.5. 취소결제생성

[1.3. 시퀀스 다이어그램] 의 1번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/openCancel`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| accessKey  | string | Yes  | 비밀키      |
| paymentId  | string | Yes  | 지불 아이디 |

#### - 결과

| 필드명              | 유형   | 필수 | 설명                                                                                                                         |
| ------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId           | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId          | string | Yes  | 구매 아이디                                                                                                                  |
| amount              | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency            | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId              | string | Yes  | 상점 아이디                                                                                                                  |
| account             | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType         | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint           | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken           | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue           | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| feePoint            | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken            | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue            | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint          | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken          | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue          | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus       | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| openNewTimestamp    | number | Yes  | 신규결제 생성 명령어 접수 시간                                                                                               |
| closeNewTimestamp   | number | Yes  | 신규결제 완료 명령어 접수 시간                                                                                               |
| openCancelTimestamp | number | Yes  | 취소결제 생성 명령어 접수 시간                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.6. 취소결제완료

[1.3. 시퀀스 다이어그램] 의 9번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/closeCancel`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| accessKey  | string | Yes  | 비밀키      |
| paymentId  | string | Yes  | 지불 아이디 |

#### - 결과

| 필드명               | 유형   | 필수 | 설명                                                                                                                         |
| -------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId            | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId           | string | Yes  | 구매 아이디                                                                                                                  |
| amount               | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency             | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId               | string | Yes  | 상점 아이디                                                                                                                  |
| account              | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType          | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint            | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken            | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue            | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| feePoint             | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken             | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue             | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint           | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken           | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue           | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus        | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| openNewTimestamp     | number | Yes  | 신규결제 생성 명령어 접수 시간                                                                                               |
| closeNewTimestamp    | number | Yes  | 신규결제 완료 명령어 접수 시간                                                                                               |
| openCancelTimestamp  | number | Yes  | 취소결제 생성 명령어 접수 시간                                                                                               |
| closeCancelTimestamp | number | Yes  | 취소결제 완료 명령어 접수 시간                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.7. 상점의 정보

#### - HTTP Request

`GET /v1/payment/shop/info`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| shopId     | string | Yes  | 상점 아이디 |

#### - 결과

| 필드명          | 유형   | 필수 | 설명                                   |
| --------------- | ------ | ---- | -------------------------------------- |
| shopId          | string | Yes  | 상점 아이디                            |
| name            | string | Yes  | 상점 이름                              |
| provideWaitTime | number | Yes  | 구매후 로열티를 적립하기 까지 지연시간 |
| providePercent  | number | Yes  | 적립비율\*100                          |
| account         | string | Yes  | 상점주의 월렛주소                      |
| providedPoint   | string | Yes  | 누적된 상점에서 제공한 로열티 포인트   |
| usedPoint       | string | Yes  | 누적된 상점에서 사용된 로열티 포인트   |
| settledPoint    | int    | Yes  | 정산이 된 금액                         |
| withdrawnPoint  | string | Yes  | 정산이 되어 출금이 완료된 금액         |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 3.8. 상점의 인출 요청정보

#### - HTTP Request

`GET /v1/payment/shop/withdrawal`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| shopId     | string | Yes  | 상점 아이디 |

#### - 결과

| 필드명         | 유형   | 필수 | 설명                                                                        |
| -------------- | ------ | ---- | --------------------------------------------------------------------------- |
| shopId         | string | Yes  | 상점 아이디                                                                 |
| withdrawAmount | string | Yes  | 인출요청이 된 금액                                                          |
| withdrawStatus | number | Yes  | 누적된 상점에서 사용된 로열티 포인트 (0: 인출진행중이 아님 , 1: 인출진행중) |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

## 4. KIOSK 의 콜백엔드포인트로 전달되는 데이터

[1.1. 시퀀스 다이어그램] 의 11번에서 사용된다.
[1.3. 시퀀스 다이어그램] 의 7번에서 사용된다.

### 4.1 응답 데이터의 형태

| 필드 1  | 필드 2      | 유형   | 필수 | 설명                                                                                                                      |
| ------- | ----------- | ------ | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| type    |             | string | Yes  | "create": 결제요청<br/>"cancel":취소요청                                                                                  |
| code    |             | int    | Yes  | 0: 성공<br/>1001: 거부<br/>1002: 컨트랙트 오류<br/>1003: 서버오류<br/>2000: 타임아웃                                      |
| message |             | string | Yes  | 응답 메세지                                                                                                               |
| data    | paymentId   | string | Yes  | 결제 아이디                                                                                                               |
| data    | purchaseId  | string | Yes  | 구매 아이디                                                                                                               |
| data    | amount      | string | Yes  | 상품가격                                                                                                                  |
| data    | currency    | string | Yes  | 환률코드                                                                                                                  |
| data    | shopId      | string | Yes  | 상점 아이디                                                                                                               |
| data    | account     | string | Yes  | 월렛 주소                                                                                                                 |
| data    | loyaltyType | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                |
| data    | paidPoint   | string | Yes  | 지불될 포인트, loyaltyType가 0일때 유효한 값이다<br/>(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값) |
| data    | paidToken   | string | Yes  | 지불될 토큰, loyaltyType가 1일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)        |
| data    | paidValue   | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                            |
| data    | feePoint    | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)      |
| data    | feeToken    | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)        |
| data    | feeValue    | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                            |
| data    | totalPoint  | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)        |
| data    | totalToken  | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)          |
| data    | totalValue  | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                              |
| data    | balance     | string | No   | 잔고                                                                                                                      |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 4.2 응답 데이터의 예시

#### 결제 성공했을 때의 응답

```json
{
    "type": "openNew",
    "code": 0,
    "message": "The payment has been successfully completed.",
    "data": {
        "paymentId": "0x644a5568445869656a16b67ab82894bbe7fb40e984bc5bff90002aa40177292f",
        "purchaseId": "P000002",
        "amount": "10000000000000000000",
        "currency": "krw",
        "account": "0x53801Bf69Cb9B6Ad205BAc9134766807551F26BC",
        "shopId": "0x5b2eaa90dbb877356c28cf13fe9263b1e749abeb78f031a4b35fa63c7d30e5db",
        "loyaltyType": 0,
        "paidPoint": "10000000000000000000",
        "paidToken": "0",
        "paidValue": "10000000000000000000",
        "feePoint": "500000000000000000",
        "feeToken": "0",
        "feeValue": "500000000000000000",
        "totalPoint": "10500000000000000000",
        "totalToken": "0",
        "totalValue": "10500000000000000000",
        "balance": "989500000000000000000"
    }
}
```

#### 결제 거부했을 때의 응답

```json
{
    "type": "openNew",
    "code": 2001,
    "message": "The payment denied by user.",
    "data": {
        "paymentId": "0x6c16826fdbf4659b9fb69c016211875d2959a4a2a52ff3735e667b4f4c52d0f7",
        "purchaseId": "P000002",
        "amount": "10000000000000000000",
        "currency": "krw",
        "shopId": "0xe4d1c86a0c76478076028d440cf542ebf300e1d7a82f59a666ff5a2205d9836c",
        "account": "0x53801Bf69Cb9B6Ad205BAc9134766807551F26BC",
        "loyaltyType": 0,
        "paidPoint": "10000000000000000000",
        "paidToken": "0",
        "paidValue": "10000000000000000000",
        "feePoint": "500000000000000000",
        "feeToken": "0",
        "feeValue": "500000000000000000",
        "totalPoint": "10500000000000000000",
        "totalToken": "0",
        "totalValue": "10500000000000000000"
    }
}
```

#### 취소 성공했을 때의 응답

```json
{
    "type": "openCancel",
    "code": 0,
    "message": "The cancellation has been successfully completed.",
    "data": {
        "paymentId": "0x644a5568445869656a16b67ab82894bbe7fb40e984bc5bff90002aa40177292f",
        "purchaseId": "P000002",
        "amount": "10000000000000000000",
        "currency": "krw",
        "account": "0x53801Bf69Cb9B6Ad205BAc9134766807551F26BC",
        "shopId": "0x5b2eaa90dbb877356c28cf13fe9263b1e749abeb78f031a4b35fa63c7d30e5db",
        "loyaltyType": 0,
        "paidPoint": "10000000000000000000",
        "paidToken": "0",
        "paidValue": "10000000000000000000",
        "feePoint": "500000000000000000",
        "feeToken": "0",
        "feeValue": "500000000000000000",
        "totalPoint": "10500000000000000000",
        "totalToken": "0",
        "totalValue": "10500000000000000000",
        "balance": "1000000000000000000000"
    }
}
```

#### 취소 거부했을 때의 응답

```json
{
    "type": "openCancel",
    "code": 2001,
    "message": "The cancellation denied by user.",
    "data": {
        "paymentId": "0x50f8aaf014a40b93a1c8aa9c0f2ed5ff01f5c2ad646722b45f175bdbfc0d1846",
        "purchaseId": "P000002",
        "amount": "10000000000000000000",
        "currency": "krw",
        "shopId": "0xac4aa3ae5cd9a0f585274092db07b836681b6493453697a5fa6a4569e7e5f32d",
        "account": "0x53801Bf69Cb9B6Ad205BAc9134766807551F26BC",
        "loyaltyType": 0,
        "paidPoint": "10000000000000000000",
        "paidToken": "0",
        "paidValue": "10000000000000000000",
        "feePoint": "500000000000000000",
        "feeToken": "0",
        "feeValue": "500000000000000000",
        "totalPoint": "10500000000000000000",
        "totalToken": "0",
        "totalValue": "10500000000000000000"
    }
}
```

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

## 5. 모바일 앱을 위한 엔드포인트

### 5.1. 결제정보 요청

#### - HTTP Request

`GET /v1/payment/item`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| paymentId  | string | Yes  | 지불 아이디 |

#### - 결과

| 필드명          | 유형   | 필수 | 설명                                                                                                                         |
| --------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId       | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId      | string | Yes  | 구매 아이디                                                                                                                  |
| amount          | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency        | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId          | string | Yes  | 상점 아이디                                                                                                                  |
| account         | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType     | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint       | string | Yes  | 지불될(된) 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| paidToken       | string | Yes  | 지불될(된) 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| paidValue       | string | Yes  | 지불될(된) 포인트 또는 토큰의 currency 단위의 가치                                                                           |
| feePoint        | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                             |
| feeToken        | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                               |
| feeValue        | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint      | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                               |
| totalToken      | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                                 |
| totalValue      | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus   | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| createTimestamp | number | Yes  | 결제 접수 시간                                                                                                               |
| cancelTimestamp | number | Yes  | 취소 접수 시간                                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 5.2. 결제승인

첫번째 시퀀스 다이어그램의 5번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/create/confirm`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| paymentId  | string | Yes  | 지불 아이디 |
| signature  | string | Yes  | 구매 아이디 |

#### - 결과

| 필드명        | 유형   | 필수 | 설명                                                                                                                         |
| ------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId     | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId    | string | Yes  | 구매 아이디                                                                                                                  |
| amount        | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency      | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId        | string | Yes  | 상점 아이디                                                                                                                  |
| account       | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType   | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint     | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken     | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue     | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| feePoint      | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken      | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint    | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken    | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue    | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| txHash        | string | Yes  | 트랜잭션 해시                                                                                                                |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 5.3. 결제거부

두번째 시퀀스 다이어그램의 5번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/create/deny`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| paymentId  | string | Yes  | 지불 아이디 |
| signature  | string | Yes  | 구매 아이디 |

#### - 결과

| 필드명        | 유형   | 필수 | 설명                                                                                                                         |
| ------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId     | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId    | string | Yes  | 구매 아이디                                                                                                                  |
| amount        | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency      | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId        | string | Yes  | 상점 아이디                                                                                                                  |
| account       | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType   | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint     | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken     | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue     | string | Yes  | 지불될 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| feePoint      | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken      | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                               |
| totalPoint    | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken    | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue    | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                 |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 5.4. 취소승인

첫번째 시퀀스 다이어그램의 5번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/cancel/confirm`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| paymentId  | string | Yes  | 지불 아이디 |
| signature  | string | Yes  | 구매 아이디 |

#### - 결과

| 필드명        | 유형   | 필수 | 설명                                                                                                                        |
| ------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| paymentId     | string | Yes  | 지불 아이디                                                                                                                 |
| purchaseId    | string | Yes  | 구매 아이디                                                                                                                 |
| amount        | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                            |
| currency      | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                          |
| shopId        | string | Yes  | 상점 아이디                                                                                                                 |
| account       | string | Yes  | 월렛주소                                                                                                                    |
| loyaltyType   | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                  |
| paidPoint     | string | Yes  | 지불된 포인트, loyaltyType가 0일때 유효한 값이다                                                                            |
| paidToken     | string | Yes  | 지불된 토큰, loyaltyType가 1일때 유효한 값이다                                                                              |
| paidValue     | string | Yes  | 지불된 포인트 또는 토큰의 currency 단위의 가치                                                                              |
| feePoint      | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                            |
| feeToken      | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                              |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                              |
| totalPoint    | string | Yes  | 지불된 전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| totalToken    | string | Yes  | 지불된 전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| totalValue    | string | Yes  | 지불된 전체 포인트 또는 토큰의 currency 단위의 가치                                                                         |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ) |
| txHash        | string | Yes  | 트랜잭션 해시                                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---

### 5.5. 취소거부

두번째 시퀀스 다이어그램의 5번에서 사용된다.

#### - HTTP Request

`POST /v1/payment/cancel/deny`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| paymentId  | string | Yes  | 지불 아이디 |
| signature  | string | Yes  | 구매 아이디 |

#### - 결과

| 필드명        | 유형   | 필수 | 설명                                                                                                                        |
| ------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| paymentId     | string | Yes  | 지불 아이디                                                                                                                 |
| purchaseId    | string | Yes  | 구매 아이디                                                                                                                 |
| amount        | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                            |
| currency      | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                          |
| shopId        | string | Yes  | 상점 아이디                                                                                                                 |
| account       | string | Yes  | 월렛주소                                                                                                                    |
| loyaltyType   | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                  |
| paidPoint     | string | Yes  | 지불된 포인트, loyaltyType가 0일때 유효한 값이다                                                                            |
| paidToken     | string | Yes  | 지불된 토큰, loyaltyType가 1일때 유효한 값이다                                                                              |
| paidValue     | string | Yes  | 지불된 포인트 또는 토큰의 currency 단위의 가치                                                                              |
| feePoint      | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                            |
| feeToken      | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                              |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency 단위의 가치                                                                              |
| totalPoint    | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                              |
| totalToken    | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                                |
| totalValue    | string | Yes  | 전체 포인트 또는 토큰의 currency 단위의 가치                                                                                |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ) |

[상단으로 이동](#로열티를-사용한-결제-프로세스)

---
