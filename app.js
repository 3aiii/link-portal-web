// Renders the link cards from config.js and drives the mouse spotlight.
// Plain script (no modules) so index.html also works opened straight from disk.
(function () {
  "use strict";

  const config = window.PORTAL_CONFIG || { links: [] };
  const root = document.documentElement;

  if (config.accent) root.style.setProperty("--accent", config.accent);
  const accent = getComputedStyle(root).getPropertyValue("--accent").trim();

  // Inner SVG markup per icon name, 24x24 viewBox, stroke-drawn.
  const ICONS = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"></path>',
    users: '<path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 7 18.5V20"></path><circle cx="12" cy="9" r="3"></circle><path d="M20 19v-1a3 3 0 0 0-2.2-2.9M16.5 6.2a3 3 0 0 1 0 5.6M4 19v-1a3 3 0 0 1 2.2-2.9M7.5 6.2a3 3 0 0 0 0 5.6"></path>',
    music: '<path d="M9 18V5l11-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle>',
    twitch: '<path d="M4 3h16v11l-4 4h-4l-3 3v-3H4z"></path><path d="M11 8v4M16 8v4"></path>',
    play: '<rect x="2" y="5" width="20" height="14" rx="4"></rect><path d="M10 9l5 3-5 3z" fill="currentColor"></path>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path>',
  };
  const ARROW = '<path d="M7 17L17 7M8 7h9v9"></path>';
  const LOCK = '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>';
  const COPY = '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path>';

  // `fill` is a parameter rather than part of `attrs`: a second fill="" on the
  // same tag is ignored by the parser, so it couldn't be overridden that way.
  const svg = (size, inner, attrs, fill = "none") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs || ""}>${inner}</svg>`;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Opens off-site links in a new tab; "#" placeholders stay put.
  function linkAttrs(url) {
    const safe = /^(https?:|mailto:|#|\/)/i.test(url || "") ? url : "#";
    const external = /^https?:/i.test(safe);
    return `href="${esc(safe)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
  }

  function featuredCard(link, delay) {
    return (
      `<a class="cd cd-featured in shine" ${linkAttrs(link.url)} style="animation-delay:${delay}s">` +
      `<div class="tile" style="color:${accent}">${svg(28, ICONS[link.icon] || ICONS.heart, 'class="heart" stroke-width="1.5"', "currentColor")}</div>` +
      `<div class="text"><span class="title">${esc(link.title)}</span><span class="desc">${esc(link.desc)}</span></div>` +
      svg(22, ARROW, 'class="arr" stroke-width="2.2"') +
      `</a>`
    );
  }

  // A link with no real URL yet ("#" or missing) or marked `soon: true` shows
  // as a dimmed "coming soon" card that goes nowhere.
  const isSoon = (link) => !link.copy && (link.soon || !link.url || link.url === "#");

  function soonCard(link, delay) {
    const fg = !link.tileFg || link.tileFg === "accent" ? accent : link.tileFg;
    return (
      `<div class="cd cd-small cd-soon in" role="link" aria-disabled="true" tabindex="0" ` +
      `title="ยังไม่เปิดให้บริการ" style="animation-delay:${delay}s">` +
      `<div class="top">` +
      `<div class="tile" style="background:${esc(link.tileBg || "#3A2614")};color:${esc(fg)}">${svg(24, ICONS[link.icon] || ICONS.mail, 'stroke-width="2"')}</div>` +
      `<span class="soon-badge">${svg(11, LOCK, 'stroke-width="2.4"')}เร็วๆ นี้</span>` +
      `</div>` +
      `<div class="text"><span class="title">${esc(link.title)}</span>` +
      `<span class="desc soon-desc">${esc(link.desc)}</span><span class="desc soon-msg" aria-live="polite"></span></div>` +
      `</div>`
    );
  }

  function smallCard(link, delay) {
    if (isSoon(link)) return soonCard(link, delay);
    const fg = !link.tileFg || link.tileFg === "accent" ? accent : link.tileFg;
    const isCopy = Boolean(link.copy);
    // A copy card is a <button>: it does something on the page rather than
    // going anywhere, and shows the text itself in place of a description.
    const open = isCopy
      ? `<button type="button" class="cd cd-small cd-copy in" data-copy="${esc(link.copy)}" style="animation-delay:${delay}s">`
      : `<a class="cd cd-small in" ${linkAttrs(link.url)} style="animation-delay:${delay}s">`;
    const desc = isCopy
      ? `<span class="desc copy-text">${esc(link.copy)}</span><span class="desc copied-text" aria-live="polite"></span>`
      : `<span class="desc">${esc(link.desc)}</span>`;
    return (
      open +
      `<div class="top">` +
      `<div class="tile" style="background:${esc(link.tileBg || "#3A2614")};color:${esc(fg)}">${svg(24, ICONS[link.icon] || ICONS.mail, 'stroke-width="2"')}</div>` +
      `<span style="color:#C9B9A7">${svg(18, isCopy ? COPY : ARROW, 'class="arr" stroke-width="2"')}</span>` +
      `</div>` +
      `<div class="text"><span class="title">${esc(link.title)}</span>${desc}</div>` +
      (isCopy ? `</button>` : `</a>`)
    );
  }

  // Entrance stagger: hero at 0-0.1s, then each card 80ms after the last.
  const featured = config.links.filter((l) => l.featured);
  const rest = config.links.filter((l) => !l.featured);
  let delay = 0.28;
  let html = "";
  for (const link of featured) {
    html += featuredCard(link, delay.toFixed(2));
    delay += 0.08;
  }
  if (rest.length) {
    html += '<div class="links-grid">';
    for (const link of rest) {
      html += smallCard(link, delay.toFixed(2));
      delay += 0.08;
    }
    html += "</div>";
  }
  document.getElementById("links").innerHTML = html;

  // Copy cards: copy the text, flash "คัดลอกแล้ว" in place of it for a moment.
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API needs a secure context (https/localhost); opening
      // index.html from disk lands here, so fall back to execCommand.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }
  // Coming-soon cards: a little shake and "ยังไม่เปิดให้บริการ" in place of
  // the description, so a click doesn't just feel broken.
  function nudgeSoon(card) {
    card.querySelector(".soon-msg").textContent = "ยังไม่เปิดให้บริการ";
    card.classList.remove("nudge");
    void card.offsetWidth; // restart the shake
    card.classList.add("nudge", "told");
    clearTimeout(card._soonTimer);
    card._soonTimer = setTimeout(() => card.classList.remove("told"), 1800);
  }
  const linksEl = document.getElementById("links");
  linksEl.addEventListener("click", (e) => {
    const card = e.target.closest(".cd-soon");
    if (card) nudgeSoon(card);
  });
  linksEl.addEventListener("keydown", (e) => {
    const card = e.target.closest(".cd-soon");
    if (card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      nudgeSoon(card);
    }
  });

  document.getElementById("links").addEventListener("click", async (e) => {
    const card = e.target.closest(".cd-copy");
    if (!card) return;
    const ok = await copyText(card.dataset.copy);
    card.querySelector(".copied-text").textContent = ok ? "คัดลอกแล้ว ✓" : "คัดลอกไม่ได้ — เลือกข้อความเอง";
    card.classList.add("copied");
    clearTimeout(card._copiedTimer);
    card._copiedTimer = setTimeout(() => card.classList.remove("copied"), 1600);
  });

  const footer = document.getElementById("footer");
  if (config.footer) footer.textContent = config.footer;
  footer.style.animationDelay = `${(delay + 0.07).toFixed(2)}s`;

  if (config.name) {
    const nameEl = document.getElementById("name");
    nameEl.firstChild.textContent = config.name;
    document.title = `${config.name} — Link Portal`;
  }

  // Embers: fixed positions/sizes/timings from the design.
  const EMBERS = [
    [8, 4, "accent", 11, 0], [17, 3, "alt", 14, 3], [26, 5, "accent", 12, 6], [38, 3, "alt", 16, 1.5],
    [52, 4, "accent", 13, 8], [63, 3, "alt", 10, 4], [72, 5, "accent", 15, 2], [81, 3, "alt", 12, 7],
    [90, 4, "accent", 14, 5], [45, 2, "#FFD2A6", 9, 9],
  ];
  const embersEl = document.getElementById("embers");
  for (const [left, size, color, dur, wait] of EMBERS) {
    const span = document.createElement("span");
    span.className = "ember";
    const bg = color === "accent" ? "var(--accent)" : color === "alt" ? "var(--ember-alt)" : color;
    span.style.cssText = `left:${left}%;width:${size}px;height:${size}px;background:${bg};animation-duration:${dur}s;animation-delay:${wait}s`;
    embersEl.appendChild(span);
  }

  // fadeUp holds its end state (fill-mode both), and an animation's transform
  // outranks the :hover/:active ones, so the cards would never lift or press.
  // Dropping .in once the entrance is done hands transform back to CSS.
  document.addEventListener("animationend", (e) => {
    if (e.animationName === "fadeUp") e.target.classList.remove("in");
  });

  setupCat();

  // Spotlight follows the pointer; batched to one write per frame.
  const wrap = document.getElementById("wrap");
  let pending = null;
  wrap.addEventListener("mousemove", (e) => {
    const r = wrap.getBoundingClientRect();
    const x = Math.round(e.clientX - r.left);
    const y = Math.round(e.clientY - r.top);
    if (pending) return void (pending = [x, y]);
    pending = [x, y];
    requestAnimationFrame(() => {
      wrap.style.setProperty("--sx", `${pending[0]}px`);
      wrap.style.setProperty("--sy", `${pending[1]}px`);
      pending = null;
    });
  });

  // ---------- cat ----------
  // Eyes and head follow the pointer; when the pointer goes quiet (or there
  // is none, on a phone) the cat looks around on its own. On top of that:
  // random blinks and ear twitches, wide pupils while a link is hovered, and
  // a happy face on hover / a boop with hearts on click.
  function setupCat() {
    const cat = document.getElementById("cat");
    const avatar = document.getElementById("avatar");
    const face = document.getElementById("avatar-face");
    if (!cat || !avatar) return;

    const head = cat.querySelector(".head");
    const pupils = cat.querySelectorAll(".pupil");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rand = (min, max) => min + Math.random() * (max - min);
    // Moods that just play once: set the class, clear it after `ms`.
    function flash(cls, ms) {
      cat.classList.remove(cls);
      void cat.getBoundingClientRect(); // restart the CSS animation if it was mid-way
      cat.classList.add(cls);
      setTimeout(() => cat.classList.remove(cls), ms);
    }

    // `x`/`y` in -1..1: where the cat is looking, relative to straight ahead.
    function look(x, y) {
      for (const p of pupils) p.style.transform = `translate(${(x * 2.6).toFixed(2)}px, ${(y * 2.2).toFixed(2)}px)`;
      head.style.transform = `translate(${(x * 1.6).toFixed(2)}px, ${(y * 1.2).toFixed(2)}px) rotate(${(x * 6).toFixed(2)}deg)`;
    }

    // ---- happy / boop (kept even with reduced motion: they're user-triggered) ----
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let happyTimer = null;
    if (canHover) {
      avatar.addEventListener("pointerenter", () => cat.classList.add("happy"));
      avatar.addEventListener("pointerleave", () => {
        if (!happyTimer) cat.classList.remove("happy");
      });
    }
    const HEART = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>';
    avatar.addEventListener("click", () => {
      cat.classList.add("happy");
      clearTimeout(happyTimer);
      happyTimer = setTimeout(() => {
        happyTimer = null;
        if (!(canHover && avatar.matches(":hover"))) cat.classList.remove("happy");
      }, 1400);
      if (reduceMotion) return;
      face.classList.remove("boop");
      void face.offsetWidth;
      face.classList.add("boop");
      for (let i = 0; i < 3; i++) {
        const h = document.createElement("span");
        h.className = "heart-pop";
        h.innerHTML = HEART;
        h.style.setProperty("--hx", `${Math.round(rand(-34, 34))}px`);
        h.style.setProperty("--hr", `${Math.round(rand(-25, 25))}deg`);
        h.style.animationDelay = `${i * 90}ms`;
        avatar.appendChild(h);
        setTimeout(() => h.remove(), 1300 + i * 90);
      }
    });

    // ---- excited pupils while a link card is hovered or focused ----
    const links = document.getElementById("links");
    const setExcited = (on) => cat.classList.toggle("excited", on);
    // Not for coming-soon cards -- nothing there to get excited about.
    links.addEventListener("pointerover", (e) => setExcited(!!e.target.closest(".cd:not(.cd-soon)")));
    links.addEventListener("pointerleave", () => setExcited(false));
    links.addEventListener("focusin", (e) => setExcited(!e.target.closest(".cd-soon")));
    links.addEventListener("focusout", () => setExcited(false));

    if (reduceMotion) return; // no idle motion beyond this point

    // ---- blinks: every 2.5-6s, sometimes a double ----
    (function scheduleBlink() {
      setTimeout(() => {
        flash("blink", 170);
        if (Math.random() < 0.25) setTimeout(() => flash("blink", 170), 260);
        scheduleBlink();
      }, rand(2500, 6000));
    })();

    // ---- ear twitches: one ear every 4-9s ----
    (function scheduleTwitch() {
      setTimeout(() => {
        flash(Math.random() < 0.5 ? "twitch-l" : "twitch-r", 400);
        scheduleTwitch();
      }, rand(4000, 9000));
    })();

    // ---- looking: follow the pointer, wander when it's idle ----
    let lastPointerAt = 0;
    let frame = 0;
    let target = [0, 0];
    window.addEventListener("pointermove", (e) => {
      lastPointerAt = Date.now();
      const r = avatar.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      // Full deflection once the pointer is ~250px away; gentler up close.
      const reach = Math.min(1, dist / 250);
      target = [(dx / dist) * reach, (dy / dist) * reach];
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; look(target[0], target[1]); });
    }, { passive: true });

    (function wander() {
      setTimeout(() => {
        if (Date.now() - lastPointerAt > 3500) {
          // Mostly glance somewhere, now and then settle back to the middle.
          if (Math.random() < 0.3) look(0, 0);
          else look(rand(-1, 1), rand(-0.6, 0.8));
        }
        wander();
      }, rand(1600, 3200));
    })();
  }
})();
