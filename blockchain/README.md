# LostChain contract tests

Isolated Hardhat 3 project for the existing `CampusIdentity.sol` contract. It is not connected to the React frontend.

```sh
cd blockchain
npm install
npm run build
npm run typecheck
npm test
```

`build` generates the TypeChain bindings in `types/ethers-contracts`; `typecheck` builds before checking TypeScript so a clean checkout has those bindings available. The Mocha/Ethers toolbox is enabled in `hardhat.config.ts`, and Mocha globals are loaded through `tsconfig.json` and `@types/mocha`.

Tests use Hardhat's in-process simulated network and reuse the same connection for each deployment and its signers. No external network or deployed contract address is configured. Solidity compilation may download the compiler on the first build.

If VS Code retains old diagnostics after building, run **TypeScript: Restart TS Server** from the Command Palette.

## Recovery workflow coverage

`test/LostItemRegistry.ts` covers Lost-item claim rejection, duplicate claims, reporter-only rejection/closure, claimant-only pending cancellation, pending-count consistency, and registration requirements for claims and handover. Handover tests exercise both confirmation orders, inspect intermediate flags and statuses, reject repeated/outsider confirmations, and require both parties before Returned/Completed. They also check events and unchanged state after denied actions.

Current suite: 7 CampusIdentity tests and 19 LostItemRegistry tests (26 total). These are local behavioral tests, not a security audit or deployment guarantee.
