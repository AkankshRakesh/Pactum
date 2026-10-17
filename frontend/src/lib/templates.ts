export type Template = {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  author: string;
  likes: string;
  users: string;
  pages: number;
  minutes: number;
  parties: string[];
  sections: string[];
  badge?: string;
};

export const templates: Template[] = [
  {
    id: 1, slug: "service-agreement", title: "Service Agreement Template", category: "Services",
    summary: "A general-purpose agreement for service providers and their clients, covering scope, fees and IP.",
    author: "Pactum Legal", likes: "4.1k", users: "92k", pages: 6, minutes: 12,
    parties: ["Provider", "Client"],
    sections: ["Scope of services", "Deliverables & timeline", "Fees & payment", "Intellectual property", "Confidentiality", "Termination", "Limitation of liability"],
    badge: "Most Used",
  },
  {
    id: 2, slug: "nda", title: "Non-Disclosure Agreement (NDA)", category: "Confidentiality",
    summary: "Protects sensitive business information shared between two parties during talks or work.",
    author: "Legal Vault", likes: "2.8k", users: "61k", pages: 3, minutes: 5,
    parties: ["Disclosing", "Receiving"],
    sections: ["Confidential information", "Obligations", "Exclusions", "Term", "Return of materials", "Remedies"],
  },
  {
    id: 3, slug: "freelance-contract", title: "Freelance Contract Starter", category: "Freelance",
    summary: "A simple project contract for freelancers: scope, milestones, revisions and who owns the work.",
    author: "Pactum Community", likes: "3.3k", users: "108k", pages: 4, minutes: 8,
    parties: ["Freelancer", "Client"],
    sections: ["Project scope", "Payment schedule", "Revisions", "Ownership of work", "Kill fee", "Termination"],
    badge: "100K+ Used",
  },
  {
    id: 4, slug: "monthly-retainer", title: "Monthly Retainer Agreement", category: "Services",
    summary: "Ongoing work for a fixed monthly fee, with hours, rollover and response times defined.",
    author: "Pactum Legal", likes: "1.9k", users: "34k", pages: 5, minutes: 10,
    parties: ["Provider", "Client"],
    sections: ["Monthly hours", "Retainer fee", "Rollover rules", "Response times", "Term & renewal", "Termination"],
  },
  {
    id: 5, slug: "consulting-agreement", title: "Consulting Agreement", category: "Consulting",
    summary: "Engage an independent consultant with clear scope, expense handling and work-product terms.",
    author: "Pactum Legal", likes: "1.6k", users: "27k", pages: 5, minutes: 10,
    parties: ["Consultant", "Company"],
    sections: ["Engagement scope", "Fees & expenses", "Independent status", "Confidentiality", "Work product", "Termination"],
  },
  {
    id: 6, slug: "rental-agreement", title: "Residential Rental Agreement", category: "Property",
    summary: "A lease between landlord and tenant covering rent, deposit, maintenance and renewal.",
    author: "Legal Vault", likes: "2.2k", users: "48k", pages: 8, minutes: 15,
    parties: ["Landlord", "Tenant"],
    sections: ["Premises", "Rent & due date", "Security deposit", "Maintenance", "Entry & notice", "Term & renewal"],
  },
  {
    id: 7, slug: "contractor-agreement", title: "Independent Contractor Agreement", category: "Employment",
    summary: "Hire a contractor (not an employee) with classification, tax and IP assignment terms.",
    author: "Pactum Community", likes: "1.4k", users: "22k", pages: 5, minutes: 10,
    parties: ["Contractor", "Company"],
    sections: ["Classification", "Services", "Compensation", "Taxes", "IP assignment", "Insurance", "Termination"],
  },
  {
    id: 8, slug: "partnership-agreement", title: "Partnership Agreement", category: "Business",
    summary: "Defines how partners contribute, share profit, make decisions and exit the business.",
    author: "Pactum Legal", likes: "1.1k", users: "15k", pages: 7, minutes: 15,
    parties: ["Partner A", "Partner B"],
    sections: ["Capital contributions", "Profit split", "Roles & duties", "Decision making", "Withdrawal", "Dissolution"],
  },
];

export const TEMPLATE_CATEGORIES = ["All", ...Array.from(new Set(templates.map(t => t.category)))];