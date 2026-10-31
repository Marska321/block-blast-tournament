# Blok Blaster by Playables

A Vite canvas game with local casual play, Supabase guest identities, server-replayed official scores, and manually reviewed adult WhatsApp prize claims. No paid messaging integration is used.

## Casual-only release

Casual gameplay puts the board and piece tray first, with a compact score/best row and a Game menu. Level goals remain visible. Mode switching, rankings, restart, wallpaper/styles, sound/appearance, announcements and accessible board controls are available from that menu. Portrait uses the tray below the board; landscape places it beside the board, fitting gameplay without page scrolling. Closing secondary dialogs restores focus to the visible menu button. Keyboard shortcuts still work on the canvas, and the menu can open the alternative board controls.

New browsers default to the Playables wallpaper preset. Cleared cells reveal a subdued version of the existing Playables artwork behind the board in either appearance. Saved wallpaper and reveal-mode choices are retained, including uploaded photos; selecting a different preset takes precedence over the default logo. The logo is included in the offline public-shell allowlist. `node --import tsx scripts/focus-browser-check.mjs` exercises this UI against a local app at port 5197.

The short public address is https://blokblaster.vercel.app, assigned to the existing production project. The original https://block-blast-tournament.vercel.app remains available. Browser-local progress and guest sessions are separate for each hostname; they do not automatically transfer. Both hostnames must be allowed by the configured Turnstile widget for guest signup.

Production uses `VITE_CASUAL_ONLY=true` and `PILOT_ENABLED=false`, with optional daily Classic rankings enabled. Local Classic and Levels run immediately without creating guest accounts or making game API requests. Tickets and prize entry remain disabled; players can choose the daily board and guest nickname entry separately. Local progress and records are retained. Set `VITE_WHATSAPP_CHANNEL_URL` to the optional public `https://whatsapp.com/channel/...` announcement link. The configured channel is **Playables**; links open WhatsApp for the player to choose Follow and enable notifications. The application collects no phone numbers for announcements and does not automatically follow, message, or verify anyone.

The two pilot security migrations and the daily Classic rankings migration have been applied to production. Legacy records remain stored privately and are not imported into the empty official tables. An ignored local pre-migration backup contains legacy data/access metadata; do not publish or upload it. Re-enabling official events is a separate release: use the production Supabase credentials, verify Auth/CAPTCHA settings, provide real event metadata, change the frontend/server flags together, and rehearse the matching production environment. Do not point production at staging or reuse its demo event.

`node scripts/casual-browser-check.mjs` verifies optional channel navigation, four casual runs without tickets, retained local records, Levels, mobile layout, and absence of Auth/API traffic. It also supports a hosted `CASUAL_APP_URL` for testing the exact release; private protection credentials stay in ignored local files.

Block skins are independent of the surrounding UI theme. New runs start with **3D Gem Bevel** and score milestones (1,000 / 2,500 / 5,000 / 8,000 / 12,000 / 16,000 / 20,000) randomly switch to a different original textured skin. This remains enabled in light and dark casual play. Theme toggles preserve the active skin, and a resumed run restores its cosmetic skin while reconstructing gameplay through replay. `node --import tsx scripts/skin-browser-check.mjs` checks legal milestone crossings, theme changes, reload preservation, and bevel reset for new runs.

## Announcements and browser notifications

The bell in the game, welcome screen and About panel open **Announcements & notifications**. Reading announcements never asks for notification permission or creates a guest account. Players explicitly choose **Enable notifications** and accept their browser prompt. They can turn alerts off in the same panel. iPhone/iPad users first add the game to their Home Screen (iOS/iPadOS 16.4+). Delivery depends on browser/device permissions and network availability; an open game is not required. Clearing browser storage can lose subscription management access; block notifications in device/browser settings to stop alerts in that case. The same worker also saves the public game shell for offline casual play, independently of notification consent.

## Offline casual play and promotion launch gates

The production build generates a content-versioned cache manifest in `dist/notifications-sw.js`. After one successful online visit, Classic and Levels can load and resume offline. The About panel confirms when the offline copy is ready. Installing to the Home Screen is optional but makes reopening easier. Browser storage eviction, private browsing restrictions or clearing site data can remove the copy; the first visit still needs a connection. Local progress remains in browser storage, not in the service-worker cache.

