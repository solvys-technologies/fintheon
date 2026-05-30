# S86 Surface Parity Demo + User-Owned Experience Gate

## Surfaces

For S86, "all three surfaces" means:

- Desktop Electron
- Web/PWA in a desktop browser
- Mobile PWA

## User-Owned Invariants

- The same signed-in user lands in the same active desk context on all three
  surfaces.
- User-owned or desk-owned state is loaded from the cloud backend, not from a
  local machine-only backend, stale localStorage, demo constants, or an
  anonymous fallback.
- Standard customer runtime does not require `localhost:8080`, launchd, or
  Portless. Those remain developer/blocker paths only.
- Auth-scoped API calls carry the user's Supabase JWT where required.
- Desk role boundaries hold: members can read shared desk state, and manager or
  owner actions stay manager/owner gated.
- Network loss never makes the app pretend data is fresh. It must show a clear
  degraded/offline state, preserve safe last-known user/desk context where
  available, and recover without app restart.

## Testing Criteria

### Cloud Runtime

- Desktop starts with the local backend stopped and still reaches the configured
  cloud backend for ordinary workflows.
- Web and mobile use the same cloud backend contract as Desktop.
- No standard-user demo step requires Portless, `fintheon.test`, or launchd.

### Identity + Ownership

- The same test user signs in on Desktop, web, and mobile.
- Each surface shows the same user identity and active desk.
- A safe user-owned mutation made on one surface is visible on the other two
  after refresh or expected sync delay.
- A desk-owned read path, such as Desk Plan, DeskMap/NarrativeFlow, File Room,
  or Desk Inbox, resolves to the same desk-scoped cloud data on all three.

### Desk Parity

- Desktop can open the full Desk surface and show Desk Plan, RiskFlow/Signals,
  File Room or Inbox where available, and Chat/Hermes access.
- Web/PWA shows the corresponding Desk/Consilium paths that are not explicitly
  Electron-only.
- Mobile PWA shows the compact equivalent: Desk/Chat/Forum/RiskFlow or the
  current mobile shell equivalents, with the same user and desk context.
- Any feature missing from one surface must be labeled as intentionally
  surface-specific, not silently absent.

### Network Degradation

- With the cloud backend reachable, all three surfaces show healthy status.
- With the user's network disabled, Desktop does not crash or fall into an
  empty local-only state.
- Mobile/web show request failures as degraded/offline states, not infinite
  loading or blank panels.
- After network restoration, each surface resumes cloud-backed requests without
  requiring sign-out/sign-in.

### Evidence

- Capture one screenshot or short recording per surface for the same signed-in
  user and active desk.
- Capture cloud backend health and diagnostics output.
- Record the API base/source shown or logged by Desktop.
- Post validation evidence to `SOL-250` before moving S86 to Done.

## Demo Flow

1. **Preflight**
   - Stop or bypass the local backend.
   - Confirm `curl -fsS https://fintheon.fly.dev/healthz`.
   - Confirm the test user can sign in on all three surfaces.

2. **Desktop**
   - Launch Desktop with no local backend dependency.
   - Confirm the runtime API source is cloud.
   - Open Desk/Consilium.
   - Verify active user, active desk, Desk Plan, RiskFlow/Signals, and
     Chat/Hermes access.

3. **Web/PWA Desktop Browser**
   - Open the web/PWA target for the same branch/deploy.
   - Sign in as the same user.
   - Verify the same active desk and matching Desk/Consilium data.

4. **Mobile PWA**
   - Open the mobile PWA target.
   - Sign in as the same user.
   - Verify the compact Desk/Chat/Forum/RiskFlow equivalents use the same user
     and desk context.

5. **Ownership Mutation**
   - Make one safe user-owned change, such as a profile/display preference or
     other non-trading setting that already syncs through the backend.
   - Refresh the other two surfaces and confirm the change follows the user.
   - If a desk-owned test artifact is used instead, name it `S86 parity smoke`
     and clean it up or archive it after evidence capture.

6. **Cloud Hermes**
   - Send a short Harper/CAO message from one surface.
   - Confirm the request uses cloud backend/global Hermes status and does not
     depend on a local Hermes process.
   - Confirm any degraded provider state is explicit.

7. **Network Loss + Recovery**
   - Disable the user's network on Desktop.
   - Verify degraded/offline state and no app crash.
   - Re-enable network and verify recovery.
   - Repeat lightweight fetch checks on web and mobile.

8. **Closeout**
   - Run the listed S86-T7 validation commands.
   - Post screenshots/recording links, diagnostics snippets, and any
     intentionally surface-specific gaps to `SOL-250`.

## Desk Sprint Lineage

- S79 created the NarrativeFlow desk/session substrate and seeded the default
  `Priced In Capital` desk.
- S80 is the primary "add Desks" sprint: desk profiles, Desk Manager
  permissions, agentic desk style, Desk Forecasts, NarrativeFlow forecast
  toggle, and thesis monitoring.
- S82 adds DeskMap/NF-Workspace identity and desk-owned visual/context state.
- S83 adds File Room, vault-backed desk memory, Desk Rail Inbox approvals, and
  agentic memo workflow.
- S101 is a post-beta/deferred Desk Command Center prototype, not the original
  Desk foundation.
- S102 is a post-beta/deferred macro-event cognition and desk-specific
  FileRoom editing expansion, not the original Desk foundation.
