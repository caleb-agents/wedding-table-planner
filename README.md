# Wedding group planner

A one-page planner for putting the wedding guests into tables of 10. The tables are the main view: each card shows the name, the count out of 10, and who is seated. Tap a table to search for someone to add. People already in another table are labeled with that table, and moving them takes a separate button. The full guest list is collapsed until you open it. A full table shows that it is full and will not take anyone else.

The production build uses one shared public plan at `https://next-koala-955.convex.cloud`. Anyone with the page can read and change assignments. There is no account. Names on that plan are the public 135 ids and names only. If the shared plan cannot be reached, this browser’s saved plan stays on the device and is not uploaded by itself. When the shared plan has nobody seated and this browser does, the page asks before importing those assignments.

## Run locally

```bash
npm ci
npm test
npm run dev
npm run build
```

The dev server uses port 43210. The production base path is `/wedding-table-planner/`.

## What is public

The default guest list is public. `src/data/public-guests.json` is the approved names-only file: each entry has an `id` and a `name`, and nothing else. Those names load automatically at the public site address. There is no sample list.

A copy of the plan also stays in this browser, under `wedding_table_planner_data`, so the page still opens when the shared plan is offline. That copy is not sent to the shared plan unless you choose **Import assignments from this browser**, and that choice is refused once the shared plan already has assignments. The shared plan does not store RSVP status, family notes, contact details, or Drive file ids.

A saved plan that is not the old sample is kept, including earlier imported ids such as `g001` and any seats already chosen. A saved sample plan is replaced with the public 135 names on the next visit. **Backup and import → Load wedding list** loads those 135 names again. If people are already assigned, the page asks before it replaces them.

An old table with more than 10 people keeps everyone and shows an over-capacity warning until someone is moved out. New groups hold 10.

## Another list

**Import file** still accepts the root guest JSON or a CSV. A private fragment link still works, and it is not required for the public list:

```
https://caleb-agents.github.io/wedding-table-planner/#guests=<base64url>
```

`<base64url>` is the UTF-8 JSON, encoded as base64url (`+` to `-`, `/` to `_`, padding `=` optional). The fragment is not sent to the server. The page removes it after reading it. A bad fragment leaves the saved plan untouched. If the saved plan is not the old sample and someone is already assigned, the page asks before replacing it.

## Deploy the shared plan

The site build reads the public `VITE_CONVEX_URL` (`https://next-koala-955.convex.cloud`). Do not put `CONVEX_DEPLOY_KEY` or any admin credential in this repo or in the client bundle.

From the isolated Convex project, after the inherited `CONVEX_DEPLOY_KEY` and `CONVEX_DEPLOYMENT` environment variables are unset so the project `.env.local` selects production `next-koala-955`:

```bash
unset CONVEX_DEPLOY_KEY
unset CONVEX_DEPLOYMENT
npx convex deploy --yes
```

GitHub Pages builds `dist` with the workflow in `.github/workflows/deploy.yml`. The live path is `/wedding-table-planner/`.
