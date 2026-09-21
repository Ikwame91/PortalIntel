import cors from 'cors';
import express from 'express';
import * as cheerio from 'cheerio';

const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

function cleanText(value = '') { return value.replace(/\s+/g, ' ').trim(); }
function isSafeUrl(value) {
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol); } catch { return false; }
}

app.post('/api/analyze', async (request, response) => {
  const { url } = request.body || {};
  if (!isSafeUrl(url)) return response.status(400).json({ error: 'Please enter a complete HTTP or HTTPS URL.' });
  try {
    const page = await fetch(url, { headers: { 'User-Agent': 'SiteScope/1.0 (+page analysis)' }, signal: AbortSignal.timeout(15000) });
    if (!page.ok) return response.status(502).json({ error: `The site responded with ${page.status}. Try another public page.` });
    const html = await page.text();
    const $ = cheerio.load(html);
    const pageUrl = new URL(url);
    const links = $('a[href]').map((_, element) => {
      const rawHref = $(element).attr('href');
      try {
        const href = new URL(rawHref, url).href;
        return { href, text: cleanText($(element).text()), internal: new URL(href).hostname === pageUrl.hostname };
      } catch { return null; }
    }).get().filter(Boolean);
    const headings = $('h1, h2, h3, h4, h5, h6').map((_, element) => ({ level: Number(element.tagName.slice(1)), text: cleanText($(element).text()) })).get().filter((heading) => heading.text);
    const paragraphs = $('p').map((_, element) => cleanText($(element).text())).get().filter((paragraph) => paragraph.length > 20);
    const images = $('img').map((_, element) => ({ src: $(element).attr('src') ? new URL($(element).attr('src'), url).href : '', alt: cleanText($(element).attr('alt')), width: $(element).attr('width') || '', height: $(element).attr('height') || '' })).get().filter((image) => image.src);
    const forms = $('form').map((_, element) => ({ action: $(element).attr('action') || pageUrl.href, method: ($(element).attr('method') || 'GET').toUpperCase(), fields: $(element).find('input, textarea, select').length })).get();
    const bodyText = cleanText($('body').text());
    const keywords = [...new Set((cleanText($('meta[name="keywords"]').attr('content')) || bodyText).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4))].slice(0, 12);
    return response.json({ url, title: cleanText($('title').first().text()), description: cleanText($('meta[name="description"]').attr('content')), canonical: Boolean($('link[rel="canonical"]').attr('href')), summary: paragraphs.slice(0, 3).join(' '), headings, paragraphs, links, images, forms, keywords, wordCount: bodyText ? bodyText.split(/\s+/).length : 0 });
  } catch (error) {
    const message = error.name === 'TimeoutError' ? 'The site took too long to respond.' : 'We could not fetch that page. Check the URL and try again.';
    return response.status(502).json({ error: message });
  }
});

app.listen(port, () => console.log(`Site Scope API listening on http://localhost:${port}`));