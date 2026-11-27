# link-portal

A single-page link hub ("link in bio") for Esahp: avatar, name, a featured Donate card and a grid of
links (Discord, TikTok Live, YouTube, business contact). Built from the "Portal — Desktop" design mockup.

Plain HTML/CSS/JS -- no build step, no npm dependencies. Fonts come from Google Fonts.

## The 3D cat

The avatar is a black cat drawn with Three.js ([`cat3d.js`](./cat3d.js)). Three.js r149 is vendored at
`vendor/three.min.js` -- the last release with a plain `<script>` build, which keeps the page working
from disk and under the site's `script-src 'self'` CSP. `app.js` loads both after the links render.
If WebGL isn't available or loading fails, the original SVG cat in `index.html` is used instead.

Character: a chubby black cat with a white muzzle and eyebrow spots, pink ears and nose, and big
round yellow eyes -- a bit smug by default (half-lidded, side-eye glances), attentive when you move,
clingy when petted (^ ^ eyes, blush, purr, head rubs) and it gives you slow blinks now and then.

It sits in place. Body, legs, paws and neck are one smooth mesh (and the head another), built at
load from signed distance fields so the legs flow into the body with no seams. It follows the
pointer, blinks, twitches its ears, sways its tail, gets sleepy when left alone, purrs with ^ ^ eyes
when petted and goes wide-eyed while a link is hovered. Click (or Enter): a happy hop with hearts.

Actions: it yawns every 8-20 s (and once on getting drowsy); left alone ~25 s it falls asleep, head
nodding, with "z"s floating up, and startles awake when the pointer moves; three quick clicks make
it sneeze ("ฮัดชิ่ว!") and shake its head.

Easter eggs: type `meow` (or `เหมียว`) anywhere on the page and it meows back; the Konami code
(↑ ↑ ↓ ↓ ← → ← → B A) puts on its sunglasses for 20 s ("โหมดเท่ 😎", same code again takes them off);
keep petting it for ~4 s and it bursts into hearts ("รักนะ ♥").

On phones: stroke the cat with a finger to pet it (a touch that starts on the cat doesn't scroll
the page), tap it to boop it. Taps anywhere make it look there, scrolling makes it glance down at
the links, and both count as activity -- with the sleep timers doubled (drowsy ~30 s, asleep ~50 s)
since there's no pointer moving around.

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

A link still set to `"#"` only prints a warning (it shows on the page as a "coming soon" card). Run the same check locally with
`node scripts/build.js`. Pull requests get their own Deploy Preview URL.
