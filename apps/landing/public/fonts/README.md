# Self-hosted fonts

Space Grotesk and Space Mono, subset to `latin` and `latin-ext` by the Google
Fonts CSS API and served from this origin so the site renders its own type
without a third-party request on first paint.

| File | Family | Weights | Subset |
|---|---|---|---|
| `space-grotesk-latin-var.woff2` | Space Grotesk | 300–700 (variable) | latin |
| `space-grotesk-latin-ext-var.woff2` | Space Grotesk | 300–700 (variable) | latin-ext |
| `space-mono-latin-400.woff2` | Space Mono | 400 | latin |
| `space-mono-latin-700.woff2` | Space Mono | 700 | latin |
| `space-mono-latin-ext-400.woff2` | Space Mono | 400 | latin-ext |
| `space-mono-latin-ext-700.woff2` | Space Mono | 700 | latin-ext |

Both families are licensed under the SIL Open Font License 1.1 — see
`OFL-SpaceGrotesk.txt` and `OFL-SpaceMono.txt`.

The `@font-face` rules and their `unicode-range` values live in
`apps/landing/src/styles/global.css`.

## Refreshing

Fetch the upstream stylesheet with a woff2-capable user agent, then download the
`latin` and `latin-ext` URLs it names:

```sh
curl -A "Mozilla/5.0 ... Chrome/120.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Space+Mono:wght@400;700&display=swap"
```

Google revs the version segment in those URLs (`/v22/`, `/v17/`), so the file
contents change even when the family does not. Copy the `unicode-range` values
across too — they are what keeps the browser from downloading the extended
subset for a page that never uses it.
