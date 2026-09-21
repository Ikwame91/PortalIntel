import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { buildDossier } from './dossier.js';
import type { FormResult, Heading, ImageResult, LinkCategory, LinkDirectory, LinkResult, PageReport, RenderMode } from '../src/types';

const USER_AGENT = 'SiteScope/2.0 (+responsible public-page analysis)';
const DOCUMENT_EXTENSIONS = /\.(pdf|docx?|xlsx?|zip)(?:$|\?)/i;
const PORTALS = ['slate.org', 'applyweb.com', 'collegenet.com', 'liaisoncas.com', 'liaisonedu.com', 'embark.com'];
const CONTACT_PATHS = /faculty|people|directory|contact|staff|lab/i;
const FINANCIAL_PATHS = /funding|financial|assistantship|fellowship|tuition|aid/i;

const cleanText = (value = '') => value.replace(/\s+/g, ' ').trim();
const uniqueByHref = (items: LinkResult[]): LinkResult[] => [...new Map(items.map((item) => [item.href || item.email || '', item])).values()];

async function renderPage(url) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); } catch { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
    await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight / 2); await new Promise((resolve) => setTimeout(resolve, 350)); window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(650);
    return await page.content();
  } finally { await browser?.close(); }
}

async function fetchStatic(url) {
  const page = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
  if (!page.ok) throw new Error(`The site responded with ${page.status}.`);
  return page.text();
}

function extract(url: string, html: string): Omit<PageReport, 'mode' | 'crawledPages' | 'renderMode'> {
  const $ = cheerio.load(html);
  const base = new URL(url);
  const forms: FormResult[] = $('form').map((_, element) => ({ action: new URL($(element).attr('action') || url, url).href, method: ($(element).attr('method') || 'GET').toUpperCase(), fields: $(element).find('input, textarea, select').length })).get();
  $('script, style, noscript, nav, footer, header, aside, form').remove();
  const paragraphs = $('main p, article p, body p').map((_, element) => cleanText($(element).text())).get().filter((paragraph) => paragraph.length > 20);
  const headings: Heading[] = $('h1, h2, h3, h4, h5, h6').map((_, element) => ({ level: Number(element.tagName.slice(1)), text: cleanText($(element).text()) })).get().filter((heading) => heading.text);
  const links: LinkResult[] = $('a[href]').map((_, element) => {
    const raw = $(element).attr('href');
    if (!raw || /^(#|javascript:)/i.test(raw)) return null;
    try {
      const resolved = new URL(raw, url);
      const href = resolved.href;
      const internal = resolved.hostname === base.hostname;
      const path = `${resolved.hostname}${resolved.pathname}`;
      const link: LinkResult = { href, text: cleanText($(element).text()), internal, category: 'External' };
      if (resolved.protocol === 'mailto:') return { email: resolved.pathname, category: 'Contact' as LinkCategory };
      if (DOCUMENT_EXTENSIONS.test(href)) link.category = 'Official documentation';
      else if (PORTALS.some((portal) => resolved.hostname.includes(portal))) link.category = 'Application portal';
      else if (CONTACT_PATHS.test(path)) link.category = 'Faculty/contact';
      else if (FINANCIAL_PATHS.test(path)) link.category = 'Financial aid';
      else if (internal) link.category = 'Internal subpage';
      return link;
    } catch { return null; }
  }).get().filter(Boolean);
  const allLinks: LinkResult[] = uniqueByHref(links);
  const emails = [...new Set($('a[href^="mailto:"]').map((_, element) => { const href = $(element).attr('href'); return href ? href.replace(/^mailto:/i, '').split('?')[0] : ''; }).get().filter(Boolean))];
  const linksFor = (category: LinkCategory): string[] => allLinks.filter((link) => link.category === category && Boolean(link.href)).map((link) => link.href as string);
  const linkCatalog = {
    application_portal_links: linksFor('Application portal'),
    document_downloads: linksFor('Official documentation'),
    faculty_directory_links: linksFor('Faculty/contact'),
    financial_aid_links: linksFor('Financial aid'),
    contact_emails: emails,
  };
  const bodyText = cleanText(paragraphs.join(' '));
  const title = cleanText($('title').first().text());
  const description = cleanText($('meta[name="description"]').attr('content'));
  const images: ImageResult[] = $('img').map((_, element) => { const src = $(element).attr('src'); return { src: src ? new URL(src, url).href : '', alt: cleanText($(element).attr('alt')), width: $(element).attr('width') || '', height: $(element).attr('height') || '' }; }).get().filter((image) => image.src);
  return { url, title, description, canonical: Boolean($('link[rel="canonical"]').attr('href')), summary: paragraphs.slice(0, 3).join(' '), paragraphs, headings, links: allLinks, images, forms, keywords: [...new Set(bodyText.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4))].slice(0, 12), wordCount: bodyText ? bodyText.split(/\s+/).length : 0, linkCatalog, dossier: buildDossier({ url, title, description, text: bodyText, headings, linkCatalog }) };
}

async function analyzePage(url: string, { rendered = true }: { rendered?: boolean } = {}): Promise<PageReport> {
  let html;
  let renderMode: RenderMode = 'static';
  if (rendered) { try { html = await renderPage(url); renderMode = 'headless'; } catch { html = await fetchStatic(url); } } else html = await fetchStatic(url);
  return { ...extract(url, html), renderMode };
}

export { analyzePage, cleanText, CONTACT_PATHS, FINANCIAL_PATHS, DOCUMENT_EXTENSIONS };