Only the root page, compiled game assets, local fonts and app icons are cached (about 866 KiB with rankings enabled). APIs, announcements, promotions, authentication, scores, claims and external resources are never cached. Daily rankings and announcements explain that a connection is required; offline casual scores are not retroactively ranked. An already-started ranked run retains the existing submission/retry rules and midnight deadline. `/playable/` and `/ar/` are not part of offline support.

New workers wait for existing game tabs to close before activation. Existing players with the previous notification-only worker may need to close all game tabs and reopen online once before offline play becomes ready. Failed downloads must leave the old working release available. Online navigations use the network; only a failed connection falls back to the cached shell. HTTP access-control errors are preserved. A release is not ready for offline play until the complete shell installs. Build with `npm run build`, never only `vite build`, because `scripts/build-offline.mjs` is required. Keep this script in any deployment source allowlist. Keep the existing worker URL/scope to preserve push subscriptions.

Promotions are visibly **coming soon** and the entry tab is disabled while casual-only mode is enabled. The frontend defaults to casual-only if its flag is absent. Keep `VITE_CASUAL_ONLY=true` and `PILOT_ENABLED=false` for this launch. A notification announcement does **not** activate a prize event. Opening promotions requires a separate reviewed release with `VITE_CASUAL_ONLY=false`, `PILOT_ENABLED=true`, and an actual server event in `open` state within its start/end dates. Server checks still reject future/closed events even if someone bypasses the UI.

After a production-mode build, start `npm run preview -- --host 127.0.0.1 --port 5197`, then run `node scripts/offline-browser-check.mjs`. This verifies real worker installation, offline reload/resume, API exclusions, promotion state, mobile layout and public-bundle secret exclusion. `node scripts/offline-update-check.mjs` checks real worker updates and failed installs using a separate temporary local server with the production CSP.

The public feed and subscribe/unsubscribe operations share `/api/events?channel=updates`, preserving the existing 12-function hosting budget. The original prize events API retains its existing feature gate. Private subscriptions are capability-owned devices, separate from leaderboard identities: no player phone, name or Auth account is collected. Endpoint URLs and device encryption keys stay server-only; management tokens are random 256-bit values stored in the browser, with only their SHA-256 hash saved in the database. RLS and revoked grants deny all direct client access to the three new tables and four sending/subscription routines. Public reads return only currently published, unexpired news and the public application key. Writes validate origin, JSON, key shapes and vendor endpoint hosts and use the existing persistent rate limiter.

Setup:

1. Apply `supabase/migrations/20261026165252_player_updates.sql` to staging and verify there before production. The existing pilot migration supplies `pilot_rate_limit`; notifications do not require `PILOT_ENABLED` or ranked play.
2. Run `npm run push:keys` once. It writes an ignored `.env.push.local` containing the application keys, cron secret and public origin settings; it refuses to overwrite an existing file. Back up the keys securely. Rotating the application key requires players to subscribe again.
3. Set the variables from that file in the correct hosting project/environment: `UPDATES_ENABLED`, `UPDATES_ORIGINS`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, `CRON_SECRET`. Private key and cron secret must be server Secrets, never `VITE_` variables. Keep staging keys, credentials and origins separate from production. `UPDATES_ORIGINS` is a comma-separated list of exact origins, without trailing slashes. Include the exact candidate origin for candidate subscription testing; remove temporary candidate origins after release.
4. Build and stage the production target, verify the exact candidate, then promote it. Verify permission opt-in and a notification on a real Android device and an installed iPhone Home Screen app before describing physical-device delivery as tested.

The operator tool is local and uses server credentials; there is no public publishing API. `npm run updates` loads `.env.local` and `.env.push.local`. For staging, call Node with explicit staging env files so production is never selected accidentally. `list` prints only news and a subscriber count; it never prints subscription URLs, keys or tokens.

The 2026-10-26 production release is live at https://blokblaster.vercel.app. The ignored `.env.push.local` also contains the production operator database URL/service credential so its later env-file load overrides this workspace’s staging `.env.local`; the read-only operator `list` command was verified against production. Keep this private file out of deployments and source control. Staging uses its separate `.env.push.staging.local`. Vercel's verified system-provided `VERCEL_URL` is accepted for exact-candidate testing; caller-supplied Host headers never grant origin access.

