require('./crypto-polyfill.js');

require('dotenv').config();
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');
const { LitNodeClientNodeJs } = require('@lit-protocol/lit-node-client-nodejs');
const { ethers } = require('ethers');
const Encryption = require('@lit-protocol/encryption');
const { createSiweMessage, LitAccessControlConditionResource } = require('@lit-protocol/auth-helpers');
const { LitAbility } = require('@lit-protocol/constants');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function initializeIrysClient() {
  const rpcUrl = 'https://rpc.ankr.com/eth';
  const privKey = process.env.PRIVATE_KEY;
  if (!privKey || typeof privKey !== 'string') {
    throw new Error('Missing PRIVATE_KEY in .env');
  }
  const normalizedKey = privKey.startsWith('0x') ? privKey : `0x${privKey}`;

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(normalizedKey, provider);

  const irysUploader = await Uploader(Ethereum)
    .withWallet(normalizedKey)
    .withRpc(rpcUrl);

  return { irysUploader, wallet };
}

async function getLitNodeClient() {
  let litNodeClient = new LitNodeClientNodeJs({ litNetwork: 'datil-test' });
  try {
    await litNodeClient.connect();
    return litNodeClient;
  } catch (err) {
    console.warn('[Lit] Failed to connect to datil-test, retrying on cayenne...', err?.message || err);
    litNodeClient = new LitNodeClientNodeJs({ litNetwork: 'cayenne' });
    await litNodeClient.connect();
    return litNodeClient;
  }
}

async function encryptData(data, wallet) {
  const litNodeClient = await getLitNodeClient();

  const unifiedAccessControlConditions = [
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: 'eth_getBalance',
      parameters: [':userAddress', 'latest'],
      returnValueTest: {
        comparator: '>=',
        value: '0'
      }
    }
  ];

  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: 'ethereum',
    resourceAbilityRequests: [
      {
        resource: new LitAccessControlConditionResource('*'),
        ability: LitAbility.AccessControlConditionDecryption,
      },
    ],
    authNeededCallback: async ({ uri, expiration }) => {
      const siweMessage = await createSiweMessage({
        domain: 'localhost',
        walletAddress: wallet.address,
        statement: 'Authorize with Lit Protocol',
        uri,
        version: '1',
        chainId: 1,
        expiration,
      });
      const sig = await wallet.signMessage(siweMessage);
      return {
        sig,
        derivedVia: 'web3',
        signedMessage: siweMessage,
        address: wallet.address,
      };
    },
  });

  const encryptedJson = await Encryption.encryptToJson({
    string: data,
    unifiedAccessControlConditions,
    chain: 'ethereum',
    sessionSigs,
    litNodeClient,
  });

  return encryptedJson;
}

async function uploadData() {
  const { irysUploader, wallet } = await initializeIrysClient();

  const data = JSON.stringify({
    message: 'hirys!',
    timestamp: new Date().toISOString(),
  });

  const encryptedData = await encryptData(data, wallet);
  
  const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}.json`);
  await fs.promises.writeFile(tempFilePath, JSON.stringify(encryptedData));
  
  try {
    const result = await irysUploader.uploadFile(tempFilePath, {
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'Lit-Protocol-Uploader' },
        { name: 'App-Version', value: '1.0.0' }
      ]
    });
    
    await fs.promises.unlink(tempFilePath);
    return result;
  } catch (error) {
    try {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    } catch (e) {}
    throw error;
  }
}

uploadData()
  .then(result => {
    const id = result?.id || result?.data?.id || result?.data?.transactionId;
    if (id) {
      const irysGateway = `https://gateway.irys.xyz/${id}`;
      console.log('Data successfully uploaded to Irys');
      console.log('ID:', id);
      console.log('Irys Gateway:', irysGateway);
    } else {
      console.error('Upload failed, no ID returned');
    }
  })
  .catch(console.error);
