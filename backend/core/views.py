from django.http import JsonResponse
from django.shortcuts import render


CLAUSES = [
    {
        "num": "1.1",
        "head": "Formation of Agreement",
        "body": "Either party may initiate a contract using BindPact's structured template "
                 "engine or custom clause builder. The initiating party (\u201cDrafter\u201d) "
                 "presents the instrument to the counterparty (\u201cReviewer\u201d) for "
                 "inspection, annotation, and negotiation.",
    },
    {
        "num": "1.2",
        "head": "Negotiation Period",
        "body": "During the open period, both parties may propose edits. All modifications "
                 "are timestamped, attributed, and recorded in the permanent audit log. No "
                 "change may be applied without acknowledgment from both parties.",
    },
    {
        "num": "1.3",
        "head": "Execution & Sealing",
        "body": "Upon execution by both verified signatories, the document is "
                 "cryptographically sealed. A SHA-3 hash is generated from the final "
                 "instrument. The sealed hash is the document's identity \u2014 any "
                 "modification produces a different hash, making tampering self-evident.",
    },
    {
        "num": "1.4",
        "head": "Post-Execution Immutability",
        "body": "The sealed instrument may not be modified by any party, including "
                 "BindPact Inc. It exists as-executed, permanently. A dispute reference "
                 "always returns both parties to the identical, frozen document.",
    },
]

GUARANTEES = [
    ("\u00a72.1", "Dual-Party Binding",
     "Both Contractor and Freelancer bear equal legal obligation under the executed "
     "instrument. Neither party holds seniority of claim."),
    ("\u00a72.2", "Cryptographic Verification",
     "The sealed hash constitutes proof of the document's exact state at time of "
     "execution. Third-party verification is available at verify.bindpact.com."),
    ("\u00a72.3", "Jurisdiction Coverage",
     "Instruments executed on BindPact are enforceable under ESIGN, eIDAS, UETA, and "
     "equivalent statutes across US, EU, UK, CA, and AU jurisdictions."),
    ("\u00a72.4", "Source of Truth",
     "In the event of dispute, the sealed BindPact instrument supersedes all other "
     "versions, screenshots, email threads, or verbal representations of the agreement."),
    ("\u00a72.5", "Audit Trail Integrity",
     "All pre-execution history \u2014 drafts, edits, annotations, timestamps \u2014 is "
     "preserved in the immutable audit log alongside the sealed document."),
    ("\u00a72.6", "Platform Non-Interference",
     "BindPact Inc. is prohibited by its own architecture from modifying, deleting, or "
     "accessing the content of any sealed instrument."),
]

PLANS = [
    {
        "clause": "\u00a73.1",
        "name": "Sole Trader",
        "monthly": 15,
        "annual": 12,
        "desc": "Independent freelancers establishing professional practice.",
        "terms": [
            "Up to 10 active instruments",
            "Standard clause library",
            "Dual-party e-signature",
            "Cryptographic sealing",
            "PDF certified export",
        ],
        "featured": False,
    },
    {
        "clause": "\u00a73.2",
        "name": "Professional",
        "monthly": 45,
        "annual": 36,
        "desc": "Active practitioners with recurring client engagements.",
        "terms": [
            "Unlimited instruments",
            "Custom clause builder",
            "Multi-party contracts",
            "Priority dispute support",
            "Full audit trail export",
            "API access",
        ],
        "featured": True,
    },
    {
        "clause": "\u00a73.3",
        "name": "Firm",
        "monthly": 150,
        "annual": 120,
        "desc": "Studios and agencies managing contractor teams.",
        "terms": [
            "Team workspaces",
            "Custom branding",
            "Bulk contract tools",
            "Legal counsel integration",
            "SLA guarantee",
            "Dedicated account manager",
        ],
        "featured": False,
    },
]

RECORD = [
    {
        "id": "EX-2024-0841",
        "date": "Nov 14, 2024",
        "party": "Jordan Reyes, Motion Designer",
        "statement": "A client disputed the agreed scope after final delivery. The BindPact "
                      "instrument was presented. The sealed hash matched the original "
                      "document exactly. The matter was resolved without legal escalation.",
        "outcome": "Resolved",
    },
    {
        "id": "EX-2025-0317",
        "date": "Feb 3, 2025",
        "party": "Priya N., COO \u2014 Holloway Creative",
        "statement": "We manage 30+ contractors across three jurisdictions. BindPact "
                      "replaced our inconsistent PDF process with a single enforceable "
                      "standard. Disputes have decreased by 78% since adoption.",
        "outcome": "Adopted",
    },
    {
        "id": "EX-2025-1102",
        "date": "Jul 19, 2025",
        "party": "Oren K., Senior Dev Contractor",
        "statement": "The hash verification feature is the product. When a client claimed "
                      "the payment terms had changed, I produced the sealed document. The "
                      "hash was identical to the one signed six months prior. No further "
                      "discussion was needed.",
        "outcome": "Verified",
    },
]

PREAMBLE_TEXT = (
    "WHEREAS, the freelance and contract economy requires a neutral, immutable platform "
    "for the formation and execution of legally binding agreements; and\n\n"
    "WHEREAS, both Contractors and Freelancers require equal protection under a single "
    "source of truth that neither party may alter after execution;\n\n"
    "NOW, THEREFORE, BindPact hereby establishes the following platform, terms, and "
    "guarantees \u2014 executed in permanent record."
)


def home(request):
    context = {
        "preamble_lines": PREAMBLE_TEXT.split("\n\n"),
        "clauses": CLAUSES,
        "guarantees": GUARANTEES,
        "plans": PLANS,
        "record": RECORD,
    }
    return render(request, "core/home.html", context)


def home_data(request):
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    return JsonResponse({
        "preamble": PREAMBLE_TEXT.split("\n\n"),
        "clauses": CLAUSES,
        "guarantees": GUARANTEES,
        "plans": PLANS,
        "record": RECORD,
    })
