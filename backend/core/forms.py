"""
Validation layer for the BindPact JSON API.

These are plain Django ``Form`` classes that you feed a parsed JSON dict
(``_json_body(request)``) instead of ``request.POST``. Views keep doing the
things that need the database *state* (ownership lookups, "already executed"
checks, auth checks) and delegate input validation/normalisation to forms.

Typical usage in a view:

    form = SignupForm(data)
    if not form.is_valid():
        return JsonResponse({"errors": form.error_dict()}, status=400)
    user = User.objects.create_user(
        username=form.cleaned_data["username"],
        email=form.cleaned_data["email"],
        password=form.cleaned_data["password"],
    )

For endpoints that return a single ``{"detail": ...}`` message:

    form = InviteEmailForm(data)
    if not form.is_valid():
        return JsonResponse({"detail": form.first_error()}, status=400)
"""
import re
import uuid

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import ContractComment

User = get_user_model()

DEFAULT_TITLE = "Untitled contract"


def available_username(base):
    max_length = User._meta.get_field("username").max_length
    base = base[:max_length]
    username = base
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        suffix_text = f"-{suffix}"
        username = f"{base[:max_length - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return username


# --------------------------------------------------------------------------- #
# HTML sanitising helpers (moved out of views.py)
# --------------------------------------------------------------------------- #

def clean_document_html(value):
    html = str(value or "")
    html = re.sub(r"<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>", "", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"\s+on[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", html, flags=re.IGNORECASE)
    html = re.sub(r"(href|src)\s*=\s*(['\"])\s*javascript:[^'\"]*\2", r"\1=\2#\2", html, flags=re.IGNORECASE)
    return html[:200000]


def normalise_clause_ids(html):
    """Add stable IDs to top-level ordered-list clauses without changing visible text."""
    seen = set()

    def add_ids(match):
        opening, content, closing = match.groups()

        def add_id(li_match):
            tag = li_match.group(0)
            existing = re.search(r"\bdata-clause-id\s*=\s*([\"'])(.*?)\1", tag, flags=re.IGNORECASE)
            existing_id = existing.group(2).strip() if existing else ""
            if existing_id and existing_id not in seen:
                seen.add(existing_id)
                return tag
            if existing:
                tag = tag[:existing.start()] + tag[existing.end():]
            clause_id = uuid.uuid4().hex
            seen.add(clause_id)
            return tag[:-1] + f' data-clause-id="{clause_id}"' + ">"

        return opening + re.sub(r"<li\b[^>]*>", add_id, content, flags=re.IGNORECASE) + closing

    return re.sub(r"(<ol\b[^>]*>)(.*?)(</ol>)", add_ids, html, flags=re.IGNORECASE | re.DOTALL)


# --------------------------------------------------------------------------- #
# Shared building blocks
# --------------------------------------------------------------------------- #

class StrictCharField(forms.CharField):
    """CharField that rejects non-string JSON values (numbers, lists, ...)
    instead of silently coercing them with str()."""

    def to_python(self, value):
        if value is not None and not isinstance(value, str):
            raise ValidationError(self.error_messages["required"], code="required")
        return super().to_python(value)


class APIFormMixin:
    """Helpers for turning form errors into JSON-friendly structures."""

    # Fields whose errors should always be returned as a list of messages.
    list_error_fields = ()

    def error_dict(self):
        """{"field": "message"} (or a list of messages for ``list_error_fields``)."""
        out = {}
        for field, errors in self.errors.items():
            messages = [str(message) for message in errors]
            if field in self.list_error_fields or len(messages) > 1:
                out[field] = messages
            else:
                out[field] = messages[0]
        return out

    def first_error(self):
        """First error message, for endpoints that return {"detail": ...}."""
        for errors in self.errors.values():
            for message in errors:
                return str(message)
        return "Invalid request."


class APIForm(APIFormMixin, forms.Form):
    pass


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #

class SignupForm(APIForm):
    list_error_fields = ("password",)

    username_field = User._meta.get_field("username")
    username = forms.CharField(
        max_length=username_field.max_length,
        validators=username_field.validators,
        error_messages={"required": "Username is required."},
    )
    email = forms.EmailField(error_messages={"required": "Email is required."})
    password = StrictCharField(strip=False, error_messages={"required": "Password is required."})
    passwordConfirm = StrictCharField(
        strip=False,
        error_messages={"required": "Password confirmation is required."},
    )

    def __init__(self, data=None, *args, **kwargs):
        if data is not None:
            data = dict(data)
            # Accept both camelCase and snake_case from the frontend.
            if "passwordConfirm" not in data and "password_confirm" in data:
                data["passwordConfirm"] = data["password_confirm"]
        super().__init__(data, *args, **kwargs)

    def clean_username(self):
        return available_username(self.cleaned_data["username"].lower())

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("That email is already in use.")
        return email

    def clean_password(self):
        password = self.cleaned_data["password"]
        validate_password(password)  # raises ValidationError with a list of messages
        return password

    def clean(self):
        cleaned = super().clean()
        password = cleaned.get("password")
        confirmation = cleaned.get("passwordConfirm")
        if password and confirmation and password != confirmation:
            self.add_error("passwordConfirm", "Passwords do not match.")
        return cleaned


class LoginForm(APIForm):
    """Normalises login input. Authentication itself still happens in the view
    so a bad login always yields the same generic 401."""

    identifier = forms.CharField(required=False)
    password = forms.CharField(required=False, strip=False)

    def __init__(self, data=None, *args, **kwargs):
        if data is not None:
            data = dict(data)
            if "identifier" not in data:
                data["identifier"] = data.get("username", "")
        super().__init__(data, *args, **kwargs)

    def resolve_username(self):
        """Return the username to authenticate with (maps an email to its username)."""
        identifier = self.cleaned_data["identifier"]
        if "@" in identifier:
            match = User.objects.filter(email__iexact=identifier).first()
            if match:
                return match.username
        else:
            match = User.objects.filter(username__iexact=identifier).first()
            if match:
                return match.username
        return identifier


# --------------------------------------------------------------------------- #
# Contracts
# --------------------------------------------------------------------------- #

class InviteEmailForm(APIForm):
    email = forms.EmailField(
        error_messages={
            "required": "A valid invited-party email is required.",
            "invalid": "A valid invited-party email is required.",
        }
    )

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()

        if (
            self.user
            and self.user.is_authenticated
            and self.user.email
            and email == self.user.email.strip().lower()
        ):
            raise forms.ValidationError(
                "You cannot invite yourself."
            )

        return email


class ContractContentForm(APIForm):
    title = forms.CharField(required=False)
    subtitle = forms.CharField(required=False)
    bodyHtml = forms.CharField(required=False, strip=False)

    def clean_title(self):
        return (self.cleaned_data.get("title") or "").strip()[:200]

    def clean_subtitle(self):
        return (self.cleaned_data.get("subtitle") or "").strip()[:500]

    def clean_bodyHtml(self):
        return normalise_clause_ids(clean_document_html(self.cleaned_data.get("bodyHtml", "")))

    def resolved_title(self, fallback=""):
        """Title to store. If the client didn't send a title at all, keep ``fallback``
        (e.g. the existing contract title); a blank title becomes 'Untitled contract'."""
        if "title" not in self.data:
            return fallback or DEFAULT_TITLE
        return self.cleaned_data["title"] or DEFAULT_TITLE


class ContractSaveForm(ContractContentForm):
    """Used by contract_save. ``id`` is left as a raw string; the view's
    ``request.user.contracts.get(id=...)`` still produces the 404."""

    id = forms.CharField(required=False)


class ContractSendForm(ContractContentForm, InviteEmailForm):
    """Used by contract_send (content + invitee email)."""


