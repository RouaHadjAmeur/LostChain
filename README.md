# LostChain

Campus lost and found with two modes: the preserved browser prototype and a new local Hardhat integration.

## Local contract integration

Run `npm run local:start` and open http://127.0.0.1:5174. The script deploys both existing contracts locally and starts the wallet interface and SQLite metadata service. Follow [LOCAL_SETUP.md](LOCAL_SETUP.md) to configure MetaMask and import two funded local test accounts. No public network is configured.

The guide documents off-chain storage, privacy, account/network switching, notification polling, retry behavior and the integration tests.

## Prototype reference

The sections below describe the preserved localStorage prototype on port 5173. Blockchain mode uses the separate adapter and wallet registration described above.

## Run

```sh
npm install
npm run dev
```

Open the Vite URL (normally http://localhost:5173). `npm run build` produces `dist/`; `npm run preview` serves it. Production static hosting needs an index.html fallback for client-side routes.

`npm test` runs the frontend domain and persistence tests. `npm run dev:all` is a compatibility alias for the frontend alone. Earlier backend files under `server/` are retained as inactive historical work; the current frontend neither imports nor calls them. SQLite/server accounts are not copied automatically into this separate prototype.

## Accounts

Create your own account at `/register` with a name, campus email, password and Student/Staff role, then sign in at `/login`. There are no built-in account shortcuts or prefilled passwords. Both roles have identical permissions. To test a handover, register two accounts and switch between them with sign out/sign in.

Local registration/login is a simulation, not production authentication. Password verifiers use browser Web Crypto PBKDF2 with a random salt; all application state is still inspectable and editable in localStorage. Do not use real passwords or sensitive personal data in this prototype.

## Recovery workflow

1. Any signed-in member reports a found item.
2. Another member submits ownership details from Item Details.
3. The reporter receives a notification, with unread indicators in the sidebar and bell.
4. The reporter accepts or rejects the claim, after a confirmation dialog.
5. An accepted claim allows both participants to save a shared meeting location/time.
6. The claimant confirms receiving the object; the reporter separately confirms handing it over. Each action has a confirmation dialog.
7. Only when **both confirmations** are recorded does the claim become Completed and the item Returned. Either party may confirm first. One party cannot complete a handover, repeat its confirmation, or confirm on behalf of the other.

Only the item reporter can review requests for that item. No Admin role or Admin Dashboard exists. Only one claim may be accepted per item; new claims are blocked while its handover is arranged. Accepting one claim immediately rejects the other pending claims and notifies their claimants. Duplicate/self claims and actions by unrelated users are rejected. Rejected and cancelled requests stay visible in history. A claimant may cancel only their own Pending claim; the same member cannot resubmit a claim for that item. Reporters can close open Lost/Found reports, which cancels pending claims and notifies the claimants. Accepted handovers and Returned items cannot be closed.

## Persistence

Users, reports, uploaded photos, claims, arrangements, confirmation timestamps, notifications, activities, and the current session live together under the versioned key `lostchain-prototype-v1`. Refreshing preserves the session and partial/completed workflows. Browser storage events refresh other open tabs; tabs on the same origin share the active session. State is saved before the UI reports success. Full/unavailable browser storage produces a visible error without committing the change.

Unused legacy demo accounts are removed on upgrade. Accounts with existing reports or claims are retained to preserve their history and access. Accounts you registered yourself remain unchanged.

The original `lc-*` keys and server data are left untouched. Clear only the prototype storage key to reset the prototype. Photos support JPG/PNG/WebP up to 2 MB; browser storage capacity may limit the total photo collection. External example photos and fonts are optional network assets with system font/placeholder fallbacks.

## Pages

| Page | Route |
| --- | --- |
| Landing | `/` |
| Sign in / Register | `/login`, `/register` |
| Dashboard | `/dashboard` |
| Report Lost / Found | `/report/lost`, `/report/found` |
| Explore Items | `/explore` |
| Item Details | `/items/:id` |
| My Reports | `/my-reports` |
| My Claims | `/claims` |
| Received Claims | `/received-claims` |
| Profile | `/profile` |

`/auth` and `/connect-wallet` are legacy redirects to local sign-in. They do not connect a wallet. All personal routes prompt signed-out visitors to sign in. Public reports remain browsable. Filters include text, category, status, location and sort order; claims and personal reports have status filters.

## Architecture and future integration

- `src/services/prototype/repository.js`: local data adapter, validation, authentication simulation and persistence
- `src/services/prototype/workflow.js`: pure recovery transitions and participant permissions
- `src/services/prototype/passwords.js`: local credential verifier helpers
- `src/context/AppContext.jsx`: React state and action facade; pages depend on this interface
- `src/data/prototype.js`: empty initial application data
- `src/components`: shared navigation, cards, dialogs, notifications and access prompts
- `src/pages`: authentication, dashboard, claims, profile, discovery and report screens
- `tests/prototype.test.js`: user journeys, role parity, both confirmation orders, rejection, invalid actions, competing requests, persistence and storage errors

Future CampusIdentity.sol integration can replace membership operations (`register`, `login`, `updateProfile`, `snapshot`). Future LostItemRegistry.sol integration can replace item/claim operations (`createItem`, `createClaim`, `claimAction`, `closeItem`, `arrangeHandover`). Keep participant rules and page-facing return values consistent when replacing the adapter. The frontend does not import Hardhat, Ethers.js, Web3.js or MetaMask functionality. The separately tested contracts in `blockchain/` remain disconnected from this local prototype.

## User-created listings

Explore Items and the landing noticeboard display only reports submitted through the application. Fresh storage starts with no reports or claims. The version 2 migration removes the six old seeded listings and their linked claims/notifications while preserving user-created reports, account changes and the active session. Data remains local to this browser, persists after refresh, and updates other tabs on the same origin.

The landing community avatars and member count come from registered users in localStorage, excluding built-in demo accounts. Only initials and the total are exposed in the public community preview. New registrations and profile name changes update this preview automatically.

## Contract workflow parity

Schema version 3 normalizes older Accepted claims by rejecting their competing Pending claims while retaining handover confirmation timestamps. Cancel claim is available in My Claims for pending requests. Close item is available in Item Details to the reporter while no accepted handover exists. Both actions require confirmation dialogs. Closed items remain visible in Explore/My Reports and have a Closed filter; cancelled claims have a Cancelled filter. The existing two-party confirmation requirement is unchanged.

## New report alerts

Publishing a Lost or Found report creates a report notification for each other member currently registered in this browser. The reporter does not receive their own alert, and newly registered members are not notified about old reports. The Explore sidebar count and New card badges reflect unread report notifications for the current member. Explore includes a Mark all seen action; opening Item Details marks that report seen. Notification-bell links open the corresponding item. Mark all read clears both report and claim alerts, while Mark all seen in Explore clears only report alerts. Read status persists after refresh, and storage events update other tabs with a toast when new report alerts arrive for the same signed-in member. These remain local prototype alerts, not push/email notifications or cross-device delivery.

## Reporter visibility

Both report forms let the member choose Remain anonymous (default) or Show my name. Item Details displays Anonymous with a shortened member identifier, or the member’s name recorded when publishing the report. Older reports remain anonymous. The same display choice is used in new-report notifications and reporter-authored claim decisions, arrangements and handover updates. Internal ownership identifiers remain unchanged, so claims and permissions keep working. This is display privacy in a local prototype, not encrypted or backend-enforced anonymity.

## Claim photo evidence

The This might be mine claim dialog accepts an optional JPG/PNG/WebP ownership photo up to 2 MB alongside the required written ownership details. The form previews the selected image, supports removal/replacement, reports invalid/unreadable files, and waits for photo reading to finish before submission. Photos persist with claims in localStorage and are shown in Claim Details for the claimant and item reporter, not on public listings or in notification payloads. Browser storage errors leave the claim unsubmitted so it can be retried. Legacy claims without photos remain valid.

Internal claim, report and member identifiers are not displayed in the interface. They remain in storage and navigation URLs for linking and ownership. Only anonymous reporter labels show a shortened member identifier.

Notifications are shown as an unread inbox. Clicking an entry marks it read before navigation and removes it from the dropdown; counts update and stay cleared after refresh. Viewing My Claims or Received Claims marks notifications for the claims visible under the selected filter as read. Updates for filtered-out claims or unrelated reports remain unread. Read records stay in localStorage for history; marking one notification read never changes another member’s read state.
