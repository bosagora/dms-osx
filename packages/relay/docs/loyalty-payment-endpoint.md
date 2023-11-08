# 로열티를 사용한 결제 프로세스 - 엔드포인트 & 결제응답

-   [1. URL](#1-url)
-   [2. KIOSK 를 위한 엔드포인트](#2-kiosk-를-위한-엔드포인트)
    -   [2.1. 사용자의 로열티 잔고](#21-사용자의-로열티-잔고)
    -   [2.2. 지불에 사용될 예상 로열티 산출](#22-지불에-사용될-예상-로열티-산출)
    -   [2.3. 결제생성](#23-결제생성)
    -   [2.4. 결제취소](#24-결제취소)
    -   [2.5. 상점의 정보](#25-상점의-정보)
    -   [2.6. 상점의 인출 요청정보](#26-상점의-인출-요청정보)
-   [3. 결제의 응답](#3-KIOSK-의-콜백엔드포인트로-전달되는-데이터)
    -   [3.1 응답 데이터의 형태](#31-응답-데이터의-형태)
    -   [3.2 응답 데이터의 예시](#32-응답-데이터의-예시)
-   [4. 모바일 앱을 위한 엔드포인트](#4-모바일-앱을-위한-엔드포인트)
    -   [4.1 결제정보 요청](#41-결제정보-요청)
    -   [4.2 결제승인](#42-결제승인)
    -   [4.3 결제거부](#43-결제거부)
    -   [4.4 취소승인](#44-취소승인)
    -   [4.5 취소거부](#45-취소거부)
-

## 1. URL

-   메인넷: https://relay.kios.bosagora.org
-   테스트넷: https://relay.kios.testnet.bosagora.org
-   개발넷: https://relay.kios.devnet.bosagora.org

---

## 2. KIOSK 를 위한 엔드포인트

주의: 모든 금액은 소수점 18자리의 문자로 표현됩니다. 그리고 소수점은 포함하지 않습니다.

### 2.1. 사용자의 로열티 잔고

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

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 2.2. 지불에 사용될 예상 로열티 산출

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
| paidPoint   | string | Yes  | 지불될 포인트, loyaltyType가 0일때 유효한 값이다                 |
| paidToken   | string | Yes  | 지불될 토큰, loyaltyType가 1일때 유효한 값이다                   |
| paidValue   | string | Yes  | 지불될 포인트 또는 토큰의 currency단위의 가치                    |
| feePoint    | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                 |
| feeToken    | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                   |
| feeValue    | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                    |
| totalPoint  | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다                   |
| totalToken  | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다                     |
| totalValue  | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                      |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 2.3. 결제생성

#### - HTTP Request

`POST /v1/payment/create`

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

| 필드명          | 유형   | 필수 | 설명                                                                                                                         |
| --------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| paymentId       | string | Yes  | 지불 아이디                                                                                                                  |
| purchaseId      | string | Yes  | 구매 아이디                                                                                                                  |
| amount          | string | Yes  | 상품가격 (소수점이하 18자리로 표시된 문자, 소수점 포함하지 않음)                                                             |
| currency        | string | Yes  | 환률코드(usd, krw, the9, point...)                                                                                           |
| shopId          | string | Yes  | 상점 아이디                                                                                                                  |
| account         | string | Yes  | 월렛주소                                                                                                                     |
| loyaltyType     | int    | Yes  | 적립되는 로열티의 종류(0: Point, 1: Token)                                                                                   |
| paidPoint       | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken       | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue       | string | Yes  | 지불될 포인트 또는 토큰의 currency단위의 가치                                                                                |
| feePoint        | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken        | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue        | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint      | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken      | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue      | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                                  |
| paymentStatus   | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| createTimestamp | number | Yes  | 결제 접수 시간                                                                                                               |

#### - 기타

-   요청후 45초간 콜백엔드포인트로 응답이 없으면 타입아웃 처리 할 수 있다.

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 2.4. 결제취소

#### - HTTP Request

`POST /v1/payment/cancel`

#### - 입력 파라메타들

| 파라메타명 | 유형   | 필수 | 설명        |
| ---------- | ------ | ---- | ----------- |
| accessKey  | string | Yes  | 비밀키      |
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
| paidPoint       | string | Yes  | (예상)지불될 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| paidToken       | string | Yes  | (예상)지불될 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| paidValue       | string | Yes  | 지불될 포인트 또는 토큰의 currency단위의 가치                                                                                |
| feePoint        | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken        | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue        | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint      | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken      | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue      | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                                  |
| paymentStatus   | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| createTimestamp | number | Yes  | 결제 접수 시간                                                                                                               |
| cancelTimestamp | number | Yes  | 취소 접수 시간                                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 2.5. 상점의 정보

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

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 2.6. 상점의 인출 요청정보

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

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

## 3. KIOSK 의 콜백엔드포인트로 전달되는 데이터

### 3.1 응답 데이터의 형태

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
| data    | paidValue   | string | Yes  | 지불될 포인트 또는 토큰의 currency단위의 가치                                                                             |
| data    | feePoint    | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)      |
| data    | feeToken    | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)        |
| data    | feeValue    | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                             |
| data    | totalPoint  | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)        |
| data    | totalToken  | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다(결제요청 성공시:지불된값, 결제요청 실패시:예상값, 취소시: 지불된값)          |
| data    | totalValue  | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                               |
| data    | balance     | string | No   | 잔고                                                                                                                      |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 3.2 응답 데이터의 예시

#### 결제 성공했을 때의 응답

```json
{
    "type": "create",
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
    "type": "create",
    "code": 1001,
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
    "type": "cancel",
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
    "type": "cancel",
    "code": 1001,
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

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

## 4. 모바일 앱을 위한 엔드포인트

### 4.1. 결제정보 요청

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
| paidValue       | string | Yes  | 지불될(된) 포인트 또는 토큰의 currency단위의 가치                                                                            |
| feePoint        | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                             |
| feeToken        | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                               |
| feeValue        | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint      | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                               |
| totalToken      | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                                 |
| totalValue      | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                                  |
| paymentStatus   | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| createTimestamp | number | Yes  | 결제 접수 시간                                                                                                               |
| cancelTimestamp | number | Yes  | 취소 접수 시간                                                                                                               |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 4.2. 결제승인

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
| paidValue     | string | Yes  | 지불될 포인트 또는 토큰의 currency단위의 가치                                                                                |
| feePoint      | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken      | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint    | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken    | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue    | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                                  |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| txHash        | string | Yes  | 트랜잭션 해시                                                                                                                |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 4.3. 결제거부

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
| paidValue     | string | Yes  | 지불될 포인트 또는 토큰의 currency단위의 가치                                                                                |
| feePoint      | string | Yes  | (예상)수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                       |
| feeToken      | string | Yes  | (예상)수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                         |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint    | string | Yes  | (예상)전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                         |
| totalToken    | string | Yes  | (예상)전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                           |
| totalValue    | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                                  |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 4.4. 취소승인

#### - HTTP Request

`POST /v1/payment/cancel/confirm`

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
| paidPoint     | string | Yes  | 지불된 포인트, loyaltyType가 0일때 유효한 값이다                                                                             |
| paidToken     | string | Yes  | 지불된 토큰, loyaltyType가 1일때 유효한 값이다                                                                               |
| paidValue     | string | Yes  | 지불된 포인트 또는 토큰의 currency단위의 가치                                                                                |
| feePoint      | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                             |
| feeToken      | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                               |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint    | string | Yes  | 지불된 전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                        |
| totalToken    | string | Yes  | 지불된 전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                          |
| totalValue    | string | Yes  | 지불된 전체 포인트 또는 토큰의 currency단위의 가치                                                                           |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |
| txHash        | string | Yes  | 트랜잭션 해시                                                                                                                |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---

### 4.5. 취소거부

#### - HTTP Request

`POST /v1/payment/cancel/deny`

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
| paidPoint     | string | Yes  | 지불된 포인트, loyaltyType가 0일때 유효한 값이다                                                                             |
| paidToken     | string | Yes  | 지불된 토큰, loyaltyType가 1일때 유효한 값이다                                                                               |
| paidValue     | string | Yes  | 지불된 포인트 또는 토큰의 currency단위의 가치                                                                                |
| feePoint      | string | Yes  | 수수료 포인트, loyaltyType가 0일때 유효한 값이다                                                                             |
| feeToken      | string | Yes  | 수수료 토큰, loyaltyType가 1일때 유효한 값이다                                                                               |
| feeValue      | string | Yes  | 수수료 포인트 또는 토큰의 currency단위의 가치                                                                                |
| totalPoint    | string | Yes  | 전체 포인트, loyaltyType가 0일때 유효한 값이다                                                                               |
| totalToken    | string | Yes  | 전체 토큰, loyaltyType가 1일때 유효한 값이다                                                                                 |
| totalValue    | string | Yes  | 전체 포인트 또는 토큰의 currency단위의 가치                                                                                  |
| paymentStatus | number | Yes  | 처리상태 (1: 결제접수, 2: 결제승인, 3: 결제거부, 4: 결제완료, 5: 취소접수, 6:취소승인, 7:취소거부, 8:취소완료, 9:타이아웃 ): |

[상단으로 이동](#로열티를-사용한-결제-프로세스---엔드포인트--결제응답)

---