Create a JSON file with `title` (1–80 characters), `message` (1–240), optional `path` (game-relative, default `/?updates=1`), optional `publish_at` and `expires_at` (ISO timestamps with timezone). Default publication is now and expiry is seven days later; maximum lifetime is 30 days. Example:

```json
{
  "title": "Something new to play.",
  "message": "Our next promotion starts Friday. Open Blok Blaster for the details.",
  "path": "/?updates=1",
  "publish_at": "2026-10-30T10:00:00+02:00",
  "expires_at": "2026-11-02T18:00:00+02:00"
}
```

```powershell
npm run updates -- draft announcement.json  # save a reviewable draft; no broadcast
npm run updates -- list
npm run updates -- publish ANNOUNCEMENT_UUID --send  # publish due news and dispatch due notifications
npm run updates -- publish ANNOUNCEMENT_UUID --schedule
npm run updates -- dispatch  # resume due deliveries/retries
npm run updates -- cancel ANNOUNCEMENT_UUID
```

Scheduled news appears in the feed at `publish_at`. The Hobby-compatible Vercel cron invokes the authenticated dispatcher once daily at `0 8 * * *` UTC, approximately **10–11am SAST** because Hobby cron runs within the chosen hour. Due scheduled notifications go out at the next daily window, not at an exact minute. For a timely launch, use `--send` at launch time; minute-level automation requires a separately configured scheduler/plan. A missing or incorrect `CRON_SECRET` always rejects dispatch. The operator must explicitly publish a draft; no default announcement or automatic marketing broadcast is seeded.

The sender leases batches, records outcomes and limits attempts to three with a 15-minute minimum retry delay. Concurrent calls cannot claim the same active lease. A process crash after vendor acceptance can cause a retry; notification tags use the announcement ID to collapse repeats where supported. It sends at most 200 recipients per invocation within a 40-second budget; use `dispatch` again for a backlog. Provider 404/410 removes the expired subscription and its pending deliveries. Other failures stay recorded; after configuration is corrected, invoke dispatch after the retry delay. Notifications have a maximum 24-hour transport TTL, capped by promotion expiry. Cancellation hides news and prevents unclaimed delivery, but cannot recall an accepted/in-flight notification. No automatic data-retention purge is configured; use server-only maintenance for expired announcements and stale devices under your retention policy.

Verification: `npm test`, `npm run build`, `npm run test:updates:browser`. The browser check uses permission/subscription fixtures and activates the real worker separately; it is not proof of cloud delivery to a physical device. Reports and inspected mobile screenshots are in `output/review/updates-browser.json` and `output/playwright/updates/`.

For the actual API → Supabase staging flow, use `node --env-file=.env.staging.local --import tsx scripts/staging-updates-check.mjs` with the local Playwright browser path configured. It starts a local HTTP API backed by the explicitly guarded staging project, verifies persisted subscription ownership, queue delivery/idempotency, unsubscribe and anonymous denials, then removes its temporary announcements/device. Its push transport is isolated: it encrypts the payload but never sends it to a vendor or player. Report: `output/review/updates-staging.json`.

## Optional daily Classic rankings

Live boards with fewer than 50 real daily participants show six named **House** challenger targets alongside genuine scores, sorted by score with real players winning ties. These browser-only targets have a star instead of a player rank, disappear at 50 participants, and never appear in closed-day results or exported standings cards. They do not create accounts/runs or affect genuine player counts, ranks or streaks.

The free daily Classic board, guest nicknames, daily streaks, and downloadable PNG results cards were released to production on 2026-10-21 after staging verification and operator approval. Production uses `VITE_CLASSIC_RANKED_ENABLED=true` (browser), `CLASSIC_RANKED_ENABLED=true` (server), `VITE_CASUAL_ONLY=true`, `PILOT_ENABLED=false` and `CLASSIC_DEMO=false`. Staging uses `CLASSIC_DEMO=true` so its board and exported cards are clearly labelled TEST. Production uses its own Supabase project/keys and the configured Turnstile hostname; no staging scores are imported.

