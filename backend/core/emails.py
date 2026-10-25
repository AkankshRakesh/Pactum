import hashlib
import io
import logging
import re
import sys

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils import timezone
from django.utils.html import escape
from django.utils.text import slugify

logger = logging.getLogger(__name__)

# Guests have no account, so by default only the creator receives the executed PDF.
SEND_COPY_TO_GUEST = False

BRAND = "#8b2635"
BG = "#f3eee8"
CARD = "#fffdfb"
INK = "#1a0f10"
MUTED = "#6b5d5e"
GREEN = "#3c9b68"


# ── HTML email layout ────────────────────────────────────────────────
def _button(label, url, color=BRAND):
    return (
        f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;"><tr>'
        f'<td align="center" bgcolor="{color}" style="border-radius:8px;">'
        f'<a href="{escape(url)}" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">{escape(label)}</a>'
        f"</td></tr></table>"
    )


def _details(rows):
    cells = "".join(
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #eadfd6;font-size:12px;color:{MUTED};'
        f'text-transform:uppercase;letter-spacing:.08em;width:38%;">{escape(label)}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #eadfd6;font-size:14px;color:{INK};font-weight:bold;">{escape(value)}</td></tr>'
        for label, value in rows
    )
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" '
        f'style="margin:22px 0 4px;background:#faf6f2;border-radius:10px;padding:6px 20px;"><tr><td>'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{cells}</table></td></tr></table>'
    )


