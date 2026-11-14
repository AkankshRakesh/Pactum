import json
import hashlib
import re
import secrets
from datetime import timedelta
from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from html.parser import HTMLParser
from .emails import send_executed_emails, send_invitation_email
from .forms import (
    SignupForm, LoginForm, InviteEmailForm, ContractSaveForm, ContractSendForm,
    CommentForm, GuestCommentForm, CommentStatusForm, InvitationSignForm,
    available_username,
)
from .models import Contract, ContractComment, ContractInvitation


@require_GET
def health(_request):
    """Return a lightweight liveness response for load balancer checks."""
    return JsonResponse({"status": "ok"})


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

def api_login_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse(
                {"detail": "Authentication credentials were not provided."},
                status=401,
            )
        return view_func(request, *args, **kwargs)

    return wrapped


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


User = get_user_model()


def _google_error_redirect(code):
    return redirect(f"{settings.FRONTEND_URL}/auth?error={code}")


def _google_request(url, data=None, headers=None):
    request = Request(
        url,
        data=urlencode(data).encode() if data else None,
        headers=headers or {},
        method="POST" if data else "GET",
    )
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode())


def _google_username(email):
    base = re.sub(r"[^a-zA-Z0-9._-]", "", email.split("@", 1)[0]).strip("._-").lower() or "google-user"
    return available_username(base)


def _google_user(profile, email):
    user = User.objects.filter(email__iexact=email).first()
    if user:
        return user

    for attempt in range(3):
        try:
            with transaction.atomic():
                return User.objects.create_user(
                    username=_google_username(email),
                    email=email,
                    first_name=str(profile.get("given_name", ""))[:150],
                    last_name=str(profile.get("family_name", ""))[:150],
                )
        except IntegrityError:
            user = User.objects.filter(email__iexact=email).first()
            if user:
                return user
            if attempt == 2:
                raise

    raise RuntimeError("Google user creation failed after retries.")


@require_GET
def google_start(request):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return JsonResponse({"detail": "Google OAuth is not configured."}, status=503)

    state = secrets.token_urlsafe(32)
    request.session["google_oauth_state"] = state
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@require_GET
def google_callback(request):
    state = request.GET.get("state", "")
    expected_state = request.session.pop("google_oauth_state", "")
    if not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return _google_error_redirect("invalid_oauth_state")

    if request.GET.get("error"):
        return _google_error_redirect("google_consent_denied")

    code = request.GET.get("code", "")
    if not code or not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return _google_error_redirect("google_auth_unavailable")

    try:
        token_data = _google_request(
            "https://oauth2.googleapis.com/token",
            {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        access_token = token_data.get("access_token")
        if not access_token:
            return _google_error_redirect("google_token_exchange_failed")

        profile = _google_request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    except (HTTPError, URLError, TimeoutError, ValueError):
        return _google_error_redirect("google_profile_failed")

    email = str(profile.get("email", "")).strip().lower()
    email_verified = profile.get("email_verified") is True or profile.get("email_verified") == "true"
    if not email or not email_verified or not profile.get("sub"):
        return _google_error_redirect("unverified_google_email")

    user = _google_user(profile, email)
    if not user.is_active:
        return _google_error_redirect("google_account_disabled")

    login(request, user)
    return redirect(f"{settings.FRONTEND_URL}/dashboard")


def _user_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }


def _json_body(request):
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None, JsonResponse({"detail": "Request body must be valid JSON."}, status=400)

    if not isinstance(body, dict):
        return None, JsonResponse({"detail": "Request body must be a JSON object."}, status=400)

    return body, None


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
def signup(request):
    data, error = _json_body(request)
    if error:
        return error

    form = SignupForm(data)
    if not form.is_valid():
        return JsonResponse({"errors": form.error_dict()}, status=400)

    username = form.cleaned_data["username"]
    email = form.cleaned_data["email"]
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=form.cleaned_data["password"],
            )
    except IntegrityError:
        if User.objects.filter(username__iexact=username).exists():
            form.add_error("username", "That username is already in use.")
        elif User.objects.filter(email__iexact=email).exists():
            form.add_error("email", "That email is already in use.")
        else:
            raise
        return JsonResponse({"errors": form.error_dict()}, status=400)

    login(request, user)
    return JsonResponse({"user": _user_data(user)}, status=201)