Apply `supabase/migrations/20261021131346_classic_daily_rankings.sql` after the earlier pilot migrations. `supabase/classic.sql` is the matching reference snapshot for this feature. It introduces separate `classic_profiles`, `classic_runs` and `classic_daily_best` tables, all with RLS and no client table/RPC privileges. Only server operations may issue seeds, accept replays, update best scores or derive streaks. The public API exposes ranks, nicknames, scores and a current-player marker; it never returns player IDs, private contacts, or replays.

- Joining is optional and uses a nickname with Supabase guest Auth/CAPTCHA. First-time local Classic and Levels do not initialize Auth or make ranking requests. Unranked local scores cannot be retroactively submitted to the daily board.
- Ranked sessions are issued by `POST /api/classic` with `{operation:"start",requestId,nickname}`. No tickets, age/prize checks, referral rewards, or paid integrations are involved. Start retries reuse the same session and seed. Server request limits apply.
- Daily boards close at midnight in `Africa/Johannesburg`. Sessions expire at that boundary; offline/lost submissions reaching the server after closing cannot enter that board. A previously accepted replay returns its identical receipt on retry even after midnight. Local progress is preserved.
- Submission uses `{operation:"submit",sessionId,actions}`. The server verifies ownership and reconstructs Classic from the issued seed. It accepts one free revive and rejects a second. At the first natural game-over, choose the rescue or **Finish & save daily score**; after the rescue or a manual finish, the result saves automatically. Saving/accepted/retry-needed/rejected states persist for recovery.
- `GET /api/classic?day=YYYY-MM-DD` returns the top 20 and the authenticated player's standing even outside the top 20. Today and the previous 30 days are available. One best score per account ranks by score descending, server acceptance time ascending, then run ID. Equal later runs do not replace the earlier best. Scores and profiles are separate from prize events and local personal records.
- A finished accepted ranked game worth at least 100 points qualifies that day for the streak. Yesterday's streak remains active until today's deadline; a missed day resets the current streak and retains the longest. Badges at 3/7/14/30 days are cosmetic and grant no extra ranked attempts or revives. Guest access remains tied to this browser; clearing storage can lose access.
- Results cards show the best score and top five, with a date and SAST boundary. Open-day exports are clearly marked **LIVE SNAPSHOT — NOT FINAL**; previous-day exports are final. Anyone viewing the public board can download a card. Operators post it to the Playables WhatsApp Channel manually; the app never sends messages or schedules posts.

Verification commands:

```powershell
node --import tsx scripts/classic-browser-check.mjs
node --env-file=.env.staging.local --import tsx scripts/staging-classic-check.mjs
node --env-file=.env.staging.local --import tsx scripts/staging-classic-browser.mjs
```

The local browser check runs real PostgreSQL routines and route logic with isolated Auth/CAPTCHA fixtures. Hosted checks require the explicit guarded staging URL and Vercel CLI path, create temporary admin-issued test accounts, and delete their data afterward. The hosted browser check also requires an ignored host-scoped `CLASSIC_COOKIE_JAR`. Browser download verification may require execution outside a restricted filesystem sandbox. Admin-issued test sessions do not test human CAPTCHA solving; the operator should rehearse first-time guest entry on the configured staging hostname before the production feature is enabled.

The board is account-based. Replay validation checks legal actions, not distinct people or human play. The original security/operations rollout items, including manual screen-reader/real-mobile inspection, retention policy and abuse monitoring, remain separate work. Do not advertise this feature as fraud-proof or award prizes from this casual board.

## Local development

Use Node 22.12+ (Node 24 recommended).

```powershell
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` serves the game only. Without a configured backend, Classic and Levels work, but official play and live standings report unavailable. To exercise Vercel functions locally, use `npx vercel dev` against a staging Supabase project, with the environment below.

