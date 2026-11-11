"use strict";
// Staging-only same-origin static/proxy server. No arbitrary upstream input.
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const base = path.join(__dirname, "build");
http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/") || req.url === "/health") {
      const upstream = http.request(
        {
          hostname: "backend",
          port: 15051,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: "backend" },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.setTimeout(10000, () => upstream.destroy());
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let relative;
    try {
      relative = decodeURIComponent(
        new URL(req.url, "http://staging.invalid").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const file = path.resolve(base, "." + relative);
    if (!file.startsWith(base + path.sep) && file !== base) {
      res.writeHead(400);
      res.end();
      return;
    }
    const target =
      fs.existsSync(file) && fs.statSync(file).isFile()
        ? file
        : path.join(base, "index.html");
    const type =
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
      }[path.extname(target)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(target).pipe(res);
  })
  .listen(8080, "0.0.0.0");
