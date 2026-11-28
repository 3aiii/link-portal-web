// 3D black cat avatar, drawn with Three.js (vendor/three.min.js, global THREE).
// app.js loads this on demand and calls Cat3D.mount(); if it returns false
// (no THREE, no WebGL) app.js keeps the SVG cat instead.
//
// A chubby cat sitting in place. Its body, legs, paws and neck are one smooth
// mesh and its head another (both built at load from distance fields); the
// head turns, the ears and tail move.
//
// Behaviour: head and eyes follow the pointer (and wander when the pointer is
// idle, getting sleepy after a while); blinks, slow blinks, ear twitches, a
// swaying tail; ^ ^ eyes, blush, purr and head rubs while hovered or petted;
// wide eyes while a link card is hovered. Click / Enter: a happy hop with
// hearts.
//
// Actions: a yawn every so often (and before dozing off); left alone it
// falls asleep with floating "z"s and startles awake when you come back;
// click it quickly three times and it sneezes.
//
// Easter eggs: type "meow" (or "เหมียว") and it meows back; the Konami code
// (up up down down left right left right B A) puts on its sunglasses; keep
// petting it for a few seconds and it bursts into hearts.
(function () {
  "use strict";

  // ---------- shaders ----------
  // "Fur": wrapped diffuse from the upper left, a broken-up (noisy) rim that
  // is warm accent on the right and cool violet on the left, and a soft sheen.
  // USE_TINT: per-vertex `aTint` blends toward uTint (pink inner ears) and
  // `aWhite` toward uWhite (white muzzle and eyebrow spots); `aBlush` marks
  // the cheeks, tinted pink by uBlush (0..1) when the cat is affectionate.
  // USE_AO: per-vertex `aAO` (1 open .. 0 enclosed), baked at load, darkens
  // creases: under the chin, between the legs, round the paws on the floor.
  // USE_EARS: per-vertex `aEar` (-1..0 left ear, 0..1 right ear, weight =
  // how far up the ear) bends the ears around their base for twitches, so the
  // head stays one seamless mesh.
  const FUR_VERT = `
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vObj;
    #ifdef USE_TINT
      attribute float aTint;
      attribute float aWhite;
      attribute float aBlush;
      varying float vTint;
      varying float vWhite;
      varying float vBlush;
    #endif
    #ifdef USE_AO
      attribute float aAO;
      varying float vAO;
    #endif
    #ifdef USE_EARS
      attribute float aEar;
      uniform vec2 uEarL;
      uniform vec2 uEarR;
      uniform vec3 uPivL;
      uniform vec3 uPivR;
      mat3 rotXZ(float ax, float az) {
        float cx = cos(ax), sx = sin(ax), cz = cos(az), sz = sin(az);
        return mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0) * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
      }
    #endif
    void main() {
      vec3 p = position;
      vec3 nrm = normal;
      #ifdef USE_EARS
        if (aEar != 0.0) {
          float w = abs(aEar);
          vec3 piv = aEar < 0.0 ? uPivL : uPivR;
          vec2 a = (aEar < 0.0 ? uEarL : uEarR) * w;
          mat3 R = rotXZ(a.x, a.y);
          p = piv + R * (p - piv);
          nrm = R * nrm;
        }
      #endif
      #ifdef USE_TINT
        vTint = aTint;
        vWhite = aWhite;
        vBlush = aBlush;
      #endif
      #ifdef USE_AO
        vAO = aAO;
      #endif
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * nrm);
      vV = normalize(-mv.xyz);
      vObj = position;
      gl_Position = projectionMatrix * mv;
    }`;
  const FUR_FRAG = `
    uniform float uObjScale;
    #ifdef USE_TINT
      uniform vec3 uTint;
      uniform vec3 uWhite;
      uniform vec3 uBlushCol;
      uniform float uBlush;
      varying float vTint;
      varying float vWhite;
      varying float vBlush;
    #endif
    #ifdef USE_AO
      varying float vAO;
    #endif
    uniform vec3 uBase;
    uniform vec3 uRim;
    uniform vec3 uRim2;
    uniform float uRimK;
    uniform vec3 uLight;
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vObj;
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
        f.z);
    }
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec3 v = normalize(vV);
      float wrap = max((dot(n, uLight) + 0.35) / 1.35, 0.0);
      float ndv = max(dot(n, v), 0.0);
      vec3 q = vObj * uObjScale;
      float fuzz = noise(q * 22.0) * 0.65 + noise(q * 55.0) * 0.35;
      float rim = pow(1.0 - ndv, 2.6) * (0.85 + 0.3 * fuzz);
      vec3 rimCol = mix(uRim2, uRim, smoothstep(-0.45, 0.25, n.x + 0.1));
      vec3 h = normalize(uLight + v);
      float spec = pow(max(dot(n, h), 0.0), 26.0) * 0.16;
      vec3 base = uBase;
      float rimK = uRimK;
      #ifdef USE_TINT
        base = mix(mix(uBase, uWhite, vWhite), uTint, vTint);
        base = mix(base, uBlushCol, vBlush * uBlush * 0.55);
        rimK *= 1.0 - 0.7 * max(vTint, vWhite);
      #endif
      float ao = 1.0;
      #ifdef USE_AO
        ao = vAO;
      #endif
      vec3 c = base * (0.55 + 1.25 * wrap) * (0.95 + 0.1 * fuzz) * mix(0.35, 1.0, ao)
        + rimCol * rim * rimK * mix(0.4, 1.0, ao)
        + vec3(1.0, 0.9, 0.8) * spec * ao;
      gl_FragColor = vec4(c, 1.0);
    }`;

  // Eyes: warm yellow iris going lime-green at the edge, a darker limbal
  // ring, a big round pupil that moves and dilates, fixed catch-lights.
  const EYE_VERT = `
    varying vec3 vP;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vP = position;
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const EYE_FRAG = `
    uniform vec2 uPupil;
    uniform float uPupilW;
    uniform float uPupilH;
    uniform float uR;
    varying vec3 vP;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec2 p = vP.xy / uR;
      float r = length(p);
      vec3 col = mix(vec3(1.0, 0.84, 0.2), vec3(0.9, 0.9, 0.3), smoothstep(0.55, 1.0, r));
      float ang = atan(p.y, p.x);
      col *= 0.93 + 0.07 * sin(ang * 31.0 + r * 9.0) * sin(ang * 13.0);
      col *= 1.0 - smoothstep(0.8, 1.0, r) * 0.45;
      vec2 q = (p - uPupil) / vec2(uPupilW, uPupilH);
      float pupil = 1.0 - smoothstep(0.86, 1.0, length(q));
      col = mix(col, vec3(0.02, 0.012, 0.01), pupil);
      float h1 = 1.0 - smoothstep(0.12, 0.17, length(p - vec2(0.26, 0.32)));
      float h2 = 1.0 - smoothstep(0.04, 0.08, length(p - vec2(-0.24, -0.3)));
      float fr = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
      col += vec3(1.0) * (h1 * 0.95 + h2 * 0.6) + fr * 0.2;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const HEART = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  const rand = (min, max) => min + Math.random() * (max - min);
  // Frame-rate independent ease of `a` toward `b`.
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- canvas textures ----------
  function canvasTexture(THREE, size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    draw(g, size);
    return new THREE.CanvasTexture(c);
  }

  // ---------- smooth blob meshes ----------
  // The torso and head are each one mesh, built at load from a signed
  // distance field: ellipsoids/cones merged with a smooth minimum, so
  // haunches, cheeks and ears flow into the body instead of being primitives
  // stuck together with hard creases. Meshed with naive surface nets, each
  // vertex snapped onto the surface, normals from the field's gradient.
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
  function smin(a, b, k) {
    const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
    return b + (a - b) * h - k * h * (1 - h);
  }
  const smax = (a, b, k) => -smin(-a, -b, k);
  function sdEll(x, y, z, cx, cy, cz, rx, ry, rz) {
    x -= cx;
    y -= cy;
    z -= cz;
    const k0 = len3(x / rx, y / ry, z / rz);
    const k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  }
  // Cone along +y from radius r1 at y=0 to r2 at y=h, rounded.
  function sdRoundCone(x, y, z, r1, r2, h) {
    const b = (r1 - r2) / h;
    const a = Math.sqrt(1 - b * b);
    const qx = Math.sqrt(x * x + z * z);
    const k = -b * qx + a * y;
    if (k < 0) return Math.sqrt(qx * qx + y * y) - r1;
    if (k > a * h) return Math.sqrt(qx * qx + (y - h) * (y - h)) - r2;
    return qx * a + y * b - r1;
  }

  // Ears, in head space. Base at (±0.33, 0.37, -0.04), tilted outward.
  const EAR_BASE = [0.33, 0.37, -0.04];
  const EAR_TILT = 0.32;
  const EAR_COS = Math.cos(EAR_TILT);
  const EAR_SIN = Math.sin(EAR_TILT);
  // Flattened cone with a cupped front (the inner ear carved out of it).
  // Results go in `ear` (scalars only: this runs ~a million times at load).
  const ear = { ly: 0, outer: 0, inner: 0, d: 0 };
  function earParts(x, y, z, s) {
    const dx = x - s * EAR_BASE[0], dy = y - EAR_BASE[1], lz = z - EAR_BASE[2];
    const sn = s * EAR_SIN;
    const lx = dx * EAR_COS - dy * sn;
    const ly = dx * sn + dy * EAR_COS;
    ear.ly = ly;
    ear.outer = sdRoundCone(lx, ly, lz / 0.5, 0.25, 0.06, 0.46) * 0.5; // rounded tips
    // The cut only matters near the ear, so skip it further out.
    ear.inner = ear.outer < 0.08 ? sdRoundCone(lx, ly - 0.06, (lz - 0.08) / 0.32, 0.16, 0.04, 0.32) * 0.32 : 1;
    ear.d = smax(ear.outer, -ear.inner, 0.025);
    return ear;
  }

  function headSDF(x, y, z) {
    // Far outside everything / deep inside the skull: only the sign matters
    // there, so answer cheaply.
    const far = len3(x, y - 0.18, z) - 0.95;
    if (far > 0.06) return far;
    let d = faceSDF(x, y, z);
    if (d < -0.15) return d;
    // only the ear on this side can reach
    return smin(d, earParts(x, y, z, x < 0 ? -1 : 1).d, 0.09);
  }

  // The head without its ears: a wide, round, chubby face.
  function faceSDF(x, y, z) {
    let d = sdEll(x, y, z, 0, 0, 0, 0.72, 0.6, 0.6);
    if (d < -0.15) return d;
    for (let s = -1; s <= 1; s += 2) {
      d = smin(d, sdEll(x, y, z, s * 0.4, -0.18, 0.14, 0.36, 0.26, 0.3), 0.14); // cheek fluff
      d = smin(d, sdEll(x, y, z, s * 0.09, -0.19, 0.48, 0.14, 0.11, 0.12), 0.07); // whisker pad
    }
    return smin(d, sdEll(x, y, z, 0, -0.29, 0.45, 0.11, 0.08, 0.09), 0.07); // chin
  }

  // Head vertex extras: [ear bend weight (signed by side), pink inner-ear
  // tint, white]. White: the muzzle patch and two little eyebrow spots.
  function headExtras(x, y, z) {
    let white = 0;
    if (z > 0.25) {
      const muzzle = sdEll(x, y, z, 0, -0.19, 0.5, 0.28, 0.2, 0.21);
      const brow = Math.min(sdEll(x, y, z, -0.21, 0.27, 0.52, 0.06, 0.04, 0.06), sdEll(x, y, z, 0.21, 0.27, 0.52, 0.06, 0.04, 0.06));
      white = 1 - smoothstep(-0.015, 0.015, Math.min(muzzle, brow));
    }
    // soft round blush patch on each cheek, outside the white muzzle
    let blush = 0;
    if (z > 0.2) {
      const cheek = Math.min(sdEll(x, y, z, -0.42, -0.12, 0.42, 0.13, 0.09, 0.2), sdEll(x, y, z, 0.42, -0.12, 0.42, 0.13, 0.09, 0.2));
      blush = (1 - smoothstep(-0.06, 0.05, cheek)) * (1 - white);
    }
    for (let s = -1; s <= 1; s += 2) {
      const p = earParts(x, y, z, s);
      if (p.outer > 0.06) continue;
      // Bend weight only for the part of the ear that stands out from the
      // face: the face surface round the ear's base must stay put, or it
      // swells outward whenever the ear turns.
      const w = smoothstep(-0.02, 0.16, p.ly) * (1 - smoothstep(0.02, 0.06, p.outer)) * smoothstep(0.005, 0.08, faceSDF(x, y, z));
      const tint = (1 - smoothstep(0.0, 0.035, Math.abs(p.inner))) * smoothstep(0.0, 0.08, p.ly) * (p.outer < 0.03 ? 1 : 0);
      return [s * w, tint, white, blush];
    }
    return [0, 0, white, blush];
  }

  // Runs a generator in ~8ms slices between frames, so building the meshes
  // (a few hundred ms on a phone) never freezes the page.
  // Yields via MessageChannel rather than setTimeout: no 4ms clamp, and not
  // throttled to once a second when the page loads in a background tab.
  function runSliced(gen) {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      function slice() {
        const end = performance.now() + 8;
        let r;
        while (!(r = gen.next()).done) {
          if (performance.now() > end) return void ch.port2.postMessage(0);
        }
        ch.port1.onmessage = null;
        resolve(r.value);
      }
      ch.port1.onmessage = slice;
      slice();
    });
  }

  // Generator: yields after each z-slice; returns the BufferGeometry.
  function* surfaceNet(THREE, sdf, min, max, step, extras, aoFn) {
    const nx = Math.ceil((max[0] - min[0]) / step) + 1;
    const ny = Math.ceil((max[1] - min[1]) / step) + 1;
    const nz = Math.ceil((max[2] - min[2]) / step) + 1;
    const at = (i, j, k) => i + nx * (j + ny * k);
    const F = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) F[at(i, j, k)] = sdf(min[0] + i * step, min[1] + j * step, min[2] + k * step);
      yield;
    }

    const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const V = new Int32Array(nx * ny * nz).fill(-1);
    const pos = [];
    const nor = [];
    const ext = [];
    const aos = [];
    const cv = new Float32Array(8);
    const e = step * 0.25;
    for (let k = 0; k < nz - 1; k++) {
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          let inside = 0;
          for (let c = 0; c < 8; c++) {
            cv[c] = F[at(i + C[c][0], j + C[c][1], k + C[c][2])];
            if (cv[c] < 0) inside++;
          }
          if (inside === 0 || inside === 8) continue;
          let sx = 0, sy = 0, sz = 0, n = 0;
          for (const [a, b] of E) {
            if (cv[a] < 0 === cv[b] < 0) continue;
            const t = cv[a] / (cv[a] - cv[b]);
            sx += C[a][0] + t * (C[b][0] - C[a][0]);
            sy += C[a][1] + t * (C[b][1] - C[a][1]);
            sz += C[a][2] + t * (C[b][2] - C[a][2]);
            n++;
          }
          let x = min[0] + (i + sx / n) * step;
          let y = min[1] + (j + sy / n) * step;
          let z = min[2] + (k + sz / n) * step;
          let gx = 0, gy = 0, gz = 0;
          for (let it = 0; it < 2; it++) {
            gx = sdf(x + e, y, z) - sdf(x - e, y, z);
            gy = sdf(x, y + e, z) - sdf(x, y - e, z);
            gz = sdf(x, y, z + e) - sdf(x, y, z - e);
            const gl = len3(gx, gy, gz) / (2 * e);
            if (it === 1 || gl < 1e-6) break;
            const d = sdf(x, y, z);
            // Newton step onto the surface, never more than half a cell.
            const move = clamp(d / (gl * gl), -step * 0.5, step * 0.5) / (2 * e);
            x -= gx * move;
            y -= gy * move;
            z -= gz * move;
          }
          const gl = len3(gx, gy, gz) || 1;
          V[at(i, j, k)] = pos.length / 3;
          pos.push(x, y, z);
          nor.push(gx / gl, gy / gl, gz / gl);
          if (extras) ext.push(extras(x, y, z));
          if (aoFn) aos.push(aoFn(x, y, z, gx / gl, gy / gl, gz / gl));
        }
        yield; // per row: with AO a whole slice can take longer than one frame
      }
      yield;
    }

    const idx = [];
    const quad = (a, b, c, d, out) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (out) idx.push(a, b, c, a, c, d);
      else idx.push(a, c, b, a, d, c);
    };
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const inA = F[at(i, j, k)] < 0;
          if (i < nx - 1 && j > 0 && k > 0 && inA !== F[at(i + 1, j, k)] < 0)
            quad(V[at(i, j - 1, k - 1)], V[at(i, j, k - 1)], V[at(i, j, k)], V[at(i, j - 1, k)], inA);
          if (j < ny - 1 && i > 0 && k > 0 && inA !== F[at(i, j + 1, k)] < 0)
            quad(V[at(i - 1, j, k - 1)], V[at(i - 1, j, k)], V[at(i, j, k)], V[at(i, j, k - 1)], inA);
          if (k < nz - 1 && i > 0 && j > 0 && inA !== F[at(i, j, k + 1)] < 0)
            quad(V[at(i - 1, j - 1, k)], V[at(i, j - 1, k)], V[at(i, j, k)], V[at(i - 1, j, k)], inA);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    if (aoFn) geo.setAttribute("aAO", new THREE.Float32BufferAttribute(aos, 1));
    if (extras) {
      geo.setAttribute("aEar", new THREE.Float32BufferAttribute(ext.map((v) => v[0]), 1));
      geo.setAttribute("aTint", new THREE.Float32BufferAttribute(ext.map((v) => v[1]), 1));
      geo.setAttribute("aWhite", new THREE.Float32BufferAttribute(ext.map((v) => v[2] || 0), 1));
      geo.setAttribute("aBlush", new THREE.Float32BufferAttribute(ext.map((v) => v[3] || 0), 1));
    }
    geo.setIndex(idx);
    return geo;
  }


  // ---------- the sitting body ----------
  // The cat stays sitting, so its body, legs, paws and neck can be one smooth
  // mesh: every part is merged with a smooth minimum into a single distance
  // field (like the head), so legs flow into the chest and haunches with no
  // seams. Coordinates: cat root, floor at y = 0, facing +z.

  // Torso in its own frame (origin at the hips, +z towards the shoulders),
  // pitched up around the hips for the sitting pose.
  const HIP_Y = 0.36;
  const HIP_Z = -0.2;
  const PITCH = -0.6;
  const PC = Math.cos(PITCH);
  const PS = Math.sin(PITCH);
  function torsoPoint(lx, ly, lz) {
    return [lx, HIP_Y + ly * PC - lz * PS, HIP_Z + ly * PS + lz * PC];
  }
  function torsoSDF(x, y, z) {
    // Short and round: a well-fed cat.
    let d = sdEll(x, y, z, 0, 0.06, 0.26, 0.42, 0.4, 0.5); // body
    if (d < -0.12) return d; // deep inside: only the sign matters
    d = smin(d, sdEll(x, y, z, 0, 0.1, 0.48, 0.37, 0.38, 0.28), 0.15); // chest
    d = smin(d, sdEll(x, y, z, 0, -0.1, 0.26, 0.37, 0.3, 0.4), 0.15); // belly
    for (let s = -1; s <= 1; s += 2) d = smin(d, sdEll(x, y, z, s * 0.24, -0.02, 0.06, 0.3, 0.36, 0.36), 0.16); // haunch: wide, so it sits pear-shaped
    return d;
  }
  function sdCap(x, y, z, a, b, r) {
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const h = clamp((px * ux + py * uy + pz * uz) / (ux * ux + uy * uy + uz * uz), 0, 1);
    return len3(px - ux * h, py - uy * h, pz - uz * h) - r;
  }

  // Two-bone IK in plain arrays: from joint J towards target T with bone
  // lengths a, b, the middle joint bending towards `pole`. Returns the knee.
  function kneeFor(J, T, a, b, pole) {
    const v = [T[0] - J[0], T[1] - J[1], T[2] - J[2]];
    let d = len3(v[0], v[1], v[2]) || 1e-4;
    const dir = v.map((c) => c / d);
    d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const pd = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
    const perp = [pole[0] - dir[0] * pd, pole[1] - dir[1] * pd, pole[2] - dir[2] * pd];
    const pl = len3(perp[0], perp[1], perp[2]) || 1;
    return [0, 1, 2].map((i) => J[i] + dir[i] * a * cosA + (perp[i] / pl) * a * sinA);
  }

  // Plush legs: short and thick, ending in big round paws. Placed once.
  const LEGS = [];
  for (const s of [-1, 1]) {
    const fj = torsoPoint(s * 0.12, -0.18, 0.44);
    const fp = [s * 0.13, 0.09, 0.37];
    LEGS.push({ joint: fj, knee: kneeFor(fj, fp, 0.2, 0.2, [0, -0.1, -1]), paw: fp, rUp: 0.14, rLo: 0.125, k: 0.06 });
    const hj = torsoPoint(s * 0.15, -0.2, 0.06);
    const hp = [s * 0.24, 0.09, 0.12];
    LEGS.push({ joint: hj, knee: kneeFor(hj, hp, 0.17, 0.17, [0, 0.35, 1]), paw: hp, rUp: 0.17, rLo: 0.13, k: 0.09 });
  }
  const NECK_A = torsoPoint(0, 0.14, 0.45);
  const HEAD_POS = [0, 1.06, 0.15];
  const NECK_B = [HEAD_POS[0], HEAD_POS[1] - 0.12, HEAD_POS[2]];

  function bodySDF(x, y, z) {
    // torso: into its frame
    const dy = y - HIP_Y, dz = z - HIP_Z;
    let d = torsoSDF(x, dy * PC + dz * PS, -dy * PS + dz * PC);
    if (d < -0.12) return d;
    d = smin(d, sdCap(x, y, z, NECK_A, NECK_B, 0.27), 0.12); // neck, under the head
    for (const L of LEGS) {
      let leg = sdCap(x, y, z, L.joint, L.knee, L.rUp);
      leg = smin(leg, sdCap(x, y, z, L.knee, L.paw, L.rLo), 0.05);
      leg = smin(leg, sdEll(x, y, z, L.paw[0], L.paw[1] - 0.01, L.paw[2] + 0.04, 0.14, 0.1, 0.18), 0.03); // paw
      d = smin(d, leg, L.k);
    }
    return Math.max(d, -y); // sit flat on the floor
  }

  // Ambient occlusion from the distance fields: step out along the normal and
  // see how much nearby surface there is. The scene for the body includes the
  // head (roughly) and the floor; the head's includes the body and the floor.
  const HEAD_S = 0.8; // must match HEAD_SCALE in mount()
  function aoFrom(scene, x, y, z, nx, ny, nz) {
    let occ = 0, sca = 1;
    for (let i = 1; i <= 5; i++) {
      const h = 0.025 * i;
      occ += (h - scene(x + nx * h, y + ny * h, z + nz * h)) * sca;
      sca *= 0.7;
    }
    return clamp(1 - 3 * occ, 0, 1);
  }
  const headApprox = (x, y, z) => sdEll(x, y, z, HEAD_POS[0], HEAD_POS[1], HEAD_POS[2], 0.72 * HEAD_S, 0.6 * HEAD_S, 0.6 * HEAD_S);
  const bodyScene = (x, y, z) => Math.min(bodySDF(x, y, z), headApprox(x, y, z), y);
  const bodyAO = (x, y, z, nx, ny, nz) => aoFrom(bodyScene, x, y, z, nx, ny, nz);
  // head mesh is built in head space (scaled by HEAD_S about HEAD_POS)
  function headScene(lx, ly, lz) {
    const rx = HEAD_POS[0] + lx * HEAD_S, ry = HEAD_POS[1] + ly * HEAD_S, rz = HEAD_POS[2] + lz * HEAD_S;
    return Math.min(headSDF(lx, ly, lz), bodySDF(rx, ry, rz) / HEAD_S, ry / HEAD_S);
  }
  const headAO = (x, y, z, nx, ny, nz) => aoFrom(headScene, x, y, z, nx, ny, nz);

  function mount(avatar, opts) {
    const THREE = window.THREE;
    if (!THREE || !avatar) return false;
    opts = opts || {};

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch (err) {
      return false;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const accent = new THREE.Color(opts.accent || "#FF7A1A");
    const violet = new THREE.Color("#6F63FF");
    const V3 = THREE.Vector3;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ---------- renderer / camera ----------
    const canvas = renderer.domElement;
    canvas.className = "cat3d-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "button");
    canvas.setAttribute("aria-label", "แมวดำ — กดเพื่อลูบหัว");
    canvas.title = "ลูบ · คลิก";
    avatar.appendChild(canvas);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 2.58, 7.0); // framed for the 300px canvas
    camera.lookAt(0, 1.0, 0);

    function resize() {
      const w = canvas.clientWidth || 300;
      const h = canvas.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

    // ---------- materials ----------
    const light = new V3(-0.45, 0.75, 0.5).normalize();
    const shaded = (base, rimK, rim2K = 0.45, extra) =>
      new THREE.ShaderMaterial({
        uniforms: Object.assign(
          {
            uObjScale: { value: 1 },
            uBase: { value: new THREE.Color(base) },
            uRim: { value: accent },
            uRim2: { value: violet.clone().multiplyScalar(rim2K) },
            uRimK: { value: rimK },
            uLight: { value: light },
          },
          extra && extra.uniforms
        ),
        defines: (extra && extra.defines) || {},
        vertexShader: FUR_VERT,
        fragmentShader: FUR_FRAG,
      });
    // One fur look for the whole cat: body, tail and head share these values,
    // so no part reads as a different material.
    const FUR = "#17110E";
    const FUR_RIM = 0.8;
    const FUR_RIM2 = 0.45;
    const furMat = shaded(FUR, FUR_RIM, FUR_RIM2);
    furMat.side = THREE.DoubleSide; // the tail tube is open where it starts inside the body
    const bodyMat = shaded(FUR, FUR_RIM, FUR_RIM2, { defines: { USE_AO: "" } });
    const HEAD_SCALE = 0.8;
    const headMat = shaded(FUR, FUR_RIM, FUR_RIM2, {
      defines: { USE_TINT: "", USE_EARS: "", USE_AO: "" },
      uniforms: {
        uTint: { value: new THREE.Color("#E58E9F") },
        uWhite: { value: new THREE.Color("#EDE6DF") },
        uBlushCol: { value: new THREE.Color("#FF7F9C") },
        uBlush: { value: 0 },
        uEarL: { value: new THREE.Vector2() },
        uEarR: { value: new THREE.Vector2() },
        uPivL: { value: new V3(-EAR_BASE[0], EAR_BASE[1], EAR_BASE[2]) },
        uPivR: { value: new V3(EAR_BASE[0], EAR_BASE[1], EAR_BASE[2]) },
      },
    });
    headMat.uniforms.uObjScale.value = HEAD_SCALE; // same noise size as the body
    const lidMat = shaded(FUR, FUR_RIM, FUR_RIM2);
    lidMat.uniforms.uObjScale.value = HEAD_SCALE * 0.45;
    lidMat.side = THREE.DoubleSide;
    const collarMat = shaded(accent.clone().multiplyScalar(0.75), 0.5, 0.2);
    const bellMat = shaded("#D9A93A", 0.7, 0.2);
    const noseMat = shaded("#E8909E", 0.2, 0.1);
    const eyeMat = new THREE.ShaderMaterial({
      uniforms: { uPupil: { value: new THREE.Vector2() }, uPupilW: { value: 0.5 }, uPupilH: { value: 0.5 }, uR: { value: 0.15 } },
      vertexShader: EYE_VERT,
      fragmentShader: EYE_FRAG,
    });
    const happyEyeMat = new THREE.MeshBasicMaterial({ color: "#FFD23F" });
    const mouthMat = new THREE.MeshBasicMaterial({ color: "#3A2A26" });

    const add = (parent, geo, mat, pos, scale, rot) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (scale) m.scale.set(scale[0], scale[1], scale[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(m);
      return m;
    };
    const sphere = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);

    // ---------- floor shadow ----------
    const shadowMat = new THREE.MeshBasicMaterial({
      map: canvasTexture(THREE, 128, (g, s) => {
        const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0, "rgba(0,0,0,0.75)");
        grd.addColorStop(0.5, "rgba(0,0,0,0.4)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
      }),
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    scene.add(shadow);

    // ---------- the cat ----------
    const cat = new THREE.Group(); // root on the floor: hop
    scene.add(cat);
    const body = new THREE.Group(); // breathing (scaled about the floor)
    cat.add(body);
    const bodyMesh = new THREE.Mesh(new THREE.BufferGeometry(), bodyMat); // filled once built
    body.add(bodyMesh);

    // Collar round the neck, with a little bell.
    const collar = new THREE.Group();
    add(collar, new THREE.TorusGeometry(0.285, 0.03, 10, 48), collarMat, null, null, [Math.PI / 2, 0, 0]);
    const bell = new THREE.Group();
    bell.position.set(0, -0.02, 0.295);
    add(bell, sphere(0.055, 18, 12), bellMat, [0, -0.05, 0]);
    collar.add(bell);
    const neckDir = new V3(NECK_B[0] - NECK_A[0], NECK_B[1] - NECK_A[1], NECK_B[2] - NECK_A[2]);
    collar.position.set(NECK_A[0], NECK_A[1], NECK_A[2]).addScaledVector(neckDir, 0.45);
    collar.quaternion.setFromUnitVectors(new V3(0, 1, 0), neckDir.clone().normalize());
    body.add(collar);

    // Head (pivot at its centre): big and round, it's that kind of cat.
    const head = new THREE.Group();
    head.scale.setScalar(HEAD_SCALE);
    cat.add(head);
    const headMesh = new THREE.Mesh(new THREE.BufferGeometry(), headMat);
    head.add(headMesh);

    // Eyes: big and round, with an upper lid that does most of the acting
    // (smug half-lid, wide, slow blink, sleepy).
    const EYE_R = 0.15;
    const eyeGroups = [];
    const lids = [];
    const happyEyes = [];
    const irisGeo = sphere(EYE_R, 40, 24);
    const lidGeo = new THREE.SphereGeometry(EYE_R * 1.1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.26, 0.03, 0.52);
      eye.rotation.set(0, s * 0.3, 0);
      const scaled = new THREE.Group();
      scaled.scale.set(1, 1, 0.45);
      eye.add(scaled);
      add(scaled, irisGeo, eyeMat);
      lids.push(add(scaled, lidGeo, lidMat));
      head.add(eye);
      eyeGroups.push(eye);
      const arc = add(head, new THREE.TorusGeometry(0.11, 0.028, 10, 28, Math.PI), happyEyeMat, [s * 0.26, 0.01, 0.6], null, [0, s * 0.3, 0]);
      arc.visible = false;
      happyEyes.push(arc);
    }
    add(head, sphere(0.055, 18, 12), noseMat, [0, -0.115, 0.6], [1.35, 0.85, 0.8]);
    const mouthGeo = new THREE.TorusGeometry(0.045, 0.011, 6, 16, Math.PI);
    const mouthLines = [-1, 1].map((s) => add(head, mouthGeo, mouthMat, [s * 0.045, -0.19, 0.605], null, [0, 0, Math.PI]));
    // Open mouth: a dark oval with a pink tongue, scaled open for yawns and
    // sneezes (0 = shut).
    const mouthOpen = new THREE.Group();
    mouthOpen.position.set(0, -0.215, 0.6);
    add(mouthOpen, sphere(0.1, 24, 16), new THREE.MeshBasicMaterial({ color: "#2A1213" }), null, [0.8, 1.2, 0.3]);
    add(mouthOpen, sphere(0.06, 20, 12), new THREE.MeshBasicMaterial({ color: "#E8798C" }), [0, -0.05, 0.02], [1.1, 0.7, 0.5]);
    mouthOpen.scale.setScalar(0.001);
    mouthOpen.visible = false;
    head.add(mouthOpen);

    // Sunglasses (Konami code). Every part sits in one plane in front of the
    // face, so nothing z-fights: each frame ring wraps its lens's rim (the lens
    // is a thin disc centred on the ring's plane), the bridge's ends are buried
    // in both rings, and the arms run back from the rings into the head.
    const shades = new THREE.Group();
    const lensMat = shaded('#0B0909', 0.9, 0.6);
    const glintMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55 });
    const GZ = 0.645; // the glasses' plane
    const LX = 0.25, LY = 0.03, RX = 0.17, RY = 0.13; // lens centre / half-size
    const bar = (a, b, r) => {
      const d = new V3().subVectors(b, a);
      const m = add(shades, new THREE.CylinderGeometry(r, r, d.length(), 10), collarMat);
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
      return m;
    };
    for (const s of [-1, 1]) {
      add(shades, sphere(1, 32, 16), lensMat, [s * LX, LY, GZ], [RX, RY, 0.035]);
      // accent frame, so the glasses read on a black face
      add(shades, new THREE.TorusGeometry(1, 0.11, 10, 48), collarMat, [s * LX, LY, GZ], [RX, RY, RX]);
      add(shades, sphere(0.03, 12, 8), glintMat, [s * LX - 0.06, LY + 0.045, GZ + 0.036], [1.6, 0.6, 0.3]);
      // arm: from the outer edge of the frame back into the head
      bar(new V3(s * (LX + RX - 0.01), LY + 0.03, GZ), new V3(s * 0.52, LY + 0.08, 0.12), 0.014);
    }
    // bridge, a little longer than the gap so its ends sit inside the frames
    bar(new V3(-(LX - RX) - 0.02, LY + 0.03, GZ), new V3(LX - RX + 0.02, LY + 0.03, GZ), 0.017);
    shades.visible = false;
    head.add(shades);
    // Whiskers: thin tapered tubes rather than 1px lines, so they keep the
    // same weight on every screen and pixel density.
    const whiskerMat = new THREE.MeshBasicMaterial({ color: "#F4EEE8", transparent: true, opacity: 0.85 });
    for (const s of [-1, 1]) {
      for (const k of [-1, 0, 1]) {
        const curve = new THREE.QuadraticBezierCurve3(
          new V3(s * 0.2, -0.17 + k * 0.035, 0.545), // just under the skin: no blunt tube end showing
          new V3(s * 0.62, -0.1 + k * 0.07, 0.52),
          new V3(s * 1.0, -0.14 + k * 0.13, 0.38)
        );
        const SEG = 16, RAD = 5;
        const geo = new THREE.TubeGeometry(curve, SEG, 0.012, RAD, false);
        const pos = geo.attributes.position;
        for (let i = 0; i <= SEG; i++) {
          const c = curve.getPointAt(i / SEG);
          const taper = 1 - 0.75 * (i / SEG);
          for (let j = 0; j <= RAD; j++) {
            const n = i * (RAD + 1) + j;
            pos.setXYZ(n, c.x + (pos.getX(n) - c.x) * taper, c.y + (pos.getY(n) - c.y) * taper, c.z + (pos.getZ(n) - c.z) * taper);
          }
        }
        head.add(new THREE.Mesh(geo, whiskerMat));
      }
    }

    // ---------- tail ----------
    // A smooth tapered tube along a Catmull-Rom curve, re-bent every frame
    // into one preallocated buffer, with a rounded cap on the tip.
    const TAIL_SEG = 40;
    const TAIL_RAD = 12;
    const tailRadius = (u) => 0.13 * (1 - 0.55 * u * u);
    const tailPts = [0, 1, 2, 3, 4].map(() => new V3());
    const tailCurve = new THREE.CatmullRomCurve3(tailPts, false, "centripetal");
    const ring = TAIL_RAD + 1;
    const tailPos = new Float32Array((TAIL_SEG + 1) * ring * 3);
    const tailNor = new Float32Array(tailPos.length);
    const tailIdx = [];
    for (let i = 0; i < TAIL_SEG; i++) {
      for (let j = 0; j < TAIL_RAD; j++) {
        const a = i * ring + j;
        const b = a + ring;
        tailIdx.push(a, a + 1, b, b, a + 1, b + 1); // outward-facing winding
      }
    }
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute("position", new THREE.BufferAttribute(tailPos, 3));
    tailGeo.setAttribute("normal", new THREE.BufferAttribute(tailNor, 3));
    tailGeo.setIndex(tailIdx);
    const tailMesh = add(cat, tailGeo, furMat);
    tailMesh.frustumCulled = false;
    const tailTip = add(cat, sphere(1, 18, 12), furMat);
    const P = new V3();
    const T = new V3();
    const N = new V3();
    const B = new V3();
    const D = new V3();
    function bendTail() {
      B.set(1, 0, 0); // parallel-transport-ish frames along the curve
      for (let i = 0; i <= TAIL_SEG; i++) {
        const u = i / TAIL_SEG;
        tailCurve.getPoint(u, P);
        tailCurve.getTangent(u, T);
        N.crossVectors(B, T).normalize();
        B.crossVectors(T, N).normalize();
        const r = tailRadius(u);
        for (let j = 0; j <= TAIL_RAD; j++) {
          const a = (j / TAIL_RAD) * Math.PI * 2;
          D.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
          const k = (i * ring + j) * 3;
          tailNor[k] = D.x;
          tailNor[k + 1] = D.y;
          tailNor[k + 2] = D.z;
          tailPos[k] = P.x + D.x * r;
          tailPos[k + 1] = P.y + D.y * r;
          tailPos[k + 2] = P.z + D.z * r;
        }
      }
      tailGeo.attributes.position.needsUpdate = true;
      tailGeo.attributes.normal.needsUpdate = true;
      tailTip.position.copy(P);
      tailTip.scale.setScalar(tailRadius(1));
    }
    // Curled round the right side on the floor; starts well inside the body
    // so its open end never shows.
    const TAIL_REST = [torsoPoint(0, 0.1, 0.0), [0.42, 0.09, -0.36], [0.68, 0.08, -0.05], [0.64, 0.08, 0.3], [0.44, 0.09, 0.52]];

    // ---------- state ----------
    let lookX = 0, lookY = 0, tx = 0, ty = 0;
    let lastPointerAt = 0;
    let hovering = false;
    let happy = 0, happyUntil = 0;
    let excited = 0, wantExcited = false;
    let sleepy = 0;
    let purr = 0;
    let blinkAt = -1e9, doubleBlinkAt = 0;
    const twitchAt = [-1e9, -1e9];
    let hop = -1;
    let tailPhase = 0, breathPhase = 0;
    const t0 = performance.now();
    let nextBlink = t0 + rand(1500, 4000);
    let nextTwitch = t0 + rand(3000, 7000);
    let nextWander = t0;
    const headPos = new V3();
    // Character: aloof and a bit smug by default (half-lidded, side-eye
    // glances), attentive when you move, clingy when petted (blush, purr,
    // head rubs) and it gives you slow blinks -- cat for "I like you".
    let attentive = 0;
    let glanceX = 0, glanceY = 0, gx = 0, gy = 0;
    let slowBlinkAt = -1e9;
    let nextSlowBlink = t0 + rand(6000, 12000);
    let rub = 0;
    // actions
    let yawnAt = -1e9;
    let nextYawn = t0 + rand(8000, 20000);
    let asleep = false;
    let sleep = 0; // 0 awake .. 1 asleep (eased)
    let wokeAt = -1e9;
    let nextZ = 0;
    let sneezeAt = -1e9;
    const clicks = [];
    const YAWN_MS = 2300;
    const SNEEZE_MS = 1500;
    // Idle this long: drowsy (and a yawn), then asleep. Doubled on touch-only
    // devices, where only taps and scrolls count as activity.
    const DROWSY_MS = canHover ? 15000 : 30000;
    const SLEEP_MS = canHover ? 25000 : 50000;
    // easter eggs
    let meowAt = -1e9;
    const MEOW_MS = 900;
    let shadesOn = false;
    let shadesAt = -1e9; // when they went on / off
    let shadesOffTimer = 0;
    let petFor = 0; // seconds of continuous petting
    let loveAt = -1e9;

    // ---------- input ----------
    function lookAtPoint(e) {
      lastPointerAt = performance.now();
      const r = canvas.getBoundingClientRect();
      head.getWorldPosition(headPos).project(camera);
      const dx = e.clientX - (r.left + (headPos.x * 0.5 + 0.5) * r.width);
      const dy = e.clientY - (r.top + (0.5 - headPos.y * 0.5) * r.height);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 250);
      tx = (dx / dist) * reach;
      ty = (dy / dist) * reach;
      start();
    }
    window.addEventListener("pointermove", lookAtPoint, { passive: true });
    window.addEventListener("pointerdown", lookAtPoint, { passive: true }); // a tap on a phone
    // Scrolling counts as activity too; the cat glances down at the links.
    window.addEventListener(
      "scroll",
      () => {
        lastPointerAt = performance.now();
        if (!hovering) {
          tx = 0;
          ty = 0.7;
        }
        start();
      },
      { passive: true }
    );

    // Hovering counts only over the cat itself, not the whole (wide) canvas.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitTargets = [bodyMesh, headMesh];
    function overCat(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(hitTargets, false).length > 0;
    }
    // Mouse hover with a short grace period: near the cat's outline (and as
    // its head nuzzles under the pointer) the hit test flips on and off from
    // one move to the next, which flickered the ^ ^ eyes. It only counts as
    // leaving once the pointer has been off the cat for HOVER_GRACE ms.
    const HOVER_GRACE = 300;
    let mouseOver = false;
    let lastHitAt = -1e9;
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return void stroke(e);
      if (!canHover) return;
      mouseOver = overCat(e);
      if (mouseOver) lastHitAt = performance.now();
      if (mouseOver && hovering) purr = Math.min(1, purr + (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)) * 0.006);
      hovering = mouseOver || performance.now() - lastHitAt < HOVER_GRACE;
      canvas.style.cursor = hovering ? "pointer" : "";
    });
    canvas.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      mouseOver = false;
      lastHitAt = -1e9;
      hovering = false;
      canvas.style.cursor = "";
    });

    // Touch: a finger stroking the cat pets it (the same ^ ^, blush, purr
    // and head rub as hovering with a mouse); a quick tap boops it. A touch
    // that starts on the cat doesn't scroll the page; anywhere else on the
    // canvas, it scrolls as usual.
    let touch = null;
    let lastTouchTap = -1e9;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        if (e.touches.length === 1 && overCat(t)) e.preventDefault();
      },
      { passive: false }
    );
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch" || !overCat(e)) return;
      touch = { x: e.clientX, y: e.clientY, at: performance.now(), moved: 0 };
      hovering = true;
      lastPointerAt = performance.now();
      start();
    });
    function stroke(e) {
      if (!touch) return;
      const d = Math.hypot(e.clientX - touch.x, e.clientY - touch.y);
      touch.moved += d;
      touch.x = e.clientX;
      touch.y = e.clientY;
      lastPointerAt = performance.now();
      hovering = overCat(e);
      if (hovering) purr = Math.min(1, purr + d * 0.012);
    }
    function endTouch(e, cancelled) {
      if (!touch || e.pointerType !== "touch") return;
      const now = performance.now();
      if (!cancelled && touch.moved < 12 && now - touch.at < 350) {
        lastTouchTap = now;
        boop();
      } else {
        happyUntil = Math.max(happyUntil, now + 900); // stays pleased for a moment
      }
      touch = null;
      hovering = false;
    }
    canvas.addEventListener("pointerup", (e) => endTouch(e, false));
    canvas.addEventListener("pointercancel", (e) => endTouch(e, true));

    function hearts(count = 3, spread = 40) {
      // Pop them from where the cat's head is.
      head.getWorldPosition(headPos).project(camera);
      const cr = canvas.getBoundingClientRect();
      const ar = avatar.getBoundingClientRect();
      const hx = cr.left - ar.left + (headPos.x * 0.5 + 0.5) * cr.width;
      const hy = cr.top - ar.top + (0.5 - headPos.y * 0.5) * cr.height - 40;
      for (let i = 0; i < count; i++) {
        const h = document.createElement("span");
        h.className = "heart-pop";
        h.innerHTML = HEART;
        h.style.left = `${hx}px`;
        h.style.top = `${hy}px`;
        h.style.setProperty("--hx", `${Math.round(rand(-spread, spread))}px`);
        h.style.setProperty("--hr", `${Math.round(rand(-25, 25))}deg`);
        h.style.animationDelay = `${i * 90}ms`;
        avatar.appendChild(h);
        setTimeout(() => h.remove(), 1300 + i * 90);
      }
    }

    // A word floating up from the cat's head: "z" while asleep, the sneeze.
    function bubble(text, cls, dx, life) {
      head.getWorldPosition(headPos).project(camera);
      const cr = canvas.getBoundingClientRect();
      const ar = avatar.getBoundingClientRect();
      const b = document.createElement("span");
      b.className = cls;
      b.textContent = text;
      b.setAttribute("aria-hidden", "true");
      b.style.left = `${cr.left - ar.left + (headPos.x * 0.5 + 0.5) * cr.width + dx}px`;
      b.style.top = `${cr.top - ar.top + (0.5 - headPos.y * 0.5) * cr.height - 50}px`;
      avatar.appendChild(b);
      setTimeout(() => b.remove(), life);
    }

    // Click / Enter: a happy little hop with hearts -- or, three quick clicks,
    // a sneeze. Asleep, it just wakes up.
    function boop() {
      const now = performance.now();
      lastPointerAt = now; // wake up
      if (asleep) return void start();
      clicks.push(now);
      while (clicks.length && now - clicks[0] > 1200) clicks.shift();
      if (clicks.length >= 3 && !reduceMotion && now - sneezeAt > SNEEZE_MS) {
        clicks.length = 0;
        sneezeAt = now;
        yawnAt = -1e9;
        setTimeout(() => bubble("ฮัดชิ่ว!", "cat-bubble cat-sneeze", 30, 1400), 650);
        return void start();
      }
      happyUntil = now + 1400;
      if (reduceMotion) return;
      hop = 0;
      hearts();
      start();
    }
    canvas.addEventListener("click", () => {
      if (performance.now() - lastTouchTap > 600) boop();
    });
    canvas.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        boop();
      }
    });

    // ---------- easter eggs ----------
    function meow() {
      const now = performance.now();
      lastPointerAt = now;
      if (asleep) return void start(); // wakes up first
      meowAt = now;
      happyUntil = now + 1200;
      bubble("เมี้ยว~", "cat-bubble cat-sneeze", 30, 1400);
      start();
    }
    function toggleShades() {
      const now = performance.now();
      lastPointerAt = now;
      shadesOn = !shadesOn;
      shadesAt = now;
      clearTimeout(shadesOffTimer);
      if (shadesOn) {
        bubble("โหมดเท่ 😎", "cat-bubble cat-sneeze", 30, 1600);
        shadesOffTimer = setTimeout(() => {
          shadesOn = false;
          shadesAt = performance.now();
          start();
        }, 20000);
      }
      start();
    }
    const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
    const keys = [];
    let typed = "";
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      const k = (e.key || "").toLowerCase();
      keys.push(k);
      if (keys.length > KONAMI.length) keys.shift();
      if (keys.length === KONAMI.length && keys.every((v, i) => v === KONAMI[i])) {
        keys.length = 0;
        toggleShades();
      }
      if (k.length === 1) {
        typed = (typed + k).slice(-12);
        if (typed.endsWith("meow") || typed.endsWith("เหมียว")) {
          typed = "";
          meow();
        }
      }
    });

    const links = opts.links;
    if (links) {
      links.addEventListener("pointerover", (e) => (wantExcited = !!e.target.closest(".cd:not(.cd-soon)")));
      links.addEventListener("pointerleave", () => (wantExcited = false));
      links.addEventListener("focusin", (e) => (wantExcited = !e.target.closest(".cd-soon")));
      links.addEventListener("focusout", () => (wantExcited = false));
    }

    // ---------- animation ----------
    function hopPose(u) {
      if (u < 0.16) return { y: 0, sq: 0.14 * Math.sin((u / 0.16) * Math.PI) };
      if (u < 0.84) {
        const k = Math.sin(((u - 0.16) / 0.68) * Math.PI);
        return { y: 0.32 * k, sq: -0.06 * k };
      }
      return { y: 0, sq: 0.1 * Math.sin(((u - 0.84) / 0.16) * Math.PI) };
    }

    function update(now, dt) {
      const t = reduceMotion ? 0 : (now - t0) / 1000;
      const idleFor = now - lastPointerAt;

      if (!reduceMotion) {
        if (now > nextBlink) {
          blinkAt = now;
          nextBlink = now + rand(2500, 6000);
          if (Math.random() < 0.25) doubleBlinkAt = now + 260;
        }
        if (doubleBlinkAt && now > doubleBlinkAt) {
          blinkAt = now;
          doubleBlinkAt = 0;
        }
        if (now > nextTwitch) {
          twitchAt[Math.random() < 0.5 ? 0 : 1] = now;
          nextTwitch = now + rand(4000, 9000);
        }
        if (idleFor > 3500 && now > nextWander) {
          const r = Math.random();
          if (r < 0.25) {
            tx = ty = 0;
            gx = gy = 0;
          } else if (r < 0.6) {
            // side-eye: head turned a little away, eyes rolled to the side and up
            const side = Math.random() < 0.5 ? -1 : 1;
            tx = -side * rand(0.15, 0.35);
            ty = rand(-0.2, 0.1);
            gx = side * 0.42;
            gy = 0.18;
          } else {
            tx = rand(-1, 1);
            ty = rand(-0.6, 0.8);
            gx = gy = 0;
          }
          nextWander = now + rand(1800, 3600);
        }
        if (idleFor < 1500) gx = gy = 0; // you moved: it looks right at you
        // yawn now and then, and once on getting drowsy
        const busy = now - yawnAt < YAWN_MS || now - sneezeAt < SNEEZE_MS || hop >= 0 || hovering;
        if (!asleep && !busy && (now > nextYawn || (idleFor > DROWSY_MS && idleFor - dt * 1000 <= DROWSY_MS))) {
          yawnAt = now;
          nextYawn = now + rand(8000, 20000);
        }
        // fall asleep / startle awake
        if (!asleep && idleFor > SLEEP_MS && !wantExcited && !busy) asleep = true;
        else if (asleep && idleFor < SLEEP_MS) {
          asleep = false;
          wokeAt = now;
        }
        if (asleep && sleep > 0.8 && now > nextZ) {
          bubble("z", "cat-bubble cat-z", 26 + rand(-6, 6), 2600);
          nextZ = now + 1300;
        }
        // slow blink now and then
        if (now > nextSlowBlink && !hovering) {
          slowBlinkAt = now;
          nextSlowBlink = now + rand(8000, 16000);
        }
      }

      // moods
      if (canHover && !touch && hovering && !mouseOver && now - lastHitAt >= HOVER_GRACE) {
        hovering = false;
        canvas.style.cursor = "";
      }
      happy = damp(happy, hovering || now < happyUntil ? 1 : 0, 10, dt);
      excited = damp(excited, wantExcited ? 1 : 0, 10, dt);
      sleepy = damp(sleepy, !reduceMotion && idleFor > DROWSY_MS && !wantExcited ? 1 : 0, idleFor > DROWSY_MS ? 0.6 : 6, dt);
      sleep = damp(sleep, asleep ? 1 : 0, asleep ? 1.2 : 10, dt);
      purr = Math.max(0, purr - dt * 0.7);
      attentive = damp(attentive, idleFor < 1500 || wantExcited ? 1 : 0, idleFor < 1500 ? 6 : 1.5, dt);
      glanceX = damp(glanceX, gx, 6, dt);
      glanceY = damp(glanceY, gy, 6, dt);
      rub = damp(rub, hovering ? Math.min(1, purr * 2) : 0, 4, dt);
      // easter egg: keep petting ~4 s and it bursts into hearts
      petFor = hovering && purr > 0.35 ? petFor + dt : Math.max(0, petFor - dt * 2);
      if (petFor > 4 && now - loveAt > 12000 && !reduceMotion) {
        loveAt = now;
        petFor = 0;
        hearts(9, 70);
        bubble("รักนะ ♥", "cat-bubble cat-sneeze", 30, 1600);
      }

      // ---- action curves ----
      const ease = (a, b, v) => smoothstep(a, b, v);
      // yawn: head back, eyes shut, mouth wide, then a little chomp
      const yu = (now - yawnAt) / YAWN_MS;
      const yawn = yu >= 0 && yu < 1 ? ease(0, 0.3, yu) * (1 - ease(0.72, 0.9, yu)) : 0;
      const chomp = yu >= 0.88 && yu < 1 ? Math.sin(((yu - 0.88) / 0.12) * Math.PI) * 0.25 : 0;
      // sneeze: "ah..." (head back, squint, mouth a bit open) then "choo!"
      // (head snaps down, ears flick), then a shake of the head
      const zu = (now - sneezeAt) / SNEEZE_MS;
      const ah = zu >= 0 && zu < 0.45 ? ease(0, 0.4, zu) : 0;
      const choo = zu >= 0.43 && zu < 0.62 ? Math.sin(((zu - 0.43) / 0.19) * Math.PI) : 0;
      const shake = zu >= 0.6 && zu < 1 ? Math.sin(((zu - 0.6) / 0.4) * Math.PI * 4) * (1 - (zu - 0.6) / 0.4) : 0;
      // startle on waking: a jolt, ears up, eyes wide
      const wu = (now - wokeAt) / 900;
      const startle = wu >= 0 && wu < 1 ? 1 - wu : 0;
      const mu = (now - meowAt) / MEOW_MS;
      const meowOpen = mu >= 0 && mu < 1 ? Math.sin(Math.min(1, mu / 0.7) * Math.PI) * 0.75 : 0;
      const open = Math.max(yawn, ah * 0.35, chomp, meowOpen);
      mouthOpen.visible = open > 0.01;
      mouthOpen.scale.set(0.6 + 0.4 * open, Math.max(0.001, open), 1);
      for (const m of mouthLines) m.visible = open < 0.3;

      // breathing (slower and deeper when sleepy or asleep), scaled about the floor
      if (!reduceMotion) breathPhase += dt * (2.2 - 0.9 * sleepy - 0.5 * sleep);
      const br = Math.sin(breathPhase) * (0.012 + 0.01 * sleepy + 0.012 * sleep) + 0.03 * yawn;
      body.scale.set(1 + br * 0.6, 1 + br, 1 + br * 0.3);

      // ---- head ----
      const lk = reduceMotion ? 40 : 7;
      lookX = damp(lookX, asleep ? 0 : tx, lk, dt);
      lookY = damp(lookY, asleep ? 0 : ty, lk, dt);
      head.position.set(HEAD_POS[0], HEAD_POS[1] + Math.sin(breathPhase - 0.6) * 0.01 - 0.04 * sleep + 0.03 * startle, HEAD_POS[2] + 0.03 * choo);
      // head rub when petted: a slow side-to-side nuzzle
      const nuzzle = Math.sin(breathPhase * 1.6) * 0.22 * rub;
      const smugTilt = 0.1 * (1 - attentive) * (1 - happy) * Math.sign(glanceX || 1) * Math.min(1, Math.abs(glanceX) * 3);
      // asleep: head drooped and tipped, with a slow nod
      const nod = sleep * (0.28 + Math.sin(breathPhase * 0.5) * 0.04);
      head.rotation.set(
        lookY * 0.3 + sleepy * 0.12 * (1 - sleep) - 0.08 * rub + nod - 0.32 * yawn - 0.25 * ah + 0.42 * choo - 0.18 * meowOpen,
        lookX * 0.55 + 0.25 * shake,
        -lookX * 0.1 + sleepy * 0.08 + 0.12 * sleep + nuzzle + smugTilt
      );
      eyeMat.uniforms.uPupil.value.set(clamp(lookX * 0.2 + glanceX, -0.45, 0.45), clamp(-lookY * 0.16 + glanceY, -0.4, 0.4));

      // ---- face ----
      const isHappy = happy > 0.5 && sleep < 0.3 && open < 0.1;
      headMat.uniforms.uBlush.value = Math.max(happy, rub) * (1 - sleep); // pink cheeks when affectionate
      // sunglasses slide down onto the nose / back up off the head
      const gu = clamp((now - shadesAt) / 450, 0, 1);
      const gk = shadesOn ? 1 - Math.pow(1 - gu, 3) : 1 - gu * gu;
      shades.visible = gk > 0.01;
      shades.position.y = (1 - gk) * 0.6;
      const bu = (now - blinkAt) / 170;
      const blink = bu >= 0 && bu < 1 ? Math.sin(bu * Math.PI) : 0;
      // slow blink: close over ~0.5s, hold, reopen
      const su = (now - slowBlinkAt) / 1500;
      const slow = su >= 0 && su < 1 ? Math.min(1, Math.sin(su * Math.PI) * 1.6) : 0;
      // lid angle: -0.45 smug half-lid, -0.95 attentive, -1.35 wide, 1.57 shut
      let lid = lerp(-0.45, -0.95, attentive);
      lid = lerp(lid, -1.35, excited);
      lid = lerp(lid, 0.15, sleepy);
      lid = lerp(lid, -1.4, startle);
      lid = lerp(lid, 1.2, slow);
      lid = lerp(lid, 1.55, Math.max(sleep, yawn, ah * 0.8, choo));
      lid = lerp(lid, 1.57, blink);
      const pupil = 0.5 + 0.22 * excited + 0.06 * attentive - 0.1 * sleepy + 0.2 * startle;
      eyeMat.uniforms.uPupilW.value = pupil;
      eyeMat.uniforms.uPupilH.value = pupil * 1.04;
      for (let i = 0; i < 2; i++) {
        eyeGroups[i].visible = !isHappy && gk < 0.5; // behind the sunglasses: hidden (they bulge past the lenses side-on)
        happyEyes[i].visible = isHappy && gk < 0.5;
        lids[i].rotation.x = lid;
      }
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? -1 : 1;
        const tw = (now - twitchAt[i]) / 380;
        const flick = tw >= 0 && tw < 1 ? Math.sin(tw * Math.PI * 2) * (1 - tw) * 0.5 : 0;
        const rotZ = -s * (0.22 * happy + 0.12 * sleepy + 0.12 * sleep + 0.3 * yawn - 0.08 * excited - 0.15 * startle + flick * 0.6 + 0.4 * choo);
        const rotX = -flick * 0.5 - 0.15 * happy + 0.1 * excited - 0.35 * yawn + 0.2 * startle - 0.3 * choo + 0.15 * meowOpen;
        headMat.uniforms[i === 0 ? "uEarL" : "uEarR"].value.set(rotX, rotZ);
      }

      // ---- tail ----
      // The sway phase is accumulated (not sin(t * speed)) so a change of
      // speed never makes the tail snap.
      const w = (1.3 + happy * 2.2 + excited * 0.8) * (1 - 0.5 * sleepy) * (1 - 0.8 * sleep);
      if (!reduceMotion) tailPhase += dt * w;
      const ph = tailPhase;
      const amp = 1 + happy * 0.7;
      for (let i = 0; i <= 4; i++) tailPts[i].set(TAIL_REST[i][0], TAIL_REST[i][1], TAIL_REST[i][2]);
      tailPts[3].x += Math.sin(ph) * 0.05 * amp;
      tailPts[4].x += Math.sin(ph - 0.8) * 0.1 * amp;
      tailPts[4].z += Math.sin(ph - 0.2) * 0.08 * amp;
      tailPts[4].y += Math.max(0, Math.sin(ph * 0.5)) * 0.06 * amp; // the tip lifts and flicks
      bendTail();

      // ---- hop / purr ----
      let y = 0, sq = 0;
      if (hop >= 0) {
        hop += dt / 0.6;
        if (hop >= 1) hop = -1;
        else ({ y, sq } = hopPose(hop));
      }
      cat.position.y = y + 0.04 * startle * Math.sin(startle * Math.PI);
      cat.position.z = 0.03 * choo;
      sq += 0.06 * choo;
      cat.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
      bell.rotation.z = Math.sin(t * 9) * (hop >= 0 ? 0.5 : 0.05 + 0.1 * happy);

      const sh = Math.max(0.4, 1 - y * 0.9);
      shadow.scale.set(sh, sh * 0.9, 1);
      shadowMat.opacity = sh;
    }

    // ---------- loop (paused off-screen / in a background tab) ----------
    let last = performance.now();
    let raf = 0;
    let onScreen = true;
    let built = false; // nothing to draw until the smooth meshes exist
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(now, dt);
      renderer.render(scene, camera);
      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function start() {
      if (raf || !built || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) start();
    });

    // Build the smooth body and head between frames, then fade the cat in.
    // The boxes must enclose every part, or it gets cut open.
    runSliced(surfaceNet(THREE, bodySDF, [-0.72, -0.03, -0.66], [0.72, 1.02, 0.74], 0.022, null, bodyAO))
      .then((geo) => {
        bodyMesh.geometry = geo;
        return runSliced(surfaceNet(THREE, headSDF, [-0.9, -0.45, -0.66], [0.9, 0.98, 0.7], 0.022, headExtras, headAO));
      })
      .then((geo) => {
        headMesh.geometry = geo;
        built = true;
        update(performance.now(), 0);
        renderer.render(scene, camera);
        canvas.classList.add("ready");
        start();
      });
    return true;
  }

  window.Cat3D = { mount };
})();