@require_POST
def login_view(request):
    data, error = _json_body(request)
    if error:
        return error

    form = LoginForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": "Invalid username/email or password."}, status=401)

    user = authenticate(
        request,
        username=form.resolve_username(),
        password=form.cleaned_data["password"],
    )
    if user is None:
        return JsonResponse({"detail": "Invalid username/email or password."}, status=401)

    login(request, user)
    return JsonResponse({"user": _user_data(user)})


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"detail": "Logged out."})


@require_GET
def current_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication credentials were not provided."}, status=401)

    return JsonResponse({"user": _user_data(request.user)})


class _TopLevelClauseParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.ol_depth = 0
        self.li_depth = 0
        self.clause_ids = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "ol":
            self.ol_depth += 1
        elif tag == "li":
            if self.ol_depth == 1 and self.li_depth == 0:
                self.clause_ids.append(dict(attrs).get("data-clause-id", ""))
            self.li_depth += 1

    def handle_startendtag(self, tag, attrs):
        if tag.lower() == "li" and self.ol_depth == 1 and self.li_depth == 0:
            self.clause_ids.append(dict(attrs).get("data-clause-id", ""))

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "li":
            self.li_depth = max(0, self.li_depth - 1)
        elif tag == "ol":
            self.ol_depth = max(0, self.ol_depth - 1)


def _top_level_clause_ids(html):
    parser = _TopLevelClauseParser()
    try:
        parser.feed(html or "")
        parser.close()
    except Exception:
        return []
    return parser.clause_ids


def _sync_comment_clause_metadata(contract, previous_ids, current_ids):
    """Delete comments for removed IDs and keep positional indexes current.

    Legacy comments are resolved against the pre-save document only when their
    old numeric position maps to exactly one clause. Unresolved comments remain
    visible as legacy history and are never reassigned by a later deletion.
    """
    previous_id_set = {clause_id for clause_id in previous_ids if clause_id}
    current_positions = {clause_id: index for index, clause_id in enumerate(current_ids, start=1) if clause_id}
    removed_ids = previous_id_set - set(current_positions)

    comments = list(contract.comments.all())
    for comment in comments:
        updates = []
        if not comment.clause_id and comment.clause_index and 1 <= comment.clause_index <= len(previous_ids):
            legacy_id = previous_ids[comment.clause_index - 1]
            if legacy_id and previous_ids.count(legacy_id) == 1:
                comment.clause_id = legacy_id
                updates.append("clause_id")

        if comment.clause_id in removed_ids:
            comment.delete()
            continue

        if comment.clause_id in current_positions:
            current_index = current_positions[comment.clause_id]
            if comment.clause_index != current_index:
                comment.clause_index = current_index
                updates.append("clause_index")
        if updates:
            comment.save(update_fields=list(dict.fromkeys(updates)))


def _contract_data(contract, include_body=False):
    invitation = getattr(contract, "invitation", None)
    active_invited_email = contract.invited_email if invitation and invitation.status != ContractInvitation.Status.REVOKED else ""
    data = {
        "id": str(contract.id),
        "title": contract.title,
        "subtitle": contract.subtitle,
        "status": contract.status,
        "invitedEmail": active_invited_email,
        "createdAt": contract.created_at.isoformat(),
        "updatedAt": contract.updated_at.isoformat(),
        "sentAt": contract.sent_at.isoformat() if contract.sent_at else None,
        "invitationStatus": invitation.status if invitation else "",
        "invitedSignerName": invitation.signer_name if invitation else "",
    }
    if include_body:
        data["bodyHtml"] = contract.body_html
        data["comments"] = [_comment_data(comment) for comment in contract.comments.all()]
    return data


@require_GET
@api_login_required
def contract_stats(request):
    contracts = request.user.contracts.all()

    total = contracts.count()

    avg_comments = (
        contracts
        .annotate(comment_count=Count("comments"))
        .aggregate(avg=Avg("comment_count"))["avg"]
    )

    by_status = list(
        contracts
        .values("status")
        .annotate(n=Count("id"))
        .order_by("status")
    )

    return JsonResponse({
        "stats": {
            "total": total,
            "avg_comments": avg_comments or 0,
        },
        "byStatus": by_status,
    })


