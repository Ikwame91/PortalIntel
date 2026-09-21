const TEST_POLICIES = ['Required', 'Optional', 'Waived', 'Not Accepted', 'Not Specified'];

function firstMatch(text, patterns, fallback = null) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1]?.trim() || match[0].trim();
  }
  return fallback;
}

function policyFor(text, subject) {
  const relevant = text.match(new RegExp(`.{0,100}${subject}.{0,180}`, 'ig'))?.join(' ') || '';
  if (!relevant) return 'Not Specified';
  if (/not\s+(required|accepted)|does not require|no longer required/i.test(relevant)) return 'Optional';
  if (/optional|may submit|recommended but not required/i.test(relevant)) return 'Optional';
  if (/waiv|exempt/i.test(relevant)) return 'Waived';
  if (/required|must submit|mandatory/i.test(relevant)) return 'Required';
  return 'Not Specified';
}

function buildDossier({ url, title, description, text, headings, linkCatalog }) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const institution = firstMatch(normalized, [/([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){1,5})\s+(?:University|College|Institute)/, /(?:at|of)\s+([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){1,5})/], 'Institution not identified');
  const programTitle = title || headings.find((heading) => heading.level === 1)?.text || 'Program not identified';
  const deadlines = [];
  const datePattern = /(Fall|Spring|Summer|Winter)?\s*(20\d{2})[^.]{0,100}?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*20\d{2})?/gi;
  for (const match of normalized.matchAll(datePattern)) deadlines.push({ term: `${match[1] || 'Application'} ${match[2]}`, category: /priority|fellowship|fund/i.test(match[0]) ? 'Priority/Funding' : /international/i.test(match[0]) ? 'General International' : 'General', date: match[0].trim(), notes: null });
  const gpa = firstMatch(normalized, [/(?:minimum|min)\s+(?:undergraduate\s+)?GPA(?:\s+of)?\s*[:\-]?\s*(\d(?:\.\d+)?)/i, /GPA\s+(?:requirement|minimum)\s*[:\-]?\s*(\d(?:\.\d+)?)/i]);
  const letters = firstMatch(normalized, [/(\d+)\s+(?:letters?|recommendations?)\s+(?:of recommendation|from recommenders)/i, /(?:require|need|submit)\s+(\d+)\s+(?:letters?|recommendations?)/i]);
  const fee = firstMatch(normalized, [/(?:application|admissions?)\s+fee\s*(?:is|:)?\s*(\$\s?\d+(?:\.\d{2})?)/i]);
  const feeWaiver = /fee waiver|waive the application fee/i.test(normalized);
  const english = firstMatch(normalized, [/(?:TOEFL|IELTS|Duolingo)[^.]{0,220}/i], 'No English proficiency detail identified');
  const funding = normalized.split(/(?<=[.!?])\s+/).filter((sentence) => /assistantship|fellowship|tuition remission|tuition waiver|research assistant|teaching assistant|stipend/i.test(sentence)).slice(0, 8);
  const contactNames = [];
  for (const candidate of normalized.matchAll(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}/g)) {
    const context = normalized.slice(Math.max(0, candidate.index - 100), candidate.index + candidate[0].length + 160);
    if (/coordinator|director|advisor|admissions|graduate/i.test(context)) contactNames.push(candidate[0]);
  }
  const contacts = [...new Set(contactNames)].slice(0, 8).map((name) => ({ name, role_or_title: 'Contact identified in page text', email: null, profile_url: null }));
  return {
    institution_name: institution,
    department_or_school: firstMatch(normalized, [/(?:department|school|college)\s+of\s+([A-Z][\w&.' -]+)/i]),
    program_title: programTitle,
    degree_awarded: firstMatch(`${title} ${normalized}`, [/\b(Ph\.?D\.?|博士|M\.S\.|M\.A\.|M\.Eng\.|Master(?:'s)?|Doctor(?:ate)?|MBA)\b/i], 'Not specified'),
    executive_summary: description || normalized.slice(0, 420),
    deadlines,
    testing_requirements: {
      gre_general: policyFor(normalized, 'GRE'),
      gre_subject: policyFor(normalized, 'GRE subject'),
      english_proficiency: english,
      waiver_details: firstMatch(normalized, [/(?:TOEFL|IELTS|Duolingo)[^.]{0,260}(?:waiv|exempt)[^.]*\./i]),
    },
    admissions_criteria: {
      minimum_gpa: gpa,
      letters_of_recommendation: letters ? Number(letters) : null,
      statement_prompts: firstMatch(normalized, [/(?:statement of purpose|personal statement)[^.]{0,240}/i]),
      cv_resume_required: /(?:CV|curriculum vitae|resume).{0,80}(?:required|must submit)/i.test(normalized),
      application_fee: fee,
      fee_waiver_available: feeWaiver,
      fee_waiver_instructions: feeWaiver ? firstMatch(normalized, [/fee waiver[^.]{0,260}/i]) : null,
    },
    funding_and_assistantships: funding,
    identified_contacts: contacts,
    link_directory: linkCatalog,
    source_url: url,
  };
}

export { TEST_POLICIES, buildDossier };