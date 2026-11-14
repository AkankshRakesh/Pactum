import hashlib
import logging
import re
import io

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify

logger = logging.getLogger(__name__)

# Guests have no account, so by default only the creator receives the executed PDF.
SEND_COPY_TO_GUEST = False


def _fmt_dt(value):
    return timezone.localtime(value).strftime("%d %b %Y, %H:%M %Z") if value else "—"


def send_invitation_email(contract, invitation, raw_token, inviter):
    """Raises on failure, so callers inside transaction.atomic() roll back."""
    url = f"{settings.FRONTEND_URL}/invite/{raw_token}"
    inviter_name = inviter.get_full_name().strip() or inviter.username
    expires = invitation.expires_at.strftime("%d %b %Y") if invitation.expires_at else "7 days from now"

    context = {
        "heading": "You’ve been invited to review a contract",
        "preheader": f"{inviter_name} invited you to review {contract.title}",
        "inviter_name": inviter_name,
        "action_url": url,
        "rows": [
            ("Contract", contract.title),
            ("From", inviter_name),
            ("Link expires", expires),
        ],
    }
    html = render_to_string("emails/invitation.html", context)
    text = (
        f'{inviter_name} invited you to review "{contract.title}" on Pactum.\n\n'
        f"Review and sign: {url}\n\n"
        f"This link expires on {expires} and can be revoked by the sender."
    )

    message = EmailMultiAlternatives(
        subject=f"You are invited to review {contract.title}",
        body=text,
        from_email=None,
        to=[invitation.email],
    )
    message.attach_alternative(html, "text/html")
    message.send(fail_silently=False)


def render_contract_pdf(contract, invitation):
    from xhtml2pdf import pisa

    # Never let the PDF renderer fetch remote resources. Remove resource-bearing
    # elements before marking the contract's authored HTML as safe for the template.
    contract_body = contract.body_html or ""
    contract_body = re.sub(
        r"<(img|link|iframe|object|embed)\b[^>]*>",
        "",
        contract_body,
        flags=re.IGNORECASE,
    )
    fingerprint = hashlib.sha256((contract.body_html or "").encode()).hexdigest()
    signature_method = (
        "Pactum account"
        if invitation.signature_mode == "account"
        else "Guest signature"
    )
    creator = contract.creator
    html = render_to_string(
        "pdf/contract_execution.html",
        {
            "contract_body": contract_body,
            "subtitle": contract.subtitle or "",
            "signer_name": invitation.signer_name,
            "signature_method": signature_method,
            "signed_at": _fmt_dt(invitation.signed_at),
            "creator_name": creator.get_full_name().strip() or creator.username,
            "contract_id": contract.id,
            "fingerprint": fingerprint,
            "contract_title": contract.title,
        },
    )

    buffer = io.BytesIO()
    result = pisa.CreatePDF(src=html, dest=buffer, encoding="utf-8")
    if result.err:
        raise RuntimeError("PDF generation failed")
    return buffer.getvalue()


def _executed_message(contract, invitation, recipient_email, recipient_name, is_creator, pdf):
    method = "Pactum account" if invitation.signature_mode == "account" else "Guest signature"
    rows = [
        ("Contract", contract.title),
        ("Signed by", invitation.signer_name),
        ("Method", method),
        ("Signed on", _fmt_dt(invitation.signed_at)),
        ("Reference", str(contract.id).split("-")[0].upper()),
    ]
    context = {
        "preheader": f"{contract.title} has been executed",
        "contract_title": contract.title,
        "signer_name": invitation.signer_name,
        "recipient_name": recipient_name,
        "is_creator": is_creator,
        "has_pdf": bool(pdf),
        "rows": rows,
        "dashboard_url": f"{settings.FRONTEND_URL}/dashboard",
    }
    html = render_to_string("emails/executed.html", context)
    text = (
        f"{contract.title} has been executed.\n\n"
        f"Signed by: {invitation.signer_name} ({method})\n"
        f"Signed on: {_fmt_dt(invitation.signed_at)}\n\n"
        + ("The executed PDF is attached." if pdf else "The PDF could not be attached.")
    )

    message = EmailMultiAlternatives(
        subject=f"Executed: {contract.title}",
        body=text,
        from_email=None,
        to=[recipient_email],
    )
    message.attach_alternative(html, "text/html")
    if pdf:
        message.attach(
            f"{slugify(contract.title) or 'contract'}-executed.pdf",
            pdf,
            "application/pdf",
        )
    return message


def send_executed_emails(contract, invitation):
    """Best-effort: signing has already succeeded, so failures are logged, never raised."""
    try:
        try:
            pdf = render_contract_pdf(contract, invitation)
        except Exception:
            logger.exception("PDF generation failed for contract %s", contract.id)
            pdf = None

        creator = contract.creator
        recipients = []
        if creator.email:
            recipients.append(
                (creator.email, creator.get_full_name().strip() or creator.username, True)
            )
        if invitation.signature_mode == "account" or SEND_COPY_TO_GUEST:
            recipients.append((invitation.email, invitation.signer_name, False))

        seen = set()
        messages = []
        for email, name, is_creator in recipients:
            normalized_email = email.strip().lower()
            if normalized_email in seen:
                continue
            seen.add(normalized_email)
            messages.append(
                _executed_message(
                    contract, invitation, email, name, is_creator, pdf
                )
            )

        if messages:
            get_connection(fail_silently=False).send_messages(messages)
    except Exception:
        logger.exception("Executed-contract emails failed for contract %s", contract.id)
