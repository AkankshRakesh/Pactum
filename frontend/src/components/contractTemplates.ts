export type TemplateClause = { heading: string; text: string };

export type ContractTemplate = {
  id: string;
  title: string;
  subtitle: string;
  clauses: TemplateClause[];
};

// Bracketed [fields] are placeholders for the user to replace.
export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "service-agreement",
    title: "Service Agreement",
    subtitle: "Terms under which a service provider delivers services to a client.",
    clauses: [
      { heading: "Parties", text: "This agreement is between [Provider Name] (the “Provider”) and [Client Name] (the “Client”), effective from [Start Date]." },
      { heading: "Services", text: "The Provider will deliver the services described in [Scope of Services / Schedule A], to a professional standard and in line with any agreed specifications." },
      { heading: "Term", text: "This agreement begins on the effective date and continues until [End Date] or until the services are completed, unless ended earlier under these terms." },
      { heading: "Fees and Payment", text: "The Client will pay the Provider [Amount / Rate]. Invoices are payable within [30] days of receipt. Late payments may accrue interest at [Rate]% per month." },
      { heading: "Client Responsibilities", text: "The Client will provide timely access to information, materials and decisions reasonably required for the Provider to perform the services." },
      { heading: "Intellectual Property", text: "Ownership of deliverables transfers to the Client on full payment. The Provider keeps ownership of its pre-existing tools, methods and materials." },
      { heading: "Confidentiality", text: "Each party will keep the other’s confidential information private and use it only for the purposes of this agreement." },
      { heading: "Limitation of Liability", text: "Neither party is liable for indirect or consequential losses. The Provider’s total liability is limited to the fees paid under this agreement." },
      { heading: "Termination", text: "Either party may end this agreement with [30] days’ written notice, or immediately if the other party materially breaches it and fails to remedy the breach within [14] days." },
      { heading: "Governing Law", text: "This agreement is governed by the laws of [Jurisdiction], and its courts have exclusive jurisdiction over any dispute." },
    ],
  },
  {
    id: "nda",
    title: "Non-Disclosure Agreement",
    subtitle: "A mutual agreement to protect confidential information shared between the parties.",
    clauses: [
      { heading: "Parties", text: "This agreement is between [Party A] and [Party B], effective from [Effective Date]. Each may disclose and receive confidential information." },
      { heading: "Purpose", text: "Confidential information is shared only to evaluate or carry out [Describe Purpose / Proposed Relationship]." },
      { heading: "Definition of Confidential Information", text: "Any non-public information disclosed by a party, in any form, that is marked confidential or would reasonably be understood to be confidential." },
      { heading: "Exclusions", text: "Information that is public through no fault of the recipient, already known to the recipient, independently developed, or lawfully received from a third party is not confidential." },
      { heading: "Obligations", text: "The recipient will keep confidential information secret, protect it with reasonable care, use it only for the stated purpose, and share it only with people who need it and are bound by similar duties." },
      { heading: "Compelled Disclosure", text: "If the law requires disclosure, the recipient will give prompt written notice where permitted and disclose only what is required." },
      { heading: "Term", text: "This agreement covers disclosures made for [2] years from the effective date. Confidentiality obligations continue for [3] years after it ends." },
      { heading: "Return or Destruction", text: "On request, the recipient will return or destroy confidential information and confirm in writing that it has done so." },
      { heading: "Remedies", text: "Breach may cause harm that money cannot fully repair, so the disclosing party may seek injunctive relief in addition to other remedies." },
      { heading: "Governing Law", text: "This agreement is governed by the laws of [Jurisdiction]." },
    ],
  },
  {
    id: "freelance-contract",
    title: "Freelance Contract",
    subtitle: "An agreement between an independent contractor and a client for a defined project.",
    clauses: [
      { heading: "Parties", text: "This contract is between [Freelancer Name] (the “Freelancer”) and [Client Name] (the “Client”)." },
      { heading: "Project and Deliverables", text: "The Freelancer will deliver [Describe Deliverables] by [Deadline], as detailed in [Project Brief / Schedule A]." },
      { heading: "Fees", text: "The Client will pay [Fixed Fee / Hourly Rate]. A deposit of [Percentage]% is due before work begins, with the balance due on delivery." },
      { heading: "Expenses", text: "Pre-approved expenses are reimbursed by the Client at cost, against receipts." },
      { heading: "Revisions", text: "The fee includes [2] rounds of revisions. Additional revisions or changes in scope are charged at [Rate] and agreed in writing." },
      { heading: "Independent Contractor", text: "The Freelancer is an independent contractor, not an employee. The Freelancer controls how the work is done and is responsible for their own taxes and insurance." },
      { heading: "Ownership and Credit", text: "The Client owns the final deliverables on full payment. The Freelancer may show the work in their portfolio unless the Client objects in writing." },
      { heading: "Confidentiality", text: "Each party will keep the other’s confidential information private during and after this contract." },
      { heading: "Cancellation", text: "Either party may cancel with [14] days’ written notice. The Client pays for work completed up to the cancellation date. Deposits are non-refundable once work has started." },
      { heading: "Governing Law", text: "This contract is governed by the laws of [Jurisdiction]." },
    ],
  },
  {
    id: "monthly-retainer",
    title: "Monthly Retainer Agreement",
    subtitle: "An ongoing arrangement for a fixed monthly fee covering an agreed scope of work.",
    clauses: [
      { heading: "Parties", text: "This agreement is between [Provider Name] and [Client Name], effective from [Start Date]." },
      { heading: "Retained Services", text: "Each month the Provider will perform [Describe Services] for up to [Number] hours. Work outside this scope is quoted separately." },
      { heading: "Monthly Fee", text: "The Client will pay [Amount] per month, invoiced in advance on the [1st] of each month and payable within [7] days." },
      { heading: "Unused Hours", text: "Unused hours [do not roll over / roll over for one month] and are not refundable." },
      { heading: "Additional Work", text: "Hours beyond the monthly allowance are billed at [Hourly Rate], with the Client’s prior approval." },
      { heading: "Availability and Response", text: "The Provider will respond to requests within [1] business day and will schedule work around the Client’s reasonable priorities." },
      { heading: "Term and Renewal", text: "The initial term is [3] months and renews monthly unless either party gives [30] days’ written notice." },
      { heading: "Confidentiality", text: "Each party will keep the other’s confidential information private during and after this agreement." },
      { heading: "Termination", text: "Either party may end this agreement for material breach that is not remedied within [14] days of written notice. Fees for the current month remain payable." },
      { heading: "Governing Law", text: "This agreement is governed by the laws of [Jurisdiction]." },
    ],
  },
];

export function getTemplate(id: string | null | undefined) {
  return CONTRACT_TEMPLATES.find(template => template.id === id);
}

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Same structure and classes as the editor's blank document, so a template looks like any other contract.
export function buildTemplateBody(template: ContractTemplate) {
  const clauses = template.clauses
    .map(
      clause =>
        `<li class="mb-3 min-h-7 list-item pl-2" data-clause-id="${crypto.randomUUID()}"><strong>${esc(clause.heading)}.</strong> ${esc(clause.text)}</li>`,
    )
    .join("");

  return (
    `<p class="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b2635] dark:text-[#c1445a]">Pactum instrument · Draft</p>` +
    `<h1 class="pactum-display mb-2 min-h-10 text-3xl font-bold leading-tight sm:text-[34px]">${esc(template.title)}</h1>` +
    `<p class="min-h-7 text-sm text-black/50 dark:text-white/50">${esc(template.subtitle)}</p>` +
    `<hr class="my-7 border-0 border-t border-black/10 dark:border-white/10">` +
    `<ol class="min-h-105 list-decimal pl-7">${clauses}</ol>`
  );
}