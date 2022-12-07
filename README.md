# NEAR Key Management Tool

This command line tool helps you add new keys to your NEAR account and carefully delete keys as you wish.

# Getting Started

## Install VSC extensions:

- https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode
- https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint
- https://marketplace.visualstudio.com/items?itemName=fabiospampinato.vscode-highlight (optional)

```bash
yarn install
cp .env.example .env # (optional)
yarn start
```

## 🛑 Before you use this tool...

You might want to practice on accounts that you don't care about. Consider creating new accounts that you don't mind losing access to. Follow these examples:

https://docs.near.org/tools/near-cli#near-create-account

```bash
near create-account sub-acct.example-acct.testnet --masterAccount example-acct.testnet
near create-account ls.ryancwalsh.testnet --masterAccount ryancwalsh.testnet
cp ~/.near-credentials/testnet/unimportantsubacctexample.ryancwalsh.testnet.json ~/.near-credentials/testnet/unimportantsubacctexample.ryancwalsh.testnet.backup.json
ls ~/.near-credentials/testnet/

```

# Note

Installing the 'highlight' extension mentioned above is recommended so that console logging is more prominent in index.ts. You will want to be careful never to display any sensitive information witihout warning the user that the information is sensitive (and that they should delete their logs as necessary).

# TODO

1. Figure out whether the `addKey` docs in `node_modules/near-api-js/lib/account.d.ts` are correct when they say `The method names on the contract that should be allowed to be called. Pass null for no method names and '' or [] for any method names.`. https://near.github.io/near-api-js/classes/account.Account/#addkey does not mention 'null for no method names', and neither does https://docs.near.org/concepts/basics/accounts/access-keys. https://github.com/near/near-api-js/issues/1040
1. Search this repo for "TODO". There are likely more tasks to finish and clean up than are listed here.
1. Use near-seed-phrase to confirm that the user knows a seed phrase of a full access key other than the one being deleted. Allow this safety feature to be disabled via environment variable.
1. Support Ledger.
1. Add tests.
1. Improve eslint.
1. Add colors to text in console.
