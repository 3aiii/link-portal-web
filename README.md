# link-portal

A single-page link hub ("link in bio") for Esahp: avatar, name, a featured Donate card and a grid of
links (Discord, TikTok Live, YouTube, business contact). Built from the "Portal — Desktop" design mockup.

Plain HTML/CSS/JS -- no build step, no dependencies. Fonts come from Google Fonts.

## Edit the links

Everything lives in [`config.js`](./config.js): name, accent colour, footer, and the `links` list
(title, description, URL, icon, icon-tile colours). Replace each `url: "#"` with the real link. The
entry with `featured: true` is the big card on top.

## Preview

Open `index.html` directly in a browser, or serve the folder:

```powershell
npx serve .          # or: python -m http.server
```

## Deploy (Netlify)

Connect the GitHub repo in Netlify (**Add new site → Import an existing project**); `netlify.toml`
already sets the build, so leave the build settings as detected.

On every push, Netlify runs `node scripts/build.js`, which checks the site and copies only the page's
files into `dist/` (README, scripts and `netlify.toml` aren't published). It fails the build -- and
the live site stays on the previous deploy -- if:

- a JS file has a syntax error
- `index.html` points at a file that doesn't exist
- a link in `config.js` has no title, an unknown icon, or a URL that isn't `https://` / `mailto:`

A link still set to `"#"` only prints a warning. Run the same check locally with
`node scripts/build.js`. Pull requests get their own Deploy Preview URL.
