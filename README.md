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

## Deploy

It's static, so any static host works (GitHub Pages, Netlify, Cloudflare Pages, Vercel) -- upload the
folder as-is.
