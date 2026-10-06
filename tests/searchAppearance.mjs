import assert from "node:assert/strict";
import fs from "node:fs";

function readPngSize(path) {
  const data = fs.readFileSync(path);
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} must be a PNG`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

const expectedPngs = new Map([
  ["public/favicon-48x48.png", [48, 48]],
  ["public/favicon-96x96.png", [96, 96]],
  ["public/apple-touch-icon.png", [180, 180]],
  ["public/pwa-192x192.png", [192, 192]],
  ["public/pwa-512x512.png", [512, 512]],
  ["public/logo-512x512.png", [512, 512]],
]);
for (const [path, expected] of expectedPngs) {
  assert.deepEqual(readPngSize(path), expected, `${path} has the wrong dimensions`);
}

const ico = fs.readFileSync("public/favicon.ico");
assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], "favicon.ico must be a real ICO file");
assert.ok(ico.readUInt16LE(4) >= 3, "favicon.ico must contain multiple sizes");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /<link rel="icon" type="image\/png" sizes="96x96" href="\/favicon-96x96\.png" \/>/);
assert.match(html, /<link rel="icon" type="image\/x-icon" href="\/favicon\.ico" \/>/);
assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png" \/>/);
const schemaMatch = html.match(/<script type="application\/ld\+json" id="site-schema">\s*([\s\S]*?)\s*<\/script>/);
assert.ok(schemaMatch, "site-schema JSON-LD is required");
const schema = JSON.parse(schemaMatch[1]);
const organization = schema["@graph"].find((entry) => entry["@type"] === "Organization");
assert.equal(organization.logo.url, "https://smmup.co.in/logo-512x512.png");
assert.equal(organization.logo.width, 512);
assert.equal(organization.logo.height, 512);

const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
assert.deepEqual(manifest.icons.map(({ src, sizes, type }) => ({ src, sizes, type })), [
  { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
]);
assert.match(fs.readFileSync("public/robots.txt", "utf8"), /User-agent: Googlebot-Image\s+Allow: \//);

console.log("Search appearance and favicon checks passed.");
