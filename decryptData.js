require('dotenv').config();
const { decryptFromJson } = require('@lit-protocol/encryption');
const { LitNodeClientNodeJs } = require('@lit-protocol/lit-node-client-nodejs');
const { ethers } = require('ethers');
const { createSiweMessage, LitAccessControlConditionResource } = require('@lit-protocol/auth-helpers');
const { LitAbility } = require('@lit-protocol/constants');

async function getLitNodeClient() {
  let litNodeClient;
  try {
    litNodeClient = new LitNodeClientNodeJs({ litNetwork: 'datil-test' });
    await litNodeClient.connect();
  } catch (err) {
    console.warn('[Lit] Failed to connect to datil-test, retrying on cayenne...', err?.message || err);
    litNodeClient = new LitNodeClientNodeJs({ litNetwork: 'cayenne' });
    await litNodeClient.connect();
  }
  
  await litNodeClient.connect();
  return litNodeClient;
}

async function decryptData(encryptedData, wallet) {
  const litNodeClient = await getLitNodeClient();
  
  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: 'ethereum',
    resourceAbilityRequests: [{
      resource: new LitAccessControlConditionResource('*'),
      ability: LitAbility.AccessControlConditionDecryption,
    }],
    authNeededCallback: async ({ uri, expiration }) => {
      const siweMessage = await createSiweMessage({
        domain: 'localhost',
        walletAddress: wallet.address,
        statement: 'Decrypt with Lit Protocol',
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

  console.log('Encrypted data structure:', JSON.stringify(encryptedData, null, 2));

  const decryptionParams = {
    sessionSigs,
    litNodeClient,
    parsedJsonData: {
      ...encryptedData,
      accessControlConditions: encryptedData.accessControlConditions || encryptedData.unifiedAccessControlConditions || [],
      unifiedAccessControlConditions: encryptedData.unifiedAccessControlConditions || encryptedData.accessControlConditions || [],
      chain: encryptedData.chain || 'ethereum',
      dataType: 'string',
      version: encryptedData.version || 'symmetricKey'
    }
  };

  console.log('Attempting decryption with params:', {
    hasCiphertext: !!decryptionParams.ciphertext,
    hasDataToEncryptHash: !!decryptionParams.dataToEncryptHash,
    hasAccessControlConditions: !!decryptionParams.unifiedAccessControlConditions,
    chain: decryptionParams.chain,
    dataType: decryptionParams.dataType || 'string'
  });

  const decryptedString = await decryptFromJson(decryptionParams);
  return decryptedString;
}

async function main() {
  try {
    console.log('Initializing decryption process...');
    
    const rpcUrls = [
      'https://rpc.ankr.com/eth',
      'https://eth.llamarpc.com',
      'https://ethereum.publicnode.com'
    ];
    
    let provider;
    let lastError;
    
    for (const url of rpcUrls) {
      try {
        console.log(`Trying RPC: ${url}`);
        provider = new ethers.providers.JsonRpcProvider(url, { 
          name: 'homestead',
          chainId: 1
        });
        await provider.getNetwork();
        console.log(`Connected to ${url}`);
        break;
      } catch (error) {
        console.warn(`Failed to connect to ${url}:`, error.message);
        lastError = error;
      }
    }
    
    if (!provider) {
      throw new Error(`Could not connect to any Ethereum RPC. Last error: ${lastError?.message}`);
    }
    
    const privKey = process.env.PRIVATE_KEY;
    if (!privKey || typeof privKey !== 'string') {
      throw new Error('Missing PRIVATE_KEY in .env');
    }
    const normalizedKey = privKey.startsWith('0x') ? privKey : `0x${privKey}`;
    
    const wallet = new ethers.Wallet(normalizedKey, provider);
    console.log(`Using wallet address: ${wallet.address}`);
    
    const encryptedData = JSON.parse(`{"PUT_YOUR_DATA_FROM_IRYS_GATEWAY_HERE"}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.utils.formatEther(balance)} ETH`);

    console.log('Starting decryption...');
    const decrypted = await decryptData(encryptedData, wallet);
    console.log('Decryption successful!');
    console.log('Decrypted data:', decrypted);
    
  } catch (error) {
    console.error('Decryption failed:', error);
  }
}

main().catch(console.error);
