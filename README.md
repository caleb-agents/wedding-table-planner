# Wedding group planner

A one-page planner for putting the wedding guests into tables of 10. The tables are the main view: each card shows the name, the count out of 10, and who is seated. Tap a table to search for someone to add. People already in another table are labeled with that table, and moving them takes a separate button. The full guest list is collapsed until you open it. A full table shows that it is full and will not take anyone else.

The production build uses one shared public plan at `https://next-koala-955.convex.cloud`. Anyone with the page can read and change assignments. There is no account. The original 135 names stay on that plan. **Add guest** adds another person by name only. The same name can be added again as a separate person. New people start unassigned. If the shared plan cannot be reached, this browser’s saved plan stays on the device and is not uploaded by itself. When the shared plan has nobody seated and this browser has seats or added guests, the page asks before importing them.

## Run locally

```bash
npm ci
npm test
npm run dev
npm run build
```

The dev server uses port 43210. The production base path is `/wedding-table-planner/`.

## What is public

The default guest list is public. `src/data/public-guests.json` is the approved names-only file: each entry has an `id` and a `name`, and nothing else. Those names load automatically at the public site address. There is no sample list. Added guests use a separate `c_` id, a trimmed name of at most 80 characters, and no other fields. They are stored in the same public guest table. Refreshing the original 135 names does not delete them.

A copy of the plan also stays in this browser, under `wedding_table_planner_data`, so the page still opens when the shared plan is offline. That copy is not sent to the shared plan unless you choose **Import this browser’s plan**, and that choice is refused once the shared plan already has assignments. The shared plan does not store RSVP status, family notes, contact details, or Drive file ids. Added guests are name and id only.

A saved plan that is not the old sample is kept, including earlier imported ids such as `g001` and any seats already chosen. A saved sample plan is replaced with the public 135 names on the next visit. **Backup and import → Load wedding list** loads those 135 names again. If people are already assigned, the page asks before it replaces them.

An old table with more than 10 people keeps everyone and shows an over-capacity warning until someone is moved out. New groups hold 10.

## Another list

**Import file** still accepts the root guest JSON or a CSV. A private fragment link still works, and it is not required for the public list:

```
https://caleb-agents.github.io/wedding-table-planner/#guests=<base64url>
```

`<base64url>` is the UTF-8 JSON, encoded as base64url (`+` to `-`, `/` to `_`, padding `=` optional). The fragment is not sent to the server. The page removes it after reading it. A bad fragment leaves the saved plan untouched. If the saved plan is not the old sample and someone is already assigned, the page asks before replacing it.

## Deploy the shared plan

Deploy the Convex functions before publishing the page. The new functions are backward compatible: `ensureDefaults` no longer deletes guests outside the original 135, `get` still returns `guestId` and `name` only, and `importLocal` still accepts a payload with only groups and assignments. `addGuest` and `removeGuest` are new. An older page keeps working against the new functions. A new page cannot add a guest until those functions are deployed.

The site build reads the public `VITE_CONVEX_URL` (`https://next-koala-955.convex.cloud`). Do not put `CONVEX_DEPLOY_KEY` or any admin credential in this repo or in the client bundle. Do not run `ensureDefaults` in a way that reseeds over live assignments; the mutation only fills missing published names and creates groups when none exist.

From the isolated Convex project, after the inherited `CONVEX_DEPLOY_KEY` and `CONVEX_DEPLOYMENT` environment variables are unset so the project `.env.local` selects production `next-koala-955`:

```bash
unset CONVEX_DEPLOY_KEY
unset CONVEX_DEPLOYMENT
npx convex deploy --yes
```

GitHub Pages builds `dist` with the workflow in `.github/workflows/deploy.yml`. The live path is `/wedding-table-planner/`.
