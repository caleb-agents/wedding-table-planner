# Group planner

A private, one-page planner for putting names into groups of 10. It runs entirely in the browser and is published as a static site.

## Run locally

```bash
npm ci
npm test
npm run dev
npm run build
```

The dev server uses port 43210. The production base path is `/wedding-table-planner/`.

## Privacy

Guest names stay in `localStorage` under `wedding_table_planner_data`. The page does not send them anywhere: no accounts, analytics, or other network calls. Do not commit a real guest list. Sample names are fictional.

An existing saved plan is kept on upgrade. Old tables become groups of 10. If a saved table has more than 10 people, those people stay and the group shows an over-capacity warning until someone is moved out.

## Import a list

Use **Backup and import → Import file**, or open a private link whose hash carries the list.

The file or hash payload is the root object, with no version wrapper:

```json
{
  "source": { "fileId": "string", "name": "string", "tab": "string" },
  "weddingDate": "2027-01-23",
  "tables": [],
  "guests": [
    {
      "id": "string",
      "name": "string",
      "side": "string",
      "sheetBlock": "string",
      "isChild": false,
      "rsvp": "confirmed",
      "tableId": null
    }
  ]
}
```

`rsvp` is `confirmed`, `unconfirmed`, or `unknown`. Optional `familyGroup`, `cardSent`, and `events` are stored. Only `familyGroup` is used when searching. An empty `tables` array creates Group 1 through Group 14, each with room for 10, and leaves everyone unassigned.

## Private link format

```
https://caleb-agents.github.io/wedding-table-planner/#guests=<base64url>
```

`<base64url>` is the UTF-8 JSON above, encoded as base64url:

- standard base64 of the UTF-8 bytes
- `+` becomes `-`
- `/` becomes `_`
- trailing `=` padding may be omitted

The value lives in the URL fragment, so the browser does not send it to the server. The page decodes it locally, then removes the fragment with `history.replaceState`. A bad payload leaves the saved list untouched. If the saved plan is not the sample and someone is already assigned, the page asks before replacing it.

```js
function toBase64Url(json) {
  return Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
```

## Deploy

GitHub Pages builds `dist` with the workflow in `.github/workflows/deploy.yml`. The live path is `/wedding-table-planner/`.
