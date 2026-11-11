# LostChain local blockchain setup

The project now has two independent modes:

- **Prototype:** `npm run dev`, normally http://127.0.0.1:5173. Existing localStorage accounts, reports and history are preserved.
- **Local contracts:** `npm run local:start`, http://127.0.0.1:5174. Registration, profiles, items, claims, closure and handover status use your existing contracts on Hardhat chain **31337**. Email, photos, proof and meeting details use the local SQLite metadata API. This mode uses wallet signatures rather than email/password authentication.

No testnet, public RPC service, deployed public contracts, paid storage account or real funds are configured.

## What is already configured

`local:start` builds the contracts, starts a loopback Hardhat node if needed, deploys CampusIdentity and then LostItemRegistry if no valid local deployment exists, starts the local metadata service and starts the chain-mode frontend. It reuses an existing local deployment when its contract code remains present. Stopping the command stops the processes it started. An existing independently started Hardhat node is left running.

Deployment data and ABIs are generated in `blockchain/deployments/localhost.json`. No contract address editing or copying is needed. Both API and frontend read the generated manifest. The local SQLite database is `server/data/chain.sqlite`; it is distinct from the earlier inactive backend database. Each new deployment gets a separate metadata namespace, preventing data from a reset chain from being attached to unrelated new item IDs.

## Configuration you need to do

1. Use Node.js 24+ and install dependencies if this is a fresh checkout:

   ```sh
   npm install
   npm --prefix blockchain install
   ```

2. Start the local services from the LostChain folder and keep the terminal open:

   ```sh
   npm run local:start
   ```

3. Install MetaMask in a regular browser that supports the extension, such as Chrome or Firefox. Use a separate development wallet/profile. The Codex in-app browser may not provide an injected wallet.

4. Add the local network manually, or use **Switch wallet to local network** in LostChain:

   | Field | Value |
   | --- | --- |
   | Network name | LostChain Local |
   | RPC URL | http://127.0.0.1:8545 |
   | Chain ID | 31337 |
   | Currency symbol | ETH |
   | Block explorer | Leave blank |

5. Display three local development accounts in your own terminal:

   ```sh
   npm run chain:accounts
   ```

   Import these accounts into MetaMask using their displayed private keys. These are Hardhat's publicly known development accounts with local test ETH. **Never use them for real assets or send real funds to them.** No testnet faucet is needed. The helper refuses to print keys if the node does not use the standard Hardhat development accounts.

6. Open **http://127.0.0.1:5174/register** in that regular browser. Choose a test name, email and Student/Staff role; connect the first test account, sign the LostChain sign-in challenge, and confirm the registration transaction. Register the second wallet separately.

7. Report a Found item from the first wallet. Switch wallets in MetaMask and sign in with the second; submit a claim with optional photo proof. Switch back to accept it, arrange handover, then confirm each side from its respective wallet. The contract marks the item Returned only after both confirmations. Student and Staff have equal permissions.

Existing prototype accounts and reports are not automatically uploaded or converted to blockchain records. Register fresh test memberships in blockchain mode. The tested contracts do not accept campus emails or passwords; names and roles are on-chain, emails stay off-chain, and no password is required in wallet mode. The current contract cannot change an existing member's role; the chain-mode profile shows that role as read-only.

## Data visibility

- **On-chain and public:** membership name/role, reporter/claimant addresses, item title/category/description/location, claim status and confirmations. Anonymous mode only hides the name in the interface; public wallet records can still identify the reporter.
- **Off-chain, public in the application:** listing photos, lost/found date and reporter display preference.
- **Off-chain, authorized participants only:** ownership explanation, proof photo and meeting details. The claim's on-chain message contains only a salted hash commitment, not the private explanation/photo. Email is returned only to its signed-in wallet owner.
- **Off-chain sessions:** one-use, expiring wallet-signature challenges establish an HttpOnly, SameSite cookie. Signature replay, wrong-signature and foreign-origin requests are rejected. These endpoints run only on loopback in this local configuration.
- **Notifications:** reconstructed from contract events and scoped to the current member. Read state persists in SQLite. The frontend polls every five seconds and refreshes after its own confirmed transactions.

## Failures and retries

Transactions show wallet-confirmation/mining/confirmation feedback. Rejections and contract reverts show errors. Account/network changes clear the displayed session and require the new wallet to sign in. Missing wallet, wrong network, stopped node, absent deployment or metadata service errors show setup/retry messages.

Photos are checked against the 2 MB limit and browser storage is reserved before photo-bearing writes. If the chain transaction confirms but metadata cannot reach the API, it stays queued under the deployment and wallet in browser localStorage. Use **Retry data sync**; this retries only the off-chain upload, not the blockchain transaction. A short browser/network interruption during receipt handling should always be checked against chain state before resubmitting a transaction.

Hardhat's node is ephemeral. Restarting it removes registrations, reports and claims. Restart `local:start` to generate a new deployment and register the test accounts again; clear stale transaction/nonce activity in the development wallet if needed. Old SQLite metadata is retained separately for each deployment and is not presented as new chain data. Do not run `chain:deploy` on an existing active deployment unless you intentionally want a fresh set of contracts.

## Commands and verification

```sh
npm test                    # local prototype domain tests
npm run chain:typecheck     # includes the local deployment script
npm run chain:test          # both contract suites
npm run test:integration    # run while local Hardhat is running and deployed
npm run build               # prototype build
npm run build:chain         # chain-mode build
npm run preview:chain       # preview that build after stopping dev:chain
```

Integration tests use temporary metadata databases, local unlocked test signers, and EVM snapshots/reverts. They cover membership, claim lifecycle, private proof access and commitment validation, read notifications, closure, profile edits, signature replay, origin checks and metadata-upload retries without duplicate transactions. There are 34 frontend tests, 26 contract tests and 5 integrated tests. Browser wallet confirmation still needs manual verification with your configured MetaMask accounts.

Alternative separate terminals: `npm run chain:node`, `npm run chain:deploy` once, `npm run metadata:dev`, `npm run dev:chain`. The defaults are 8545 (RPC), 3002 (metadata API), and 5174 (frontend). When changing the frontend origin set `APP_ORIGIN` for the metadata service. API configuration uses exported environment variables, not automatic `.env` loading. `CHAIN_DATABASE_PATH` and `CHAIN_API_PORT` configure its database and listening port; the Vite proxy must match if the API port changes.

## Before any public deployment

This is a complete **local integration**, not a production security review. Email verification, production HTTPS/session settings, robust rate limiting/shared RPC/indexing, off-chain storage/backups and contract review need to be planned before testnet/public release. The existing contract rejects competing claims by iterating through all pending claims; review gas growth under large claim volumes before public use. No public deployment is included in this setup.

### Re-running local:start

The startup command checks the metadata API and frontend before launching them. Healthy LostChain instances on ports 3002/5174 are reused, so running the command again does not create duplicate services or reset the deployment. If all services already exist, the command prints their URLs and exits normally; keep the original owning terminals running. An unrelated or unresponsive service on either port produces a clear conflict message and is never killed automatically.

Public testnet preparation and remaining hosting work are documented in [DEPLOYMENT.md](DEPLOYMENT.md). No public network is connected yet.

Le nouveau mode Sepolia est décrit dans [SEPOLIA_SETUP.md](SEPOLIA_SETUP.md) ; le mode Hardhat reste inchangé.
