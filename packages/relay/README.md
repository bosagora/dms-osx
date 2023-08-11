# Remote Wallet

## Installation

This code contains the ability to access specific accounts remotely.  
This allows balance checks and transfers of specific accounts to be performed remotely.

### Download source code

```bash
git clone https://github.com/bosagora/dms-osx.git
cd dms-osx
```

### Install NodeJS modules

```bash
yarn install
```

### Move sub package folders

```bash
cd dms-osx/packages/relay
```

### Set environment variables.

```bash
cp env/.env.sample env/.env
```

### Build

```bash
npm run build
```

### Run

In testnet

```bash
npm run start:testnet
```

In mainnet

```bash
npm run start:mainnet
```

## Testing

```bash
npm run build
npm test
```
