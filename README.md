# Wedding Table Planner 💒

A delightful, privacy-first pixel-art wedding table planner that runs entirely in your browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Static Site](https://img.shields.io/badge/hosting-GitHub%20Pages-green.svg)

## Features

- 🎨 **Whimsical Pixel Art** - Beautiful garden venue with string lights, flowers, and animated decorations
- 🔒 **Privacy First** - All data stays in your browser's localStorage, never uploaded anywhere
- 📱 **Responsive** - Works on desktop and mobile with drag-and-drop or tap-to-assign
- ↩️ **Undo/Redo** - Full undo/redo history (Ctrl+Z / Ctrl+Shift+Z)
- 👨‍👩‍👧 **Family Groups** - Seat entire family groups together with a single drag
- 🔍 **Smart Filtering** - Filter by RSVP status, side, or search by name
- 📊 **Export Options** - Export seating as CSV or backup as JSON
- 🖨️ **Print Ready** - Print-friendly seating plan view
- ♿ **Accessible** - Keyboard navigation and screen reader support

## Quick Start

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Deploying to GitHub Pages

1. Fork or push this repository to GitHub
2. Go to Settings → Pages
3. Set Source to "GitHub Actions"
4. Push to the `main` branch to trigger deployment

The app will be available at `https://<username>.github.io/wedding-table-planner/`

## Privacy & Data Handling

**Your guest data never leaves your browser.**

- Guest lists are stored in `localStorage` only
- No analytics, tracking, or external service calls
- No backend servers or databases
- Export/import lets you backup your work
- Sample demo data uses obviously fictional characters

### Importing Your Guest List

The app accepts JSON files with this exact schema:

```json
{
  "source": { "fileId": "...", "name": "...", "tab": "..." },
  "weddingDate": "2027-01-23",
  "tables": [],
  "guests": [
    {
      "id": "unique-id",
      "name": "Guest Name",
      "side": "bride|groom|mutual",
      "sheetBlock": "Family|Friends|etc",
      "isChild": false,
      "rsvp": "confirmed|unconfirmed|unknown",
      "tableId": null,
      "familyGroup": "Optional explicit family only",
      "cardSent": "optional, stored but not displayed",
      "events": {}
    }
  ]
}
```

When `tables` is empty, the app creates an editable suggested layout: 14 round tables of 10 and one head table of 12. That layout is labeled as a suggestion, not a fact about the venue, and no guest is seated automatically. Optional `familyGroup` is the only field used to seat people together. `sheetBlock` is kept for reference and is not treated as a family. `cardSent` and `events` are stored with the guest and are not shown in the venue.

CSV import is also supported with columns: `name`, `side`, `rsvp`, `isChild`, `familyGroup`.

## Usage

### Seating Guests

1. **Click & Click**: Select a guest chip, then click a table
2. **Drag & Drop**: Drag guests directly to tables
3. **Family Groups**: Drag the family header to seat everyone together

### Managing Tables

- **Add Table**: Click "Add Table" in toolbar
- **Edit Table**: Double-click a table to change name/capacity
- **Remove Table**: Select a table, then click "Remove Table"

### Keyboard Shortcuts

- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo
- `Tab`: Navigate between elements
- `Enter` / `Space`: Activate buttons and selections

## Configuration

### Changing Base Path

For deployment to a different path, update `vite.config.ts`:

```ts
export default defineConfig({
  base: '/your-path/',
  // ...
});
```

## Technology

- React 19 + TypeScript
- Vite for bundling
- Pure CSS pixel art (no external images)
- Vitest for testing
- Zero runtime dependencies beyond React

## License

MIT License - feel free to use, modify, and distribute.

---

**Note:** This app is designed to be self-hosted. The demo uses clearly fictional guest names. Never commit real guest data to git repositories.
