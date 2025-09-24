# Encrypt & Upload with Lit + Irys

This project demonstrates how to **encrypt data with Lit Protocol** and **store it on Irys**.  
It also shows how to **decrypt data** if access control conditions are satisfied.

---

## 1. Installation
```bash
npm install dotenv @irys/upload @irys/upload-ethereum ethers \
  @lit-protocol/lit-node-client-nodejs @lit-protocol/encryption \
  @lit-protocol/auth-helpers @lit-protocol/constants @peculiar/webcrypto
```

---

## 2. Setup .env
Create a `.env` file in the root:
```
PRIVATE_KEY=0xyourEthereumPrivateKey
LIT_NODE_URL=https://datil-dev.litprotocol.com
```

---


## 3. Crypto Polyfill (`crypto-polyfill.js`)
```js
const { webcrypto } = require('node:crypto');
if (webcrypto) {
  globalThis.crypto = webcrypto;
} else {
  const { Crypto } = require('@peculiar/webcrypto');
  globalThis.crypto = new Crypto();
}
```

---

## 4. Encrypt & Upload (`uploadData.js`)
```js
const encryptedJson = await Encryption.encryptToJson({
  string: data,
  unifiedAccessControlConditions,
  chain: 'ethereum',
  sessionSigs,
  litNodeClient,
});
const result = await irysUploader.uploadFile(tempFilePath, {
  tags: [{ name: 'Content-Type', value: 'application/json' }]
});
console.log("Irys Upload ID:", result.id);
```

---

## 5. Decrypt Data (`decryptData.js`)
```js
const decryptedString = await decryptFromJson({
  sessionSigs,
  litNodeClient,
  parsedJsonData: encryptedData
});
console.log("Decrypted:", decryptedString);
```

---

# Key Snippets with Explanations

### Wallet Init
```js
const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
```
 Initializes Ethereum wallet.

---

### Access Control
```js
const unifiedAccessControlConditions = [{
  conditionType: 'evmBasic',
  chain: 'ethereum',
  method: 'eth_getBalance',
  parameters: [':userAddress','latest'],
  returnValueTest: { comparator: '>=', value: '0' }
}];
```
 Restricts access only to addresses with ETH ≥ 0.

---

### Encryption
```js
const encryptedJson = await Encryption.encryptToJson({
  string: data,
  unifiedAccessControlConditions,
  sessionSigs,
  litNodeClient
});
```
 Encrypts string into JSON.

---

### Upload
```js
const result = await irysUploader.uploadFile(tempFilePath, {
  tags: [{ name: 'Content-Type', value: 'application/json' }]
});
```
 Uploads encrypted data to Irys.

---

### Decryption
```js
const decrypted = await decryptFromJson({
  sessionSigs,
  litNodeClient,
  parsedJsonData: encryptedData
});
```
 Decrypts data if Lit conditions are met.
