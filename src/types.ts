export type ScanMode = 'quick' | 'deep';
export type ScanProfile = 'general' | 'graduate';
export type RenderMode = 'headless' | 'static';
export type LinkCategory = 'External' | 'Contact' | 'Official documentation' | 'Application portal' | 'Faculty/contact' | 'Financial aid' | 'Internal subpage';

export interface Heading { level: number; text: string; }
export interface LinkResult { href?: string; email?: string; text?: string; internal?: boolean; category: LinkCategory; }
export interface ImageResult { src: string; alt: string; width: string; height: string; }
export interface FormResult { action: string; method: string; fields: number; }
export interface Deadline { term: string; category: string; date: string; notes: string | null; }
export interface TestingRequirements { gre_general: string; gre_subject: string; english_proficiency: string; waiver_details: string | null; }
export interface AdmissionsCriteria { minimum_gpa: string | null; letters_of_recommendation: number | null; statement_prompts: string | null; cv_resume_required: boolean; application_fee: string | null; fee_waiver_available: boolean; fee_waiver_instructions: string | null; }
export interface Contact { name: string; role_or_title: string; email: string | null; profile_url: string | null; }
export interface FundingEvidence { text: string; sourceUrl: string; kind: 'assistantship' | 'fellowship' | 'tuition' | 'stipend' | 'fee waiver' | 'other'; }
export interface LinkDirectory { application_portal_links: string[]; document_downloads: string[]; faculty_directory_links: string[]; financial_aid_links: string[]; contact_emails: string[]; }
export interface Dossier { institution_name: string; department_or_school: string | null; program_title: string; degree_awarded: string; executive_summary: string; deadlines: Deadline[]; testing_requirements: TestingRequirements; admissions_criteria: AdmissionsCriteria; funding_and_assistantships: string[]; funding_evidence: FundingEvidence[]; identified_contacts: Contact[]; link_directory: LinkDirectory; source_url: string; }
export interface PageReport { url: string; title: string; description: string; canonical: boolean; summary: string; paragraphs: string[]; headings: Heading[]; links: LinkResult[]; images: ImageResult[]; forms: FormResult[]; keywords: string[]; wordCount: number; linkCatalog: LinkDirectory; dossier: Dossier; renderMode: RenderMode; mode?: ScanMode; profile?: ScanProfile; crawledPages?: Array<{ url: string; title: string }>; }