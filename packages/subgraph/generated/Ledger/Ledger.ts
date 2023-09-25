// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  ethereum,
  JSONValue,
  TypedMap,
  Entity,
  Bytes,
  Address,
  BigInt
} from "@graphprotocol/graph-ts";

export class Deposited extends ethereum.Event {
  get params(): Deposited__Params {
    return new Deposited__Params(this);
  }
}

export class Deposited__Params {
  _event: Deposited;

  constructor(event: Deposited) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get depositAmount(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balanceToken(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get account(): Address {
    return this._event.parameters[4].value.toAddress();
  }
}

export class ExchangedPointToToken extends ethereum.Event {
  get params(): ExchangedPointToToken__Params {
    return new ExchangedPointToToken__Params(this);
  }
}

export class ExchangedPointToToken__Params {
  _event: ExchangedPointToToken;

  constructor(event: ExchangedPointToToken) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get amountPoint(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get amountToken(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balancePoint(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get balanceToken(): BigInt {
    return this._event.parameters[4].value.toBigInt();
  }
}

export class ExchangedTokenToPoint extends ethereum.Event {
  get params(): ExchangedTokenToPoint__Params {
    return new ExchangedTokenToPoint__Params(this);
  }
}

export class ExchangedTokenToPoint__Params {
  _event: ExchangedTokenToPoint;

  constructor(event: ExchangedTokenToPoint) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get amountPoint(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get amountToken(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balancePoint(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get balanceToken(): BigInt {
    return this._event.parameters[4].value.toBigInt();
  }
}

export class PaidPoint extends ethereum.Event {
  get params(): PaidPoint__Params {
    return new PaidPoint__Params(this);
  }
}

export class PaidPoint__Params {
  _event: PaidPoint;

  constructor(event: PaidPoint) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get paidAmountPoint(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balancePoint(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get purchaseId(): string {
    return this._event.parameters[4].value.toString();
  }

  get shopId(): string {
    return this._event.parameters[5].value.toString();
  }
}

export class PaidToken extends ethereum.Event {
  get params(): PaidToken__Params {
    return new PaidToken__Params(this);
  }
}

export class PaidToken__Params {
  _event: PaidToken;

  constructor(event: PaidToken) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get paidAmountToken(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balanceToken(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get purchaseId(): string {
    return this._event.parameters[4].value.toString();
  }

  get shopId(): string {
    return this._event.parameters[5].value.toString();
  }
}

export class ProvidedPoint extends ethereum.Event {
  get params(): ProvidedPoint__Params {
    return new ProvidedPoint__Params(this);
  }
}

export class ProvidedPoint__Params {
  _event: ProvidedPoint;

  constructor(event: ProvidedPoint) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get providedAmountPoint(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balancePoint(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get purchaseId(): string {
    return this._event.parameters[4].value.toString();
  }

  get shopId(): string {
    return this._event.parameters[5].value.toString();
  }
}

export class ProvidedPointToShop extends ethereum.Event {
  get params(): ProvidedPointToShop__Params {
    return new ProvidedPointToShop__Params(this);
  }
}

export class ProvidedPointToShop__Params {
  _event: ProvidedPointToShop;

  constructor(event: ProvidedPointToShop) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get providedAmountPoint(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balancePoint(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get purchaseId(): string {
    return this._event.parameters[4].value.toString();
  }

  get shopId(): string {
    return this._event.parameters[5].value.toString();
  }
}

export class ProvidedToken extends ethereum.Event {
  get params(): ProvidedToken__Params {
    return new ProvidedToken__Params(this);
  }
}

export class ProvidedToken__Params {
  _event: ProvidedToken;

  constructor(event: ProvidedToken) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get providedAmountToken(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balanceToken(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get purchaseId(): string {
    return this._event.parameters[4].value.toString();
  }

  get shopId(): string {
    return this._event.parameters[5].value.toString();
  }
}

export class SavedPurchase extends ethereum.Event {
  get params(): SavedPurchase__Params {
    return new SavedPurchase__Params(this);
  }
}

export class SavedPurchase__Params {
  _event: SavedPurchase;

  constructor(event: SavedPurchase) {
    this._event = event;
  }

  get purchaseId(): string {
    return this._event.parameters[0].value.toString();
  }

  get timestamp(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get amount(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get email(): Bytes {
    return this._event.parameters[3].value.toBytes();
  }

  get shopId(): string {
    return this._event.parameters[4].value.toString();
  }

  get method(): BigInt {
    return this._event.parameters[5].value.toBigInt();
  }
}

export class Withdrawn extends ethereum.Event {
  get params(): Withdrawn__Params {
    return new Withdrawn__Params(this);
  }
}

export class Withdrawn__Params {
  _event: Withdrawn;

  constructor(event: Withdrawn) {
    this._event = event;
  }

  get email(): Bytes {
    return this._event.parameters[0].value.toBytes();
  }

  get withdrawAmount(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get balanceToken(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get account(): Address {
    return this._event.parameters[4].value.toAddress();
  }
}

export class Ledger__purchaseOfResultValue0Struct extends ethereum.Tuple {
  get purchaseId(): string {
    return this[0].toString();
  }

  get timestamp(): BigInt {
    return this[1].toBigInt();
  }

  get amount(): BigInt {
    return this[2].toBigInt();
  }

  get email(): Bytes {
    return this[3].toBytes();
  }

  get shopId(): string {
    return this[4].toString();
  }

  get method(): BigInt {
    return this[5].toBigInt();
  }
}

export class Ledger extends ethereum.SmartContract {
  static bind(address: Address): Ledger {
    return new Ledger("Ledger", address);
  }

  NULL(): Bytes {
    let result = super.call("NULL", "NULL():(bytes32)", []);

    return result[0].toBytes();
  }

  try_NULL(): ethereum.CallResult<Bytes> {
    let result = super.tryCall("NULL", "NULL():(bytes32)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBytes());
  }

  foundationAccount(): Bytes {
    let result = super.call(
      "foundationAccount",
      "foundationAccount():(bytes32)",
      []
    );

    return result[0].toBytes();
  }

  try_foundationAccount(): ethereum.CallResult<Bytes> {
    let result = super.tryCall(
      "foundationAccount",
      "foundationAccount():(bytes32)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBytes());
  }

  linkCollectionAddress(): Address {
    let result = super.call(
      "linkCollectionAddress",
      "linkCollectionAddress():(address)",
      []
    );

    return result[0].toAddress();
  }

  try_linkCollectionAddress(): ethereum.CallResult<Address> {
    let result = super.tryCall(
      "linkCollectionAddress",
      "linkCollectionAddress():(address)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  nonceOf(_account: Address): BigInt {
    let result = super.call("nonceOf", "nonceOf(address):(uint256)", [
      ethereum.Value.fromAddress(_account)
    ]);

    return result[0].toBigInt();
  }

  try_nonceOf(_account: Address): ethereum.CallResult<BigInt> {
    let result = super.tryCall("nonceOf", "nonceOf(address):(uint256)", [
      ethereum.Value.fromAddress(_account)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  pointBalanceOf(_hash: Bytes): BigInt {
    let result = super.call(
      "pointBalanceOf",
      "pointBalanceOf(bytes32):(uint256)",
      [ethereum.Value.fromFixedBytes(_hash)]
    );

    return result[0].toBigInt();
  }

  try_pointBalanceOf(_hash: Bytes): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "pointBalanceOf",
      "pointBalanceOf(bytes32):(uint256)",
      [ethereum.Value.fromFixedBytes(_hash)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  purchaseIdOf(_idx: BigInt): string {
    let result = super.call("purchaseIdOf", "purchaseIdOf(uint256):(string)", [
      ethereum.Value.fromUnsignedBigInt(_idx)
    ]);

    return result[0].toString();
  }

  try_purchaseIdOf(_idx: BigInt): ethereum.CallResult<string> {
    let result = super.tryCall(
      "purchaseIdOf",
      "purchaseIdOf(uint256):(string)",
      [ethereum.Value.fromUnsignedBigInt(_idx)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toString());
  }

  purchaseOf(_purchaseId: string): Ledger__purchaseOfResultValue0Struct {
    let result = super.call(
      "purchaseOf",
      "purchaseOf(string):((string,uint256,uint256,bytes32,string,uint32))",
      [ethereum.Value.fromString(_purchaseId)]
    );

    return changetype<Ledger__purchaseOfResultValue0Struct>(
      result[0].toTuple()
    );
  }

  try_purchaseOf(
    _purchaseId: string
  ): ethereum.CallResult<Ledger__purchaseOfResultValue0Struct> {
    let result = super.tryCall(
      "purchaseOf",
      "purchaseOf(string):((string,uint256,uint256,bytes32,string,uint32))",
      [ethereum.Value.fromString(_purchaseId)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(
      changetype<Ledger__purchaseOfResultValue0Struct>(value[0].toTuple())
    );
  }

  purchasesLength(): BigInt {
    let result = super.call(
      "purchasesLength",
      "purchasesLength():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_purchasesLength(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "purchasesLength",
      "purchasesLength():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  shopCollectionAddress(): Address {
    let result = super.call(
      "shopCollectionAddress",
      "shopCollectionAddress():(address)",
      []
    );

    return result[0].toAddress();
  }

  try_shopCollectionAddress(): ethereum.CallResult<Address> {
    let result = super.tryCall(
      "shopCollectionAddress",
      "shopCollectionAddress():(address)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  tokenAddress(): Address {
    let result = super.call("tokenAddress", "tokenAddress():(address)", []);

    return result[0].toAddress();
  }

  try_tokenAddress(): ethereum.CallResult<Address> {
    let result = super.tryCall("tokenAddress", "tokenAddress():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  tokenBalanceOf(_hash: Bytes): BigInt {
    let result = super.call(
      "tokenBalanceOf",
      "tokenBalanceOf(bytes32):(uint256)",
      [ethereum.Value.fromFixedBytes(_hash)]
    );

    return result[0].toBigInt();
  }

  try_tokenBalanceOf(_hash: Bytes): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "tokenBalanceOf",
      "tokenBalanceOf(bytes32):(uint256)",
      [ethereum.Value.fromFixedBytes(_hash)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  tokenPriceAddress(): Address {
    let result = super.call(
      "tokenPriceAddress",
      "tokenPriceAddress():(address)",
      []
    );

    return result[0].toAddress();
  }

  try_tokenPriceAddress(): ethereum.CallResult<Address> {
    let result = super.tryCall(
      "tokenPriceAddress",
      "tokenPriceAddress():(address)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  validatorAddress(): Address {
    let result = super.call(
      "validatorAddress",
      "validatorAddress():(address)",
      []
    );

    return result[0].toAddress();
  }

  try_validatorAddress(): ethereum.CallResult<Address> {
    let result = super.tryCall(
      "validatorAddress",
      "validatorAddress():(address)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }
}

export class ConstructorCall extends ethereum.Call {
  get inputs(): ConstructorCall__Inputs {
    return new ConstructorCall__Inputs(this);
  }

  get outputs(): ConstructorCall__Outputs {
    return new ConstructorCall__Outputs(this);
  }
}

export class ConstructorCall__Inputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }

  get _foundationAccount(): Bytes {
    return this._call.inputValues[0].value.toBytes();
  }

  get _tokenAddress(): Address {
    return this._call.inputValues[1].value.toAddress();
  }

  get _validatorAddress(): Address {
    return this._call.inputValues[2].value.toAddress();
  }

  get _linkCollectionAddress(): Address {
    return this._call.inputValues[3].value.toAddress();
  }

  get _tokenPriceAddress(): Address {
    return this._call.inputValues[4].value.toAddress();
  }

  get _shopCollectionAddress(): Address {
    return this._call.inputValues[5].value.toAddress();
  }
}

export class ConstructorCall__Outputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }
}

export class DepositCall extends ethereum.Call {
  get inputs(): DepositCall__Inputs {
    return new DepositCall__Inputs(this);
  }

  get outputs(): DepositCall__Outputs {
    return new DepositCall__Outputs(this);
  }
}

export class DepositCall__Inputs {
  _call: DepositCall;

  constructor(call: DepositCall) {
    this._call = call;
  }

  get _amount(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class DepositCall__Outputs {
  _call: DepositCall;

  constructor(call: DepositCall) {
    this._call = call;
  }
}

export class ExchangePointToTokenCall extends ethereum.Call {
  get inputs(): ExchangePointToTokenCall__Inputs {
    return new ExchangePointToTokenCall__Inputs(this);
  }

  get outputs(): ExchangePointToTokenCall__Outputs {
    return new ExchangePointToTokenCall__Outputs(this);
  }
}

export class ExchangePointToTokenCall__Inputs {
  _call: ExchangePointToTokenCall;

  constructor(call: ExchangePointToTokenCall) {
    this._call = call;
  }

  get _email(): Bytes {
    return this._call.inputValues[0].value.toBytes();
  }

  get _amountPoint(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get _signer(): Address {
    return this._call.inputValues[2].value.toAddress();
  }

  get _signature(): Bytes {
    return this._call.inputValues[3].value.toBytes();
  }
}

export class ExchangePointToTokenCall__Outputs {
  _call: ExchangePointToTokenCall;

  constructor(call: ExchangePointToTokenCall) {
    this._call = call;
  }
}

export class ExchangeTokenToPointCall extends ethereum.Call {
  get inputs(): ExchangeTokenToPointCall__Inputs {
    return new ExchangeTokenToPointCall__Inputs(this);
  }

  get outputs(): ExchangeTokenToPointCall__Outputs {
    return new ExchangeTokenToPointCall__Outputs(this);
  }
}

export class ExchangeTokenToPointCall__Inputs {
  _call: ExchangeTokenToPointCall;

  constructor(call: ExchangeTokenToPointCall) {
    this._call = call;
  }

  get _email(): Bytes {
    return this._call.inputValues[0].value.toBytes();
  }

  get _amountToken(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get _signer(): Address {
    return this._call.inputValues[2].value.toAddress();
  }

  get _signature(): Bytes {
    return this._call.inputValues[3].value.toBytes();
  }
}

export class ExchangeTokenToPointCall__Outputs {
  _call: ExchangeTokenToPointCall;

  constructor(call: ExchangeTokenToPointCall) {
    this._call = call;
  }
}

export class PayPointCall extends ethereum.Call {
  get inputs(): PayPointCall__Inputs {
    return new PayPointCall__Inputs(this);
  }

  get outputs(): PayPointCall__Outputs {
    return new PayPointCall__Outputs(this);
  }
}

export class PayPointCall__Inputs {
  _call: PayPointCall;

  constructor(call: PayPointCall) {
    this._call = call;
  }

  get _purchaseId(): string {
    return this._call.inputValues[0].value.toString();
  }

  get _amount(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get _email(): Bytes {
    return this._call.inputValues[2].value.toBytes();
  }

  get _shopId(): string {
    return this._call.inputValues[3].value.toString();
  }

  get _signer(): Address {
    return this._call.inputValues[4].value.toAddress();
  }

  get _signature(): Bytes {
    return this._call.inputValues[5].value.toBytes();
  }
}

export class PayPointCall__Outputs {
  _call: PayPointCall;

  constructor(call: PayPointCall) {
    this._call = call;
  }
}

export class PayTokenCall extends ethereum.Call {
  get inputs(): PayTokenCall__Inputs {
    return new PayTokenCall__Inputs(this);
  }

  get outputs(): PayTokenCall__Outputs {
    return new PayTokenCall__Outputs(this);
  }
}

export class PayTokenCall__Inputs {
  _call: PayTokenCall;

  constructor(call: PayTokenCall) {
    this._call = call;
  }

  get _purchaseId(): string {
    return this._call.inputValues[0].value.toString();
  }

  get _amount(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get _email(): Bytes {
    return this._call.inputValues[2].value.toBytes();
  }

  get _shopId(): string {
    return this._call.inputValues[3].value.toString();
  }

  get _signer(): Address {
    return this._call.inputValues[4].value.toAddress();
  }

  get _signature(): Bytes {
    return this._call.inputValues[5].value.toBytes();
  }
}

export class PayTokenCall__Outputs {
  _call: PayTokenCall;

  constructor(call: PayTokenCall) {
    this._call = call;
  }
}

export class SavePurchaseCall extends ethereum.Call {
  get inputs(): SavePurchaseCall__Inputs {
    return new SavePurchaseCall__Inputs(this);
  }

  get outputs(): SavePurchaseCall__Outputs {
    return new SavePurchaseCall__Outputs(this);
  }
}

export class SavePurchaseCall__Inputs {
  _call: SavePurchaseCall;

  constructor(call: SavePurchaseCall) {
    this._call = call;
  }

  get _purchaseId(): string {
    return this._call.inputValues[0].value.toString();
  }

  get _timestamp(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get _amount(): BigInt {
    return this._call.inputValues[2].value.toBigInt();
  }

  get _email(): Bytes {
    return this._call.inputValues[3].value.toBytes();
  }

  get _shopId(): string {
    return this._call.inputValues[4].value.toString();
  }

  get _method(): BigInt {
    return this._call.inputValues[5].value.toBigInt();
  }
}

export class SavePurchaseCall__Outputs {
  _call: SavePurchaseCall;

  constructor(call: SavePurchaseCall) {
    this._call = call;
  }
}

export class WithdrawCall extends ethereum.Call {
  get inputs(): WithdrawCall__Inputs {
    return new WithdrawCall__Inputs(this);
  }

  get outputs(): WithdrawCall__Outputs {
    return new WithdrawCall__Outputs(this);
  }
}

export class WithdrawCall__Inputs {
  _call: WithdrawCall;

  constructor(call: WithdrawCall) {
    this._call = call;
  }

  get _amount(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class WithdrawCall__Outputs {
  _call: WithdrawCall;

  constructor(call: WithdrawCall) {
    this._call = call;
  }
}
