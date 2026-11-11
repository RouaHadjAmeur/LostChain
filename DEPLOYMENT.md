# Mise à jour

Le support Sepolia et l’assistant de déploiement MetaMask sont implémentés.
Suivre [SEPOLIA_SETUP.md](SEPOLIA_SETUP.md), qui remplace les étapes de préparation
réseau ci-dessous. La publication de l’API/frontend et la recette publique restent
à réaliser. La liste suivante conserve le contexte de préparation initiale.

# LostChain: preparation for a public test demonstration

## Current release boundary

The prototype and local Hardhat integration work locally. No public deployment has
been performed. Adding Sepolia to Hardhat does not connect the application to it.
The local deployment script deliberately refuses networks other than 31337.

## Configuration to supply next

1. A separate testnet wallet created in MetaMask, with Sepolia test ETH. Do not use
   any of the publicly known Hardhat accounts. Keep its private key on your machine.
2. A Sepolia HTTPS RPC endpoint. The server will need its own private configuration;
   RPC credentials must not be included in a public deployment manifest.
3. An HTTPS application domain and a Node.js 24 hosting environment with persistent
   disk for SQLite and backups. A static frontend host alone cannot run the API.
4. A decision for photos: initially retain the existing API/SQLite attachments on
   persistent disk, or configure an object storage service. Claim proof photos must
   remain accessible only to the reporter and claimant.

The variable names are documented in `blockchain/.env.sepolia.example`.
Hardhat uses lazy `configVariable` lookups, so local commands do not require these
values. Environment files are not loaded automatically. Never place private keys
in `VITE_*` variables, source files, screenshots, or chat messages.

## Required implementation before publishing the application

- Parameterize chain ID, RPC, network name and explorer in the repository, API,
  provider and UI; these currently enforce local Hardhat intentionally.
- Add a Sepolia deployment command with chain checks, receipt handling and a saved
  manifest. Preserve local deployments separately. Record addresses, ABIs and the
  deployment block, without private RPC credentials.
- Configure the API's public binding behind an HTTPS reverse proxy, exact allowed
  origin, Secure session cookies, persistent database and backup/restore procedure.
- Replace full-history polling and per-request chain scans with incremental event
  indexing suitable for the selected RPC provider's range and rate limits.
- Configure frontend history fallback for routes and `/api/chain` reverse proxy;
  Vite's development proxy is not a production hosting configuration.
- Review contract gas growth when accepting a claim: rejection iterates over all
  pending claims. Choose a bound or another settlement design before broad use.
- Decide whether campus email verification is required. The current prototype
  permits Student/Staff selection and does not verify campus membership.

## Release checks

From the project root:

```sh
npm test
npm run chain:typecheck
npm run chain:test
npm run test:integration
npm run build
npm run build:chain
```

Integration tests require the existing local Hardhat node and deployment manifest.
Each fixture deploys its own contracts inside an EVM snapshot and reverts afterward,
so registered demonstration users do not make the tests fail. Do not submit manual
transactions during these tests: the snapshot revert would also undo them.

After implementation and configuration, deploy to Sepolia, then repeat registration,
reporting, private proof upload, acceptance/rejection, cancellation, closure and both
handover orders using separate wallets. Confirm persistence after refresh and API
restart. Publish only after these checks; local test success is not a security audit.

Hardhat configuration reference: https://hardhat.org/docs/reference/configuration
