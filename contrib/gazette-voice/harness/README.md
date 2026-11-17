# Screenshot harness

Renders the add-on's real components to static pages and photographs them, so a reviewer can see the screens without the app.

```bash
cd contrib
npm run harness        # builds harness/out/*.html and, if Chrome is found, harness/out/*.png
```

The colours here are the app's semantic tokens (`--background`, `--primary`, ...) with stand-in values; in ilm.red the app's own themes supply them. Nothing in this folder ships.
