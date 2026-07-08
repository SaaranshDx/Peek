const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

const LOG_PREFIX = '[Peek Proxy]';

function rewriteUrls(html, baseUrl) {
  const attrs = ['href', 'src', 'action', 'formaction', 'poster'];
  const pattern = new RegExp(
    `\\s(${attrs.join('|')})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]*))`,
    'gi'
  );
  return html.replace(pattern, (match, attr, dq, sq, uq) => {
    const original = dq || sq || uq || '';
    if (!original) return match;
    if (/^(#|javascript:|mailto:|tel:|data:|blob:|about:)/i.test(original)) return match;
    if (/^\/proxy\?url=/i.test(original)) return match;
    try {
      const resolved = new URL(original, baseUrl).href;
      const proxied = `/proxy?url=${encodeURIComponent(resolved)}`;
      if (dq !== undefined) return ` ${attr}="${proxied}"`;
      if (sq !== undefined) return ` ${attr}='${proxied}'`;
      return ` ${attr}=${proxied}`;
    } catch {
      return match;
    }
  });
}

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console[level](`${LOG_PREFIX} [${timestamp}] ${message}`, JSON.stringify(data, null, 2));
}

app.use((req, res, next) => {
  if (req.path === '/proxy') {
    log('log', 'INCOMING REQUEST', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      'user-agent': req.headers['user-agent'] || 'N/A',
    });
  }
  next();
});

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  if (!url) {
    log('warn', `[${requestId}] MISSING URL PARAMETER`, { query: req.query });
    return res.status(400).send('Missing "url" query parameter');
  }

  log('log', `[${requestId}] PROXY REQUEST`, { targetUrl: url });

  const start = Date.now();

  try {
    const response = await fetch(url);

    const fetchDuration = Date.now() - start;

    log('log', `[${requestId}] UPSTREAM RESPONSE`, {
      status: response.status,
      statusText: response.statusText,
      durationMs: fetchDuration,
      headers: Object.fromEntries(response.headers.entries()),
    });

    const headersToRemove = [
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'frame-ancestors',
      'content-encoding',
      'content-length',
    ];

    const removedHeaders = [];
    const forwardedHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      const lower = key.toLowerCase();
      if (headersToRemove.includes(lower)) {
        removedHeaders.push({ [key]: value });
      } else {
        forwardedHeaders[key] = value;
      }
    }

    log('log', `[${requestId}] HEADERS STRIPPED`, { removed: removedHeaders });

    const body = await response.buffer();
    const bodySize = body.length;

    log('log', `[${requestId}] FORWARDING RESPONSE`, {
      status: response.status,
      bodySizeBytes: bodySize,
      bodySizeKB: (bodySize / 1024).toFixed(2),
      forwardedHeadersCount: Object.keys(forwardedHeaders).length,
    });

    let finalBody = body;
    const contentType = forwardedHeaders['content-type'] || '';

    if (contentType.includes('text/html')) {
      let html = body.toString('utf8');
      html = rewriteUrls(html, url);
      const clickHandler = `
        <script>
        document.addEventListener("click", (e) => {
          const a = e.target.closest("a");
          if (!a) return;
          if (a.protocol === "javascript:" || a.protocol === "mailto:" || a.protocol === "tel:" || a.protocol === "data:") return;
          e.preventDefault();
          window.location.href = "/proxy?url=" + encodeURIComponent(a.href);
        });
        </script>
      `.replace(/\n\s*/g, ' ').trim();
      html = html.replace('</body>', clickHandler + '</body>');
      finalBody = Buffer.from(html);
      log('log', `[${requestId}] URLS REWRITTEN`, { baseUrl: url });
    }

    const hadRestrictions = removedHeaders.length > 0;

    if (hadRestrictions && contentType.includes('text/html')) {
      const warning = `
        <!-- Peek Proxy Warning -->
        <div style="
          position: sticky; top: 0; z-index: 2147483647;
          background: #fff3cd; color: #856404;
          padding: 12px 20px; font: 14px/1.5 sans-serif;
          border-bottom: 2px solid #f0c674;
          display: flex; align-items: center; gap: 10px;
        ">
          <span style="font-size: 20px;">&#9888;</span>
          <span>
            <strong>Warning:</strong> This site's security headers prevent it from being displayed in a preview.
            Some features or content may not work correctly.
          </span>
        </div>
        <div id="peek-popup-overlay" style="
          position: fixed; inset: 0; z-index: 2147483646;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          font: 14px/1.5 sans-serif;
        ">
          <div style="
            background: #fff; color: #333;
            max-width: 480px; padding: 28px 32px; border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            text-align: center;
          ">
            <div style="font-size: 40px; margin-bottom: 12px;">&#9888;</div>
            <h2 style="margin: 0 0 8px; font-size: 18px;">Preview Restricted</h2>
            <p style="margin: 0 0 6px; color: #555;">
              This website does not allow being previewed. Some features or content may not appear correctly.
            </p>
            <p style="margin: 0 0 20px; color: #888; font-size: 12px;">
              This restriction was bypassed by stripping security headers from the response.
            </p>
            <button onclick="document.getElementById('peek-popup-overlay').remove()" style="
              background: #856404; color: #fff;
              border: none; padding: 10px 28px; border-radius: 6px;
              font-size: 14px; cursor: pointer;
            ">Got it</button>
          </div>
        </div>
      `.replace(/\n\s*/g, ' ').trim();
      finalBody = Buffer.from(
        body.toString('utf8').replace('</body>', warning + '</body>')
      );
      log('warn', `[${requestId}] RESTRICTED SITE - injected warning banner`, {
        removedHeaders: removedHeaders,
      });
    }

    res.set(forwardedHeaders);
    res.status(response.status).send(finalBody);

    const totalDuration = Date.now() - start;
    log('log', `[${requestId}] REQUEST COMPLETE`, { totalDurationMs: totalDuration });

  } catch (err) {
    const errorDuration = Date.now() - start;
    log('error', `[${requestId}] PROXY ERROR`, {
      error: err.message,
      stack: err.stack,
      durationMs: errorDuration,
    });
    res.status(500).send(`Proxy error: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`${LOG_PREFIX} Peek proxy server running on http://localhost:${PORT}`);
});
