# Deployment files

`dist/` is a plain static site: HTML, JavaScript and assets, with no server
code, no API calls, no accounts and no authentication. Any ordinary HTTPS host
or static bucket will serve it.

**Nothing here has been deployed.** These files are prepared so that publishing
is a single step whenever you want it.

## Build first

```bash
npm install
npm run build      # runs the asset pipeline, typechecks, and writes dist/
```

## Notes that apply to every host

- Serve `dist/` as the web root.
- The build uses relative asset paths (`base: './'`), so it also works from a
  subdirectory such as `https://example.com/last-hearth/`.
- `assets/manifest.json` must be served with `Content-Type: application/json`
  and should not be cached aggressively; everything under `assets/` is
  content-addressed by the build and is safe to cache for a long time.
- No cross-origin requests are made, so no CORS configuration is needed.
- There is no service worker and no offline mode in this release.

## Files in this directory

| File | Host |
|---|---|
| `netlify.toml` | Netlify |
| `vercel.json` | Vercel |
| `_headers` | Netlify / Cloudflare Pages |
| `nginx.conf` | A self-hosted nginx server |
| `Caddyfile` | Caddy |
| `github-pages.yml` | A GitHub Actions workflow (copy to `.github/workflows/`) |

Copy the one you need to the repository root (or, for the workflow, to
`.github/workflows/`) before deploying.