For browser integration tests:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'node_modules/.cache/ms-playwright'
npx playwright install chromium
npm run test:browser
```

The browser suite starts an isolated Vite server on port 5190 and intercepts Auth/API traffic with fixtures. It does not contact Supabase, WhatsApp, or a payout service. Screenshots and results are written under `output/playwright/`. SQL tests execute the actual schema and RPCs on PGlite's PostgreSQL engine, including role/grant/RLS assertions. Concurrent promise tests check idempotency; hosted PostgreSQL concurrency still requires staging verification.

`node test-verification.mjs` is a compatibility entry point for the new behavioral tests. The old review probes under `output/review/` describe the pre-repair code and are historical evidence, not the current test suite.

## Staging setup and activation

1. Create or select a **staging** Supabase project, separate from production. Local links and credentials are ignored by Git. Keep `PILOT_ENABLED=false` while preparing it.
2. Apply all versioned files in `supabase/migrations/` in order using the Supabase migration workflow. The initial migration creates fresh `pilot_*` tables and revokes legacy client grants/policies; it does **not** migrate old profiles or scores into official results. The follow-up migration permits rejecting duplicate-contact claims while retaining the duplicate-approval block. `supabase/schema.sql` is the final reference snapshot. Back up an existing project before applying migrations.
3. Enable anonymous sign-ins in Supabase Auth. Enable Cloudflare Turnstile CAPTCHA protection there and configure its secret in the Supabase dashboard. Restrict Turnstile to staging/production hostnames. Configure Auth rate limits. Enabling anonymous Auth alone is insufficient.
4. Configure the public URL/key and Turnstile site key from `.env.example`. Keep `SUPABASE_SERVICE_ROLE_KEY` server/operator-only; never prefix it with `VITE_`. Use separate staging and production projects and keys.
5. Optionally apply `supabase/seed.sql` **only to staging/local**. It creates a clearly labelled demo event with no real prizes and no fake player standings. Production starts with no official events.
6. Set `PILOT_ENABLED=true` in staging, then deploy a staging preview. Test guest creation using the real CAPTCHA, authenticated APIs, a real legal replay, retries, simultaneous requests, and private-data denial with anon and authenticated keys. Run Supabase's database advisors. Anonymous users carry the authenticated role, so ownership checks must remain enabled.
7. Rehearse claim review using staging data and an explicitly configured operator WhatsApp destination. The application never sends the message automatically.
8. Only after staging checks pass, apply the same migrations to production, deploy the matching application, configure the production environment, and enable production official play. Do not seed demo results into production. Coordinate schema/app rollout with official play disabled; roll back by disabling `PILOT_ENABLED`, not by restoring permissive legacy policies.

No hosted migration or deployment is performed by `npm run build` or the tests. The API returns 503 instead of mock results if official configuration is absent or disabled.

The build also emits the server TypeScript into a temporary ignored directory and imports every API with plain Node. This catches ESM module paths that a TypeScript-only runner accepts but hosted Node cannot load. Backend/shared imports use `.js` specifiers and NodeNext resolution.

### Current staging verification

The isolated test site is `https://block-blast-tournament-staging.vercel.app`, backed by Supabase project `okjfileghngpcegdwdud`. The original app and Supabase project `ivtbxaoflwuzkfbgtedh` remain production targets. Always specify the staging project explicitly in Vercel commands: the workspace's original Vercel link still points to production.

The current Vercel CLI initializes a new project's first deployment as Production even when Preview is requested. This is why the test site has its own Vercel project. Subsequent Preview deployments use only staging credentials; the stable staging hostname can be aliased to a verified preview. Never change shared production/preview credentials using `vercel env update --environment preview`: the CLI updates all environments covered by the selected variable.

`scripts/staging-check.mjs` exercises real hosted APIs and PostgreSQL transactions using temporary admin-created test accounts. It verifies ownership/grants, simultaneous starts and submissions, replay calculation, referral idempotency, shared cup tickets, separate rankings, expiry, and blocked claim approval. It removes its temporary accounts/events and writes a sanitized report to `output/review/staging-check.json`. Guards prevent it from targeting the production database. It requires an ignored `.env.staging.local`, `STAGING_APP_URL` set to the exact staging preview URL, and `VERCEL_CLI_PATH` pointing to the authenticated, trusted Vercel CLI's JavaScript entry point:

```powershell
node --env-file=.env.staging.local --import tsx scripts/staging-check.mjs
```

`scripts/staging-claims-check.mjs` uses the same guarded environment and invocation pattern to exercise a temporary, clearly labelled no-payout claim event. It checks hash-only storage, code rotation/expiry, adult/result review requirements, the interactive operator command, private status responses, one-time approval, and duplicate-contact approval/rejection behavior. It removes its test users, claims, and event and writes a sanitized report to `output/review/staging-claims-check.json`. It never opens WhatsApp, sends messages, or pays anyone.

