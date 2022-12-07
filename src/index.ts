// Run via `yarn start`.
// eslint-disable-next-line max-len
// Inspired by https://github.com/near/near-api-js/blob/f78616480ba84c73f681211fe6266bd2ed2b9da1/packages/cookbook/accounts/access-keys/create-full-access-key.js
// https://stackoverflow.com/questions/64598373/how-to-import-key-created-by-near-cli-into-near-wallet
// https://github.com/near/near-cli#near-add-key

import * as os from 'os';
import * as path from 'path';

import { ux } from '@cto.ai/sdk'; // https://cto.ai/blog/node-ux-prompts/
import type BN from 'bn.js';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { type KeyPair, keyStores, connect, type Account, utils } from 'near-api-js';
import { type KeyStore } from 'near-api-js/lib/key_stores';
import { type AccessKeyInfoView } from 'near-api-js/lib/providers/provider';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { generateSeedPhrase } from 'near-seed-phrase';

dotenv.config();

const homedir = os.homedir();

const DEFAULT_ACCOUNT = process.env.DEFAULT_ACCOUNT ?? 'example.testnet';
const NETWORK_ID = process.env.NETWORK_ID ?? '';

type AccountId = string;
type Secrets = {
  keyPair: KeyPair;
  seedPhrase: string;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromptResult = any; // TODO

const CREDENTIALS_DIR = '.near-credentials';
const curvePrefix = 'ed25519:'; // This prefix comes from https://github.com/near/near-seed-phrase/blob/3e08dc3e0f5d0122d8561a386de8fe69a7e39407/index.js#L19

const credentialsPath = path.join(homedir, CREDENTIALS_DIR);
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);
const FULL = 'generate new FULL access key';
const FUNC = 'generate new FUNCTION access key';
const DELETE = 'delete access key';

const ALL = 'ALL method names';
const SOME = 'SOME method names (specified in the next step)';
const NONE = 'NO method names will be allowed';

const DIVIDER = '\n----------------------------------------\n';

function getConfig(networkId: string): { keyStore: KeyStore; networkId: string; nodeUrl: string } {
  const config = {
    keyStore,
    networkId,
    nodeUrl: networkId === 'testnet' ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org',
  };
  return config;
}

async function getAccount(networkId: string, accountId: AccountId): Promise<Account> {
  const config = getConfig(networkId);
  const near = await connect(config);
  const account = await near.account(accountId);
  return account;
}

async function getAccessKeys(networkId: string, accountId: AccountId): Promise<AccessKeyInfoView[]> {
  const account = await getAccount(networkId, accountId);
  const keys = await account.getAccessKeys();
  console.log(`current keys on ${networkId} for ${accountId}:`, JSON.stringify(keys, null, 2), keys.length);
  return keys;
}

function removePrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function generateSecrets(): Secrets {
  const { seedPhrase, secretKey } = generateSeedPhrase();
  const secretKeyWithoutPrefix = removePrefix(secretKey, curvePrefix);
  const keyPair = new utils.key_pair.KeyPairEd25519(secretKeyWithoutPrefix);
  const secrets = { keyPair, seedPhrase };
  return secrets;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function saveKeyToLocalKeyStore(networkId: string, accountId: AccountId, keyPair: KeyPair): Promise<void> {
  // await keyStore.setKey(networkId, accountId, keyPair); // TODO Figure out how to append rather than overwrite the key saved to the CREDENTIALS_DIR.
}

async function generateNewFullAccessKeyForAccount(networkId: string, accountId: AccountId, keyPair: KeyPair): Promise<void> {
  const account = await getAccount(networkId, accountId);
  await account.addKey(keyPair.getPublicKey());
  await saveKeyToLocalKeyStore(networkId, accountId, keyPair);
}

/**
 * @see https://github.com/near/near-cli#near-add-key
 * @param networkId such as testnet or mainnet
 * @param accountId such as example.testnet
 * @param keyPair KeyPair
 * @param contractId contract this key will allow methods to be called on (optional), such as example.testnet
 * @param methodNames Optional. Pass '' or [] to allow methods of any name. Pass null for no method names.
 * @param amount Optional. Payment in yoctoⓃ that is sent to the contract during this function call. E.g. 2500000000000
 * @returns KeyPair
 */
async function generateNewFunctionAccessKeyForAccount(
  networkId: string,
  accountId: AccountId,
  keyPair: KeyPair,
  contractId?: string,
  methodNames?: string[] | string,
  amount?: BN,
): Promise<void> {
  const account = await getAccount(networkId, accountId);
  await account.addKey(keyPair.getPublicKey(), contractId, methodNames, amount);
  await saveKeyToLocalKeyStore(networkId, accountId, keyPair);
}

async function deleteAccessKeyFromAccount(networkId: string, accountId: AccountId, publicKey: string): Promise<void> {
  const account = await getAccount(networkId, accountId);
  // console.log('deleteAccessKeyFromAccount', { networkId, accountId, publicKey });
  const publicKeyWithoutPrefix = removePrefix(publicKey, curvePrefix);
  // console.log({ publicKeyWithoutPrefix });
  await account.deleteKey(publicKeyWithoutPrefix);
  console.log(`Deleted key ${publicKey} from ${accountId} on ${networkId}`);
  // TODO: Why did this show stale results? await getAccessKeys(networkId, accountId);
}

/**
 * Check: Would there still be another full access key remaining even after deleting whichever key was chosen?
 * Note that this still does not force the user to prove that they still *have* the seed phrase or secret key of a remaining full access key.
 * That extra safeguard could be a nice feature in the future.
 */
function hasAtLeastOneFullAccessKeyEvenIfDeletingThisKey(keys: AccessKeyInfoView[], publicKeyChosenToDelete: string): boolean {
  const fullAccessKeys = keys.filter((key) => key.access_key.permission === 'FullAccess');
  const chosenKey = keys.find((key) => key.public_key === publicKeyChosenToDelete);
  const accessLevelOfChosenKey = chosenKey?.access_key.permission;
  return fullAccessKeys.length > 1 || accessLevelOfChosenKey !== 'FullAccess';
}

async function considerDeletingOneOfTheKeys(networkId: string, accountId: AccountId, existingKeysToChooseFrom: AccessKeyInfoView[]): Promise<void> {
  const { publicKeyChosenToDelete } = (await ux.prompt({
    choices: existingKeysToChooseFrom.map((key) => key.public_key),
    message: 'Which key would you like to delete?',
    name: 'publicKeyChosenToDelete',
    type: 'list',
  })) as PromptResult;
  const hasSpareKey = hasAtLeastOneFullAccessKeyEvenIfDeletingThisKey(existingKeysToChooseFrom, publicKeyChosenToDelete);
  if (hasSpareKey) {
    console.error(`WARNING!!! Do not delete a key unless you are 100% confident that you possess other seed phrases or secret keys that still have access to this account.`);
    console.log('Go double-check now before you proceed!');
    const { hasConfirmedDeletion } = (await ux.prompt({
      default: false,
      message: `Are you SURE you want to delete key ${publicKeyChosenToDelete} from ${accountId} on ${networkId}?`,
      name: 'hasConfirmedDeletion',
      type: 'confirm',
    })) as PromptResult;

    if (hasConfirmedDeletion) {
      await deleteAccessKeyFromAccount(networkId, accountId, publicKeyChosenToDelete);
      return;
    }
  } else {
    console.error(
      'The NEAR Key Management Helper does not allow you to delete your only full access key. Please add a new full access key before deleting this one. (Or use another way of deleting the key.)',
    );
  }

  console.log('No keys were deleted.');
}

// eslint-disable-next-line max-lines-per-function
async function designFunctionAccessKey(networkId: string, accountId: AccountId, keyPair: KeyPair): Promise<void> {
  const { contractId } = (await ux.prompt({
    message: 'What is the NEAR account ID of the contract that this FUNCTION access key should work for? (Optional)',
    name: 'contractId',
    type: 'input',
  })) as PromptResult;
  const { methodNamesType } = (await ux.prompt({
    choices: [ALL, SOME, NONE],
    default: SOME,
    message: 'Would you like this key to work only for certain method names?',
    name: 'methodNamesType',
    type: 'list',
  })) as PromptResult;
  console.log({ methodNamesType });
  let methodNames = null;
  if (methodNamesType === ALL) {
    methodNames = [];
  } else if (methodNamesType === SOME) {
    const { methodNamesCsv } = (await ux.prompt({
      default: [],
      message: "Which methods? (Optional) (Comma-separated list of method names. Example: `mint,send`)(Pass '' to allow methods of any name. Pass null for no method names.)",
      name: 'methodNamesCsv',
      type: 'input',
    })) as PromptResult;
    methodNames = methodNamesCsv.split(',').map((methodName: string) => methodName.trim());
  }

  const { amount } = (await ux.prompt({
    message: 'Payment in yoctoⓃ that is sent to the contract during this function call. (Optional) E.g. 2500000000000',
    name: 'amount',
    type: 'input',
  })) as PromptResult;
  await generateNewFunctionAccessKeyForAccount(networkId, accountId, keyPair, contractId, methodNames, amount);
  await getAccessKeys(networkId, accountId);
}

async function chooseOneOfTheThreeKeyActions(networkId: string, accountId: AccountId, existingKeysToChooseFrom: AccessKeyInfoView[]): Promise<void> {
  const { action } = (await ux.prompt({
    choices: [FULL, FUNC, DELETE],
    default: 1,
    message: 'What would you like to do?',
    name: 'action',
    type: 'list',
  })) as PromptResult;
  console.log({ action });
  if (action === DELETE) {
    await considerDeletingOneOfTheKeys(networkId, accountId, existingKeysToChooseFrom);
  } else {
    const { seedPhrase, keyPair } = generateSecrets();
    console.log(`Your seedPhrase for ${networkId} account ${accountId} public key ${keyPair.getPublicKey()}:${DIVIDER}${seedPhrase}${DIVIDER}`);
    // TODO: Double-check (with a severe warning) that the user has saved the seed phrase before proceeding.
    if (action === FULL) {
      await generateNewFullAccessKeyForAccount(networkId, accountId, keyPair);
      await getAccessKeys(networkId, accountId);
    } else {
      await designFunctionAccessKey(networkId, accountId, keyPair);
    }
  }
}

async function main(): Promise<void> {
  let networkId = NETWORK_ID;
  if (!networkId) {
    const { isTestnet } = (await ux.prompt({
      message: 'Do you want to use testnet? (Default is `Yes`. Choose `No` for mainnet.)',
      name: 'isTestnet',
      type: 'confirm',
    })) as PromptResult;
    networkId = isTestnet ? 'testnet' : 'mainnet';
  }

  const { accountId } = (await ux.prompt({
    default: DEFAULT_ACCOUNT,
    message: 'Which accountId?',
    name: 'accountId',
    type: 'input',
  })) as PromptResult;

  const existingKeysToChooseFrom = await getAccessKeys(networkId, accountId);

  console.warn(
    'WARNING! Consider the security implications of displaying the seed phrase or secret key in the console logs here. After you are finished using this tool, you might want to carefully delete the logs from your computer.',
  );
  await chooseOneOfTheThreeKeyActions(networkId, accountId, existingKeysToChooseFrom);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().then(() => {
  console.log('Finished.');
});