# --------------------------------------------------------------------------- #
# Comments
# --------------------------------------------------------------------------- #

class CommentForm(APIForm):
    """Validates a comment against a specific contract.

        form = CommentForm(data, contract=contract)
        if not form.is_valid():
            return JsonResponse({"detail": form.first_error()}, status=400)
        ContractComment.objects.create(..., **form.comment_fields())
    """

    body = forms.CharField(required=False)
    clauseId = forms.CharField(required=False)
    quotedText = forms.CharField(required=False)
    clauseIndex = forms.CharField(required=False)

    def __init__(self, data=None, *args, contract=None, **kwargs):
        self.contract = contract
        super().__init__(data, *args, **kwargs)

    def clean_body(self):
        body = (self.cleaned_data.get("body") or "").strip()
        if not body or len(body) > 2000:
            raise ValidationError("Comment body must be between 1 and 2000 characters.")
        return body

    def clean_clauseId(self):
        return (self.cleaned_data.get("clauseId") or "").strip()[:64]

    def clean_quotedText(self):
        return (self.cleaned_data.get("quotedText") or "").strip()[:1000]

    def clean_clauseIndex(self):
        raw = self.cleaned_data.get("clauseIndex")
        try:
            return int(raw) if raw not in (None, "") else None
        except (TypeError, ValueError):
            return None

    def clean(self):
        cleaned = super().clean()
        if self.errors:  # body (etc.) already failed; report that first
            return cleaned

        clause_id = cleaned.get("clauseId", "")
        clause_index = cleaned.get("clauseIndex")
        if not clause_id and (clause_index is None or clause_index < 1):
            raise ValidationError("A stable clause ID or legacy clause number is required.")
        if clause_id and self.contract is not None and not re.search(
            rf'data-clause-id=["\']{re.escape(clause_id)}["\']', self.contract.body_html
        ):
            raise ValidationError("That clause no longer exists in this contract.")
        return cleaned

    def comment_fields(self):
        """Kwargs ready for ``ContractComment.objects.create``."""
        return {
            "body": self.cleaned_data["body"],
            "clause_id": self.cleaned_data["clauseId"],
            "quoted_text": self.cleaned_data["quotedText"],
            "clause_index": self.cleaned_data["clauseIndex"],
        }


class GuestCommentForm(CommentForm):
    authorName = forms.CharField(
        required=False,
        error_messages={"required": "Your name is required to comment as a guest."},
    )
    field_order = ["authorName"]  # validate the name first, like the old view did

    def clean_authorName(self):
        name = (self.cleaned_data.get("authorName") or "").strip()[:200]
        if not name:
            raise ValidationError("Your name is required to comment as a guest.")
        return name


class CommentStatusForm(APIForm):
    status = forms.CharField(required=False)

    def clean_status(self):
        status = (self.cleaned_data.get("status") or "").strip().lower()
        if status not in ContractComment.Status.values:
            raise ValidationError("Status must be pending, resolved or rejected.")
        return status


# --------------------------------------------------------------------------- #
# Signing
# --------------------------------------------------------------------------- #

class InvitationSignForm(APIForm):
    MODE_ACCOUNT = "account"
    MODE_GUEST = "guest"

    mode = forms.CharField(required=False)
    signerName = forms.CharField(required=False)

    def clean_mode(self):
        if "mode" not in self.data:
            return self.MODE_GUEST
        mode = (self.cleaned_data.get("mode") or "").strip().lower()
        if mode not in (self.MODE_ACCOUNT, self.MODE_GUEST):
            raise ValidationError("Invalid signing mode.")
        return mode

    def clean_signerName(self):
        return (self.cleaned_data.get("signerName") or "").strip()[:200]

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("mode") == self.MODE_GUEST and not cleaned.get("signerName"):
            self.add_error("signerName", "Your name is required to sign as a guest.")
        return cleaned