def _layout(preheader, badge, heading, body_html):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(heading)}</title></head>
<body style="margin:0;padding:0;background:{BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG};">{escape(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{BG}"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:0 4px 18px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td align="center" width="34" height="34" style="width:34px;height:34px;border:1px solid {BRAND};background:#f1dde0;color:{BRAND};font-family:Georgia,serif;font-size:18px;font-weight:bold;">P</td>
        <td style="padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;color:{INK};">Pactum</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:{CARD};border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(26,15,16,.08);">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="height:6px;background:{BRAND};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 36px 34px;font-family:Arial,Helvetica,sans-serif;color:{INK};">
          <p style="margin:0 0 10px;font-size:11px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase;color:{BRAND};">{escape(badge)}</p>
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:{INK};">{escape(heading)}</h1>
          {body_html}
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:22px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:{MUTED};">
      Sent securely by Pactum &middot; Contracts that stay as signed.<br>
      If you weren&rsquo;t expecting this email you can safely ignore it.
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""


def _p(text, size=15, color=INK):
    return f'<p style="margin:0 0 14px;font-size:{size}px;line-height:1.65;color:{color};">{text}</p>'


# ── Invitation email ─────────────────────────────────────────────────
def send_invitation_email(contract, invitation, raw_token, inviter):
    """Raises on failure, so callers inside transaction.atomic() roll back."""
    url = f"{settings.FRONTEND_URL}/invite/{raw_token}"
    inviter_name = inviter.get_full_name().strip() or inviter.username
    expires = invitation.expires_at.strftime("%d %b %Y") if invitation.expires_at else "7 days from now"

    body = (
        _p(f"<strong>{escape(inviter_name)}</strong> has invited you to review and sign a contract on Pactum.")
        + _details([("Contract", contract.title), ("From", inviter_name), ("Link expires", expires)])
        + _p("Read every clause, leave comments where you want a change, then sign when you&rsquo;re happy. "
             "You can sign as a guest or with your account.", 14, MUTED)
        + _button("Review &amp; sign contract", url).replace("&amp;amp;", "&amp;")
        + f'<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:{MUTED};">Button not working? Paste this link into your browser:<br>'
          f'<a href="{escape(url)}" style="color:{BRAND};word-break:break-all;">{escape(url)}</a></p>'
    )
    html = _layout(f"{inviter_name} invited you to review {contract.title}", "Contract invitation",
                   "You&rsquo;ve been invited to review a contract".replace("&rsquo;", "\u2019"), body)

    text = (
        f"{inviter_name} invited you to review \"{contract.title}\" on Pactum.\n\n"
        f"Review and sign: {url}\n\n"
        f"This link expires on {expires} and can be revoked by the sender."
    )
    message = EmailMultiAlternatives(
        subject=f"You are invited to review {contract.title}",
        body=text, from_email=None, to=[invitation.email],
    )
    message.attach_alternative(html, "text/html")
    message.send(fail_silently=False)


# ── PDF ──────────────────────────────────────────────────────────────
def _fmt_dt(value):
    return timezone.localtime(value).strftime("%d %b %Y, %H:%M %Z") if value else "—"


def render_contract_pdf(contract, invitation):
    from xhtml2pdf import pisa
    import sys
    print("PDF render using:", sys.executable, flush=True)

    body = contract.body_html or ""
    # Never let the PDF renderer fetch remote resources.
    body = re.sub(r"<(img|link|iframe|object|embed)\b[^>]*>", "", body, flags=re.IGNORECASE)
    fingerprint = hashlib.sha256((contract.body_html or "").encode()).hexdigest()
    method = "Pactum account" if invitation.signature_mode == "account" else "Guest signature"
    sub = f'<p class="sub">{escape(contract.subtitle)}</p>' if contract.subtitle else ""

    html = f"""<html><head><meta charset="utf-8"><style>
      @page {{ size: a4; margin: 2.2cm 2cm 2.4cm 2cm;
        @frame footer_frame {{ -pdf-frame-content: footer_content; left: 2cm; width: 17cm; top: 27.3cm; height: 1cm; }} }}
      body {{ font-family: Times-Roman; font-size: 11.5pt; line-height: 1.55; color: #1a0f10; }}
      .brand {{ font-family: Helvetica-Bold; font-size: 9pt; letter-spacing: 3px; color: #8b2635; }}
      h1 {{ font-family: Times-Bold; font-size: 24pt; margin: 6px 0 4px; }}
      .sub {{ color: #6b5d5e; margin: 0 0 6px; }}
      hr {{ border: 0; border-top: 1px solid #8b2635; margin: 14px 0 18px; }}
      ol {{ margin-left: 18px; }} li {{ margin-bottom: 9px; }}
      .sig {{ margin-top: 30px; border: 1px solid #8b2635; padding: 12px 14px; }}
      .sig h2 {{ font-family: Helvetica-Bold; font-size: 9pt; letter-spacing: 2px; color: #8b2635; margin: 0 0 8px; }}
      .sig td {{ font-family: Helvetica; font-size: 9pt; padding: 3px 0; vertical-align: top; }}
      .k {{ color: #6b5d5e; width: 28%; }}
      #footer_content {{ font-family: Helvetica; font-size: 8pt; color: #6b5d5e; text-align: center; }}
    </style></head><body>
      {body}
      <div class="sig" keepWithNext="true"><h2>EXECUTION RECORD</h2><table>
        <tr><td class="k">Signed by</td><td><b>{escape(invitation.signer_name)}</b></td></tr>
        <tr><td class="k">Method</td><td>{method}</td></tr>
        <tr><td class="k">Signed on</td><td>{escape(_fmt_dt(invitation.signed_at))}</td></tr>
        <tr><td class="k">Created by</td><td>{escape(contract.creator.get_full_name().strip() or contract.creator.username)}</td></tr>
        <tr><td class="k">Contract ID</td><td>{contract.id}</td></tr>
        <tr><td class="k">SHA-256</td><td>{fingerprint}</td></tr>
      </table></div>
      <div id="footer_content">{escape(contract.title)} &middot; Page <pdf:pagenumber> of <pdf:pagecount></div>
    </body></html>"""

    buffer = io.BytesIO()
    result = pisa.CreatePDF(src=html, dest=buffer, encoding="utf-8")
    if result.err:
        raise RuntimeError("PDF generation failed")
    return buffer.getvalue()


# ── Executed email ───────────────────────────────────────────────────
def _executed_message(contract, invitation, recipient_email, recipient_name, is_creator, pdf):
    method = "Pactum account" if invitation.signature_mode == "account" else "Guest signature"
    rows = [
        ("Contract", contract.title),
        ("Signed by", invitation.signer_name),
        ("Method", method),
        ("Signed on", _fmt_dt(invitation.signed_at)),
        ("Reference", str(contract.id).split("-")[0].upper()),
    ]
    intro = (
        f"<strong>{escape(invitation.signer_name)}</strong> has signed <strong>{escape(contract.title)}</strong>. "
        "The contract is now executed and can no longer be edited or commented on."
        if is_creator else
        f"Thanks, {escape(recipient_name)}. You&rsquo;ve signed <strong>{escape(contract.title)}</strong> and the contract is now executed."
    )
    attach_note = (
        "A PDF copy of the executed contract is attached to this email. Keep it for your records."
        if pdf else
        "We couldn&rsquo;t attach the PDF this time. You can still view the contract from your dashboard."
    )
    body = (
        f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;"><tr>'
        f'<td align="center" width="44" height="44" style="width:44px;height:44px;border-radius:22px;background:#e3f3ea;color:{GREEN};'
        f'font-size:22px;font-weight:bold;">&#10003;</td></tr></table>'
        + _p(intro) + _details(rows) + _p(attach_note, 14, MUTED)
    )
    if is_creator:
        body += _button("Open dashboard", f"{settings.FRONTEND_URL}/dashboard")

    html = _layout(f"{contract.title} has been executed", "Contract executed", "Signed, sealed and done", body)
    text = (
        f"{contract.title} has been executed.\n\n"
        f"Signed by: {invitation.signer_name} ({method})\nSigned on: {_fmt_dt(invitation.signed_at)}\n\n"
        + ("The executed PDF is attached." if pdf else "The PDF could not be attached.")
    )
    message = EmailMultiAlternatives(
        subject=f"Executed: {contract.title}", body=text, from_email=None, to=[recipient_email],
    )
    message.attach_alternative(html, "text/html")
    if pdf:
        message.attach(f"{slugify(contract.title) or 'contract'}-executed.pdf", pdf, "application/pdf")
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
            recipients.append((creator.email, creator.get_full_name().strip() or creator.username, True))
        if invitation.signature_mode == "account" or SEND_COPY_TO_GUEST:
            recipients.append((invitation.email, invitation.signer_name, False))

        seen, messages = set(), []
        for email, name, is_creator in recipients:
            if email.strip().lower() in seen:
                continue
            seen.add(email.strip().lower())
            messages.append(_executed_message(contract, invitation, email, name, is_creator, pdf))

        if messages:
            get_connection(fail_silently=False).send_messages(messages)
    except Exception:
        logger.exception("Executed-contract emails failed for contract %s", contract.id)