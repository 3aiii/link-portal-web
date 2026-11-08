// Everything you'd normally want to change lives here: the name under the
// avatar, the accent colour, and the links.
//
// Links render top to bottom. The one with `featured: true` becomes the big
// orange card on top; the rest fill the two-column grid below it.
// `icon` is one of: heart, users, music, twitch, play, mail  (see ICONS in app.js)
// A link with `copy: "text"` (instead of `url`) isn't a link at all: the card
// shows that text and copies it to the clipboard when clicked.
// A link whose url is still "#" (or that has `soon: true`) shows as a dimmed
// "เร็วๆ นี้" card that can't be opened.
// `tileBg` / `tileFg` colour the small icon square on grid cards.
window.PORTAL_CONFIG = {
  name: "Esahp",
  accent: "#FF7A1A", // design options: #FF7A1A, #FF9A3C, #F25C1F, #FFB347
  footer: "© 2026 Esahp",
  links: [
    {
      featured: true,
      title: "Donate / โดเนท",
      desc: "สนับสนุนสตรีม · ชื่อขึ้นบนจอระหว่างไลฟ์",
      url: "https://ezdn.app/esahp",
      icon: "heart",
    },
    {
      title: "Discord",
      desc: "คอมมูนิตี้ · แจ้งเตือนก่อนไลฟ์",
      url: "#",
      icon: "users",
      tileBg: "#2B2244",
      tileFg: "#A7AEFF",
    },
    {
      title: "TikTok Live",
      desc: "ไลฟ์สด · มาพูดคุยกันได้",
      url: "https://www.tiktok.com/@esahp.law",
      icon: "music",
      tileBg: "#1E2A2E",
      tileFg: "#6FE7F0",
    },
    {
      title: "Twitch",
      desc: "ไลฟ์สดบน Twitch",
      url: "https://www.twitch.tv/0_phase",
      icon: "twitch",
      tileBg: "#2A1F3D",
      tileFg: "#BF94FF",
    },
    {
      title: "YouTube",
      desc: "คลิป · ไฮไลต์ย้อนหลัง",
      url: "https://www.youtube.com/@Esahplaw",
      icon: "play",
      tileBg: "#3A1A1A",
      tileFg: "#FF8A8A",
    },
    {
      title: "ติดต่องาน",
      // `copy` instead of `url`: the card shows this text and copies it on click.
      copy: "esahp.law@gmail.com",
      icon: "mail",
      tileBg: "#3A2614",
      tileFg: "accent", // "accent" = follow the accent colour above
    },
  ],
};
