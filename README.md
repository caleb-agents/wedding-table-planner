# Wedding group planner

A one-page planner for putting the wedding guests into groups of 10.

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

Group assignments stay in this browser, under `wedding_table_planner_data`. The page does not upload assignments, and it does not add RSVP status, family notes, contact details, or Drive file ids to the published list.

A saved plan that is not the old sample is kept, including earlier imported ids such as `g001` and any seats already chosen. A saved sample plan is replaced with the public 135 names on the next visit. **Backup and import → Load wedding list** loads those 135 names again. If people are already assigned, the page asks before it replaces them.

An old table with more than 10 people keeps everyone and shows an over-capacity warning until someone is moved out. New groups hold 10.

## Another list

**Import file** still accepts the root guest JSON or a CSV. A private fragment link still works, and it is not required for the public list:

```
https://caleb-agents.github.io/wedding-table-planner/#guests=<base64url>
```

`<base64url>` is the UTF-8 JSON, encoded as base64url (`+` to `-`, `/` to `_`, padding `=` optional). The fragment is not sent to the server. The page removes it after reading it. A bad fragment leaves the saved plan untouched. If the saved plan is not the old sample and someone is already assigned, the page asks before replacing it.

## Deploy

GitHub Pages builds `dist` with the workflow in `.github/workflows/deploy.yml`. The live path is `/wedding-table-planner/`.
