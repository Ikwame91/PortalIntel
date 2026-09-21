import cors from 'cors';
import express from 'express';
import { analyzePage } from './scraper.js';

const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function isSafeUrl(value) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    return !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  } catch { return false; }
}

function crawlCandidates(report) {
  return report.links.filter((link) => link.internal && /admissions|requirement|deadline|application|graduate|program/i.test(`${link.text} ${link.href}`)).slice(0, 5).map((link) => link.href);
}

function toMarkdown(report) {
  const dossier = report.dossier;
  return `# ${dossier.program_title}\n\nSource: ${report.url}\n\n## Executive summary\n${dossier.executive_summary}\n\n## Admissions criteria\n- Minimum GPA: ${dossier.admissions_criteria.minimum_gpa || 'Not identified'}\n- Recommendation letters: ${dossier.admissions_criteria.letters_of_recommendation || 'Not identified'}\n- Application fee: ${dossier.admissions_criteria.application_fee || 'Not identified'}\n- Fee waiver available: ${dossier.admissions_criteria.fee_waiver_available ? 'Yes' : 'Not identified'}\n\n## Testing\n- GRE general: ${dossier.testing_requirements.gre_general}\n- GRE subject: ${dossier.testing_requirements.gre_subject}\n- English proficiency: ${dossier.testing_requirements.english_proficiency}\n\n## Deadlines\n${dossier.deadlines.map((item) => `- ${item.category}: ${item.date} (${item.term})`).join('\n') || '- No dates identified'}\n\n## Funding\n${dossier.funding_and_assistantships.map((item) => `- ${item}`).join('\n') || '- No funding signals identified'}\n\n## Link directory\n${Object.entries(dossier.link_directory).map(([key, values]) => `### ${key}\n${values.map((value) => `- ${value}`).join('\n') || '- None identified'}`).join('\n\n')}`;
}

function toCsv(report) {
  const rows = [['category', 'value'], ['program', report.dossier.program_title], ['institution', report.dossier.institution_name], ['minimum_gpa', report.dossier.admissions_criteria.minimum_gpa || ''], ['application_fee', report.dossier.admissions_criteria.application_fee || ''], ...report.dossier.deadlines.map((deadline) => ['deadline', `${deadline.category}: ${deadline.date}`]), ...report.dossier.funding_and_assistantships.map((funding) => ['funding', funding])];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

app.post('/api/analyze', async (request, response) => {
  const { url, mode = 'quick' } = request.body || {};
  if (!isSafeUrl(url)) return response.status(400).json({ error: 'Please enter a public HTTP or HTTPS URL.' });
  try {
    const root = await analyzePage(url);
    let report = root;
    let crawledPages = [];
    if (mode === 'deep') {
      const candidates = crawlCandidates(root);
      crawledPages = await Promise.all(candidates.map(async (candidate) => { try { return await analyzePage(candidate, { rendered: false }); } catch { return null; } })).then((pages) => pages.filter(Boolean));
      const mergedText = [root.summary, ...crawledPages.map((page) => page.summary)].filter(Boolean).join(' ');
      const mergedLinks = [...root.links, ...crawledPages.flatMap((page) => page.links)];
      const mergedDossier = { ...root.dossier, executive_summary: mergedText.slice(0, 700), deadlines: [...root.dossier.deadlines, ...crawledPages.flatMap((page) => page.dossier.deadlines)], funding_and_assistantships: [...new Set([...root.dossier.funding_and_assistantships, ...crawledPages.flatMap((page) => page.dossier.funding_and_assistantships)])], link_directory: { ...root.dossier.link_directory, application_portal_links: [...new Set([...root.dossier.link_directory.application_portal_links, ...crawledPages.flatMap((page) => page.dossier.link_directory.application_portal_links)])], document_downloads: [...new Set([...root.dossier.link_directory.document_downloads, ...crawledPages.flatMap((page) => page.dossier.link_directory.document_downloads)])] } };
      report = { ...root, paragraphs: [...root.paragraphs, ...crawledPages.flatMap((page) => page.paragraphs)], headings: [...root.headings, ...crawledPages.flatMap((page) => page.headings)], links: [...new Map(mergedLinks.filter((link) => link.href).map((link) => [link.href, link])).values()], wordCount: root.wordCount + crawledPages.reduce((sum, page) => sum + page.wordCount, 0), dossier: mergedDossier };
    }
    return response.json({ ...report, mode, crawledPages: crawledPages.map((page) => ({ url: page.url, title: page.title })) });
  } catch (error) { return response.status(502).json({ error: error.message || 'We could not analyze that page.' }); }
});

app.post('/api/export', (request, response) => {
  const { report, format = 'md' } = request.body || {};
  if (!report) return response.status(400).json({ error: 'A report is required.' });
  const isCsv = format === 'csv';
  response.setHeader('Content-Type', isCsv ? 'text/csv' : 'text/markdown');
  response.setHeader('Content-Disposition', `attachment; filename="site-scope-dossier.${isCsv ? 'csv' : 'md'}"`);
  return response.send(isCsv ? toCsv(report) : toMarkdown(report));
});

app.listen(port, () => console.log(`Site Scope API listening on http://localhost:${port}`));