def _issue_invitation(contract, email):
    raw_token = secrets.token_urlsafe(32)
    now = timezone.now()
    existing = ContractInvitation.objects.filter(contract=contract).first()
    previous_email = existing.email.strip().lower() if existing else ""
    invitation, created = ContractInvitation.objects.update_or_create(
        contract=contract,
        defaults={
            "email": email,
            "status": ContractInvitation.Status.SENT,
            "token_hash": hashlib.sha256(raw_token.encode()).hexdigest(),
            "expires_at": now + timedelta(days=7),
            "revoked_at": None,
            "accepted_at": None,
            "signed_at": None,
            "signer_name": "",
            "signature_mode": "",
            "sent_at": now,
        },
    )
    if not created and invitation.invitee_user and previous_email != email:
        invitation.invitee_user = None
        invitation.save(update_fields=["invitee_user"])
    return invitation, raw_token


def _get_invitation(token, allow_accepted=False):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invitation = ContractInvitation.objects.select_related("contract", "contract__creator").filter(token_hash=token_hash).first()
    if not invitation:
        return None
    if invitation.status == ContractInvitation.Status.REVOKED or (invitation.status == ContractInvitation.Status.ACCEPTED and not allow_accepted):
        return None
    if invitation.expires_at and invitation.expires_at <= timezone.now():
        return None
    return invitation


def _get_active_invitation(token):
    return _get_invitation(token, allow_accepted=False)


def _comment_data(comment):
    return {
        "id": comment.id,
        "contractId": str(comment.contract_id),
        "clauseIndex": comment.clause_index,
        "clauseId": comment.clause_id,
        "quotedText": comment.quoted_text,
        "authorName": comment.author_name or (comment.author_user.get_full_name().strip() if comment.author_user else "Guest"),
        "authorUserId": comment.author_user_id,
        "body": comment.body,
        "createdAt": comment.created_at.isoformat(),
        "status": comment.status,
        "statusChangedAt": comment.status_changed_at.isoformat() if comment.status_changed_at else None,
    }


def _reviewable_contract_for_user(request, contract_id):
    if not request.user.is_authenticated:
        return None
    return Contract.objects.filter(
        Q(id=contract_id, creator=request.user) |
        Q(id=contract_id, invitation__invitee_user=request.user)
    ).select_related("creator", "invitation").prefetch_related(
        "comments__author_user"
    ).first()


def _can_add_comments(contract):
    return contract.status != Contract.Status.EXECUTED


@require_GET
@api_login_required
def contract_list(request):
    contracts = request.user.contracts.select_related("invitation").prefetch_related(
        "comments__author_user"
    )
    return JsonResponse({"contracts": [_contract_data(contract, include_body=True) for contract in contracts]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
@api_login_required
def contract_detail(request, contract_id):
    try:
        contract = request.user.contracts.select_related("invitation").prefetch_related(
            "comments__author_user"
        ).get(id=contract_id)
    except (Contract.DoesNotExist, ValueError):
        return JsonResponse({"detail": "Contract not found."}, status=404)

    # GET: retrieve contract
    if request.method == "GET":
        return JsonResponse({
            "contract": _contract_data(contract, include_body=True)
        })

    # DELETE: delete contract
    if request.method == "DELETE":
        contract.delete()
        return JsonResponse({"deleted": str(contract_id)})

    # PUT / PATCH: update contract
    if contract.status == Contract.Status.EXECUTED:
        return JsonResponse(
            {"detail": "Executed contracts cannot be edited."},
            status=409,
        )

    data, error = _json_body(request)
    if error:
        return error

    if request.method == "PATCH":
        # PATCH updates only supplied fields.
        data = {
            "id": str(contract.id),
            "title": data.get("title", contract.title),
            "subtitle": data.get("subtitle", contract.subtitle),
            "bodyHtml": data.get("bodyHtml", contract.body_html),
        }
    else:
        # PUT replaces the editable contract representation.
        data["id"] = str(contract.id)

    form = ContractSaveForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)

    title = form.resolved_title(fallback=contract.title)
    subtitle = form.cleaned_data["subtitle"]
    body_html = form.cleaned_data["bodyHtml"]

    previous_ids = _top_level_clause_ids(contract.body_html)
    current_ids = _top_level_clause_ids(body_html)

    with transaction.atomic():
        contract.title = title
        contract.subtitle = subtitle
        contract.body_html = body_html
        contract.save(
            update_fields=[
                "title",
                "subtitle",
                "body_html",
                "updated_at",
            ]
        )

        _sync_comment_clause_metadata(
            contract,
            previous_ids,
            current_ids,
        )

    return JsonResponse({
        "contract": _contract_data(contract, include_body=True)
    })


@require_GET
@api_login_required
def invited_contract_list(request):
    invitations = ContractInvitation.objects.filter(
        invitee_user=request.user,
        status__in=[ContractInvitation.Status.SENT, ContractInvitation.Status.ACCEPTED],
    ).select_related("contract", "contract__invitation").prefetch_related(
        "contract__comments__author_user"
    )
    return JsonResponse({"contracts": [_contract_data(invitation.contract, include_body=True) for invitation in invitations]})


@require_GET
@api_login_required
def contract_review(request, contract_id):
    contract = _reviewable_contract_for_user(request, contract_id)
    if not contract:
        return JsonResponse({"detail": "Contract not found."}, status=404)
    return JsonResponse({
        "contract": _contract_data(contract, include_body=True),
        "reviewOnly": contract.creator_id != request.user.id,
        "currentUserId": request.user.id,
    })


@require_POST
@api_login_required
def contract_save(request):
    data, error = _json_body(request)
    if error:
        return error

    form = ContractSaveForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)

    contract_id = form.cleaned_data["id"]
    title = form.resolved_title()
    subtitle = form.cleaned_data["subtitle"]
    body_html = form.cleaned_data["bodyHtml"]

    if contract_id:
        try:
            contract = request.user.contracts.get(id=contract_id)
        except (Contract.DoesNotExist, ValueError):
            return JsonResponse({"detail": "Contract not found."}, status=404)
        if contract.status == Contract.Status.EXECUTED:
            return JsonResponse({"detail": "Executed contracts cannot be edited."}, status=409)
        previous_ids = _top_level_clause_ids(contract.body_html)
        current_ids = _top_level_clause_ids(body_html)
        with transaction.atomic():
            contract.title = title
            contract.subtitle = subtitle
            contract.body_html = body_html
            contract.save(update_fields=["title", "subtitle", "body_html", "updated_at"])
            _sync_comment_clause_metadata(contract, previous_ids, current_ids)
    else:
        contract = Contract.objects.create(
            creator=request.user,
            title=title,
            subtitle=subtitle,
            body_html=body_html,
        )

    return JsonResponse({"contract": _contract_data(contract, include_body=True)}, status=201 if not contract_id else 200)


@require_POST
@api_login_required
def contract_invite(request):
    data, error = _json_body(request)
    if error:
        return error

    try:
        contract = request.user.contracts.get(id=data.get("contractId"))
    except (Contract.DoesNotExist, ValueError):
        return JsonResponse({"detail": "Contract not found."}, status=404)

    form = InviteEmailForm(data, user=request.user)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)
    email = form.cleaned_data["email"]

    if contract.status == Contract.Status.EXECUTED:
        return JsonResponse({"detail": "Executed contracts cannot be re-invited."}, status=409)

    with transaction.atomic():
        contract.invited_email = email
        contract.save(update_fields=["invited_email", "updated_at"])
        invitation, raw_token = _issue_invitation(contract, email)
        send_invitation_email(contract, invitation, raw_token, request.user)
    return JsonResponse({"contract": _contract_data(contract), "invitation": {"email": invitation.email, "status": invitation.status}})


@require_POST
@api_login_required
def contract_send(request):
    data, error = _json_body(request)
    if error:
        return error

    form = ContractSendForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)
    email = form.cleaned_data["email"]

    with transaction.atomic():
        contract_id = data.get("contractId")
        if contract_id:
            try:
                contract = request.user.contracts.select_for_update().get(id=contract_id)
            except (Contract.DoesNotExist, ValueError):
                return JsonResponse({"detail": "Contract not found."}, status=404)
            if contract.status == Contract.Status.EXECUTED:
                return JsonResponse({"detail": "Executed contracts cannot be re-invited."}, status=409)
        else:
            contract = Contract(creator=request.user)

        contract.title = form.resolved_title(fallback=contract.title)
        contract.subtitle = form.cleaned_data["subtitle"]
        contract.body_html = form.cleaned_data["bodyHtml"]
        contract.invited_email = email
        contract.status = Contract.Status.SENT
        contract.sent_at = timezone.now()
        contract.save()

        invitation, raw_token = _issue_invitation(contract, email)
        send_invitation_email(contract, invitation, raw_token, request.user)

    return JsonResponse({"contract": _contract_data(contract), "invitation": {"email": invitation.email, "status": invitation.status}}, status=201)


@require_POST
@api_login_required
def contract_invitation_revoke(request, contract_id):
    try:
        contract = request.user.contracts.get(id=contract_id)
        invitation = contract.invitation
    except (Contract.DoesNotExist, ContractInvitation.DoesNotExist, ValueError):
        return JsonResponse({"detail": "Invitation not found."}, status=404)

    invitation.status = ContractInvitation.Status.REVOKED
    invitation.revoked_at = timezone.now()
    invitation.token_hash = ""
    invitation.save(update_fields=["status", "revoked_at", "token_hash"])
    return JsonResponse({"contract": _contract_data(contract), "invitation": {"status": invitation.status}})


@require_POST
@api_login_required
def invitation_claim(request, token):
    invitation = _get_active_invitation(token)
    if not invitation:
        return JsonResponse({"detail": "This invitation is invalid, expired, or revoked."}, status=404)
    if not request.user.email or request.user.email.strip().lower() != invitation.email.strip().lower():
        return JsonResponse({"detail": "This account email does not match the invited email."}, status=403)
    if invitation.invitee_user_id and invitation.invitee_user_id != request.user.id:
        return JsonResponse({"detail": "This invitation is already claimed by another account."}, status=409)

    if not invitation.invitee_user_id:
        invitation.invitee_user = request.user
        invitation.save(update_fields=["invitee_user"])
    return JsonResponse({"contract": _contract_data(invitation.contract, include_body=True), "claimed": True})


@require_GET
def invitation_detail(_request, token):
    invitation = _get_invitation(token, allow_accepted=True)
    if not invitation:
        return JsonResponse({"detail": "This invitation is invalid, expired, or revoked."}, status=404)

    return JsonResponse({
        "invitation": {
            "email": invitation.email,
            "status": invitation.status,
            "expiresAt": invitation.expires_at.isoformat() if invitation.expires_at else None,
            "creator": invitation.contract.creator.username,
        },
        "contract": _contract_data(invitation.contract, include_body=True),
        "comments": [_comment_data(comment) for comment in invitation.contract.comments.all()],
    })


@require_http_methods(["GET", "POST"])
def invitation_comments(request, token):
    invitation = _get_invitation(token, allow_accepted=True)
    if not invitation:
        return JsonResponse({"detail": "This invitation is invalid, expired, or revoked."}, status=404)

    if request.method == "GET":
        return JsonResponse({"comments": [_comment_data(comment) for comment in invitation.contract.comments.all()]})

    if not _can_add_comments(invitation.contract) or invitation.status == ContractInvitation.Status.ACCEPTED:
        return JsonResponse({"detail": "Comments are disabled for this contract."}, status=409)

    data, error = _json_body(request)
    if error:
        return error

    form = GuestCommentForm(data, contract=invitation.contract)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)

    comment = ContractComment.objects.create(
        contract=invitation.contract,
        invitation=invitation,
        author_name=form.cleaned_data["authorName"],
        **form.comment_fields(),
    )
    return JsonResponse({"comment": _comment_data(comment)}, status=201)


@require_http_methods(["GET", "POST"])
@api_login_required
def contract_comments(request, contract_id):
    contract = _reviewable_contract_for_user(request, contract_id)
    if not contract:
        return JsonResponse({"detail": "Contract not found."}, status=404)
    if request.method == "GET":
        return JsonResponse({"comments": [_comment_data(comment) for comment in contract.comments.all()]})
    if not _can_add_comments(contract) or contract.creator_id == request.user.id:
        return JsonResponse({"detail": "Comments can only be added by an invitee before execution."}, status=403 if contract.creator_id == request.user.id else 409)

    data, error = _json_body(request)
    if error:
        return error

    form = CommentForm(data, contract=contract)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)

    comment = ContractComment.objects.create(
        contract=contract,
        invitation=contract.invitation,
        author_user=request.user,
        author_name=request.user.get_full_name().strip() or request.user.username,
        **form.comment_fields(),
    )
    return JsonResponse({"comment": _comment_data(comment)}, status=201)


