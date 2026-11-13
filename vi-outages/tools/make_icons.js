// Renders the app icons with the pre-installed Chromium. Run: node tools/make_icons.js
const { chromium } = require("playwright");
const path = require("path");
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#0f1b2d"/>
<g transform="translate(256 256) scale(${pad ? 0.72 : 0.9}) translate(-256 -256)">
<path d="M290 60 L140 290 H236 L206 452 L372 214 H270 Z" fill="#f5b731"/></g></svg>`;
(async () => {
  const b = await chromium.launch(); const out = path.join(__dirname, "..", "web", "icons");
  for (const [name, size, pad] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["maskable-512.png", 512, 1], ["apple-touch-icon.png", 180, 1]]) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:transparent">${svg(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
    await p.screenshot({ path: path.join(out, name), omitBackground: true }); await p.close();
  }
  await b.close();
})();