These admin-created sessions do not validate the real guest CAPTCHA. On 2026-10-21 the operator separately completed real guest CAPTCHA/accepted gameplay, created a pending claim in the no-payout rehearsal event, manually sent/received its WhatsApp message, and saved an explicit rejection through the local operator command. Database verification confirms the reviewed rejection; the player confirmed the flow worked. This validates the human claim workflow without approving a real prize or making a payment. Actual adult eligibility and result review remain required for every real prize approval. Production activation and real event configuration remain separate rollout steps.

Supabase's advisor warns that the three ownership policies allow anonymous authenticated accounts; this is intentional for the guest model. Hosted tests confirm those accounts can read only their own profile, wallet, and progress. Its leaked-password warning concerns password login, which the application does not offer. Keep reviewing advisor output for unexpected new findings.

References: [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha), [RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Event administration

Events are provisioned by a trusted operator through SQL, not the score API. Each daily/weekly occurrence needs a new ID, explicit timestamps, prize metadata, and a prize-slot count. Use UTC timestamps; daily ticket resets use `Africa/Johannesburg` regardless of the device clock.

Create draft records first, review their details, then set `state='open'` when ready. Event eligibility always checks the actual timestamps, even when the display state has not yet been changed to closed. Setting an event back to draft disables claims. Never alter closed-event prize rules or scores while claims are under review.

Example staging event:

```sql
INSERT INTO public.pilot_events
  (cup_id,title,prize_pool,prize_tiers,prize_slots,starts_at,ends_at,state,is_demo)
VALUES
  ('staging_weekly','Staging weekly cup','No real prizes','[]',3,
   now(),now()+interval '7 days','open',true);
```

For a real event, the operator must provide and review the actual opening/closing times, prize tiers, prize-slot count, and territory/eligibility rules before setting `is_demo=false`. Do not use a client-side sponsor preview as the source of prize rules.

## Game sound and praise

Game effects use an original, self-contained Web Audio instrument: rounded wooden placement notes, consonant line-clear chords, an all-clear phrase, and a gentle descending game-over cue. There are no third-party audio requests. The mute preference survives reloads; muting cuts off active effects and any playing voice. Praise uses the self-hosted Fredoka font, with points below the phrase and a still version for reduced motion. These changes do not affect engine rules, pieces, scores, or skin milestones.

Praise rotates through a shuffled bag of “Nice!”, “Great!”, “Lekker!”, “Duidelik!”, “Aweh!”, “Amazing!” and “Brilliant!”, with each word appearing once per bag and no consecutive repeats. All-clears prefer “Perfect!”. Praise randomness is cosmetic and separate from the deterministic game engine.

**Spoken clips are pending at the owner's request.** No generated speech is bundled or enabled yet. `src/praiseVoices.json` deliberately has an empty `clips` object; the optional player does not request nonexistent files or use browser speech synthesis. To enable later, add reviewed, commercially licensed recordings to `public/audio/praise/` and map IDs (`nice`, `great`, `lekker`, `duidelik`, `aweh`, `amazing`, `brilliant`, `perfect`) to paths such as `/audio/praise/lekker.mp3`. Keep each file under 1 MB and 2.5 seconds. Ordinary single clears show praise without speech. Larger clears/combos use the matching phrase; voices never overlap, have a minimum three-second interval, and gently duck the effects. Missing clips leave the text and sound effects working.

Voice direction for later: one warm, playful voice, short natural English callouts and an authentic Afrikaans “Lekker!”, lightly excited rather than shouted. Review pronunciation and commercial-use rights before adding the assets. Generation is a one-time asset-production step, not an API call during gameplay; no provider key belongs in the browser.

Run `node --import tsx scripts/audio-browser-check.mjs` to render every effect through a real browser's offline audio context and exercise legal clear/combination feedback, mute persistence, and narrow reduced-motion rendering. The script writes an effect-only audition to `output/audio/blok-blaster-sound-preview.wav` and screenshots under `output/playwright/audio/`.

## Manual prize review

Set `TOURNAMENT_WHATSAPP_NUMBER` to the **operator's destination** in international digits without `+` or spaces. Leave it empty to disable claim requests. Sending authentication codes is not part of this flow.

After an event ends, eligible adults have 48 hours to request and send a claim. A claim code expires after 30 minutes. Requesting a fresh code invalidates the old one. The database stores only its hash. The user must click the WhatsApp link and send the message themselves; the claim stays pending.

Operators use server credentials in an untracked `.env.local` or their terminal environment:

```powershell
npm run claims -- inspect
npm run claims -- review
```

The review command prompts for the claim reference, code received in WhatsApp, sender number, private payout name, adult/result review confirmations, decision, and reason. Enter sender numbers with `+` and the country code; replace a South African number's initial `0` with `+27`. Formatting spaces, hyphens, and parentheses are removed before storage. Invalid numbers are explained and prompted again before submitting. It checks the claim window, eligibility, replacement/expiry of codes, duplicate-number approvals, and one-time review. Do not put contact information in the reason: that text is visible to the claimant. Credentials and sensitive inputs are not accepted as command-line flags or included in application request logs.

Confirm the sender is the person you are communicating with, review adult eligibility and suspicious play/multiple-account activity, and approve or reject explicitly. Do not store identity-document images in this application. Approved claim details remain private. Payments are a separate manual operation; this tool never transfers money.

## Game and data behavior

Classic allows one free, ad-free rescue per run after naturally running out of space. It replaces the tray with helper pieces and preserves the board and score. The replay records the revive, so refreshing does not grant another. Ending a run manually does not offer a rescue. Levels retain their single rescue; official tournament runs do not allow revives. Up to two additional promotional revives are a future feature and are not enabled or simulated. Pending rescue offers and continued runs can resume within the existing 48-hour window.

The canvas cell cursor appears for keyboard play and disappears on pointer input or when focus leaves the game controls. Pointer play does not retain a yellow outline on the first cell.

- Official sessions are authenticated and server-owned. Session creation consumes a ticket transactionally and is idempotent by player/request ID. Requests must wait for their issued seed before dealing pieces.
- The shared versioned engine reconstructs every placement, adaptive deal, clear, special multiplier, and score. A replay cannot create its own official player, score, seed, or event. Very long runs are bounded to 10,000 replay actions and a 1 MiB submission payload.
- Three base tickets plus at most two referral bonuses are available per account/day, shared across cups. Referral attribution must precede the referred account's first accepted game; a qualifying accepted score of at least 100 credits the referrer once. Bonus tickets expire at the daily reset.
- Standings contain one best accepted result per player/event. Ties use acceptance time, then the stable run ID. Accepted standings remain provisional until winner review.
- Official resume uses the same session, seed, engine version, and action log for at most 48 hours, capped by event close. Server deadlines decide acceptance; the device clock cannot extend them.
- A failed result remains on the device for retry. A new official attempt is blocked while an earlier score still needs saving. Retrying a score never consumes another ticket.
- Existing local level progress, personal wallpapers, and legacy unranked best scores remain local. Old local progress is not silently promoted into global verified stars. Newly completed levels queue replay validation; global progression requires prior levels to have accepted replays. Replay earlier levels to establish global progress when migrating from legacy local saves.
- Global adventure progress has a maximum of 180 stars. Offline play remains available; syncing for the first time may require the guest-account CAPTCHA.
- Clearing browser storage can lose guest identity and claim access. There is no automatic recovery or proof of one unique human per guest account.

## Operations

Request logs contain operation names, status/error codes, and durations; they exclude request bodies, bearer tokens, names, phone numbers, and claim codes. Review counts of rejected replays, rate-limited requests, storage failures, accepted submissions, and claim outcomes before growing the pilot. Operator decisions are also recorded in private claim rows.

Run dependency audit, behavioral tests, build/type checks, and browser tests before deployment. Inspect screenshots for small mobile and landscape layouts. Keep the service-role key out of build artifacts. Regularly remove expired rows from `pilot_rate_limits` using an operator job, and set data-retention rules for completed claims appropriate to the actual promotion.

Guest accounts, legal replay validation, CAPTCHA, and rate limits reduce abuse; they do not prove a unique person or prevent all automated play. Keep prizes and participation limited enough for meaningful manual winner review during the pilot.