@csrf_exempt
@require_POST
def invitation_sign(request, token):
    data, error = _json_body(request)
    if error:
        return error

    invitation = _get_active_invitation(token)
    if not invitation:
        return JsonResponse({"detail": "This invitation is invalid, expired, or revoked."}, status=404)

    form = InvitationSignForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)

    mode = form.cleaned_data["mode"]
    signer_user = None
    if mode == InvitationSignForm.MODE_ACCOUNT:
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Sign in to sign this contract with your account."}, status=401)
        if request.user.email.strip().lower() != invitation.email.strip().lower():
            return JsonResponse({"detail": "This account email does not match the invited email."}, status=403)
        if invitation.invitee_user_id != request.user.id:
            return JsonResponse({"detail": "Claim this invitation before signing with your account."}, status=409)
        signer_user = request.user
        signer_name = request.user.get_full_name().strip() or request.user.username
    else:
        signer_name = form.cleaned_data["signerName"]

    now = timezone.now()
    with transaction.atomic():
        invitation.status = ContractInvitation.Status.ACCEPTED
        invitation.accepted_at = now
        invitation.signed_at = now
        invitation.signer_name = signer_name
        invitation.signer_user = signer_user
        invitation.signature_mode = mode
        invitation.save(update_fields=["status", "accepted_at", "signed_at", "signer_name", "signer_user", "signature_mode"])
        invitation.contract.status = Contract.Status.EXECUTED
        invitation.contract.save(update_fields=["status", "updated_at"])
        transaction.on_commit(lambda: send_executed_emails(invitation.contract, invitation))

    return JsonResponse({"detail": "Contract signed successfully.", "status": "accepted"})


@require_POST
@api_login_required
def contract_sign(request, contract_id):
    contract = _reviewable_contract_for_user(request, contract_id)
    if not contract or contract.creator_id == request.user.id:
        return JsonResponse({"detail": "Contract not found."}, status=404)
    if contract.status == Contract.Status.EXECUTED:
        return JsonResponse({"detail": "This contract has already been executed."}, status=409)
    invitation = contract.invitation
    if invitation.invitee_user_id != request.user.id or invitation.status != ContractInvitation.Status.SENT:
        return JsonResponse({"detail": "This invitation is not available for signing."}, status=403)

    now = timezone.now()
    with transaction.atomic():
        invitation.status = ContractInvitation.Status.ACCEPTED
        invitation.accepted_at = now
        invitation.signed_at = now
        invitation.signer_name = request.user.get_full_name().strip() or request.user.username
        invitation.signer_user = request.user
        invitation.signature_mode = "account"
        invitation.save(update_fields=["status", "accepted_at", "signed_at", "signer_name", "signer_user", "signature_mode"])
        contract.status = Contract.Status.EXECUTED
        contract.save(update_fields=["status", "updated_at"])
        transaction.on_commit(lambda: send_executed_emails(contract, invitation))

    return JsonResponse({"detail": "Contract signed successfully.", "status": "accepted"})


@require_POST
@api_login_required
def contract_comment_status(request, contract_id, comment_id):
    try:
        contract = request.user.contracts.get(id=contract_id)   # creator only
    except (Contract.DoesNotExist, ValueError):
        return JsonResponse({"detail": "Contract not found."}, status=404)
    if contract.status == Contract.Status.EXECUTED:
        return JsonResponse({"detail": "Executed contracts cannot be changed."}, status=409)

    data, error = _json_body(request)
    if error:
        return error

    form = CommentStatusForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)
    new_status = form.cleaned_data["status"]

    try:
        comment = contract.comments.get(id=comment_id)
    except ContractComment.DoesNotExist:
        return JsonResponse({"detail": "Comment not found."}, status=404)

    comment.status = new_status
    comment.status_changed_at = timezone.now()
    comment.save(update_fields=["status", "status_changed_at"])
    return JsonResponse({"comment": _comment_data(comment)})


@require_http_methods(["DELETE"])
@api_login_required
def contract_comment_delete(request, contract_id, comment_id):
    contract = _reviewable_contract_for_user(request, contract_id)
    if not contract:
        return JsonResponse({"detail": "Contract not found."}, status=404)
    if contract.status == Contract.Status.EXECUTED:
        return JsonResponse({"detail": "Comments cannot be removed after execution."}, status=409)

    try:
        comment = contract.comments.get(id=comment_id, author_user=request.user)
    except ContractComment.DoesNotExist:
        return JsonResponse({"detail": "Comment not found."}, status=404)

    comment.delete()   # status is intentionally not checked: pending, resolved and rejected can all be deleted
    return JsonResponse({"deleted": comment_id})