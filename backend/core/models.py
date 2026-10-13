import uuid

from django.conf import settings
from django.db import models


class Contract(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        EXECUTED = "executed", "Executed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="contracts")
    title = models.CharField(max_length=200, default="Untitled contract")
    subtitle = models.CharField(max_length=500, blank=True)
    body_html = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    invited_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-updated_at",)


class ContractInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"

    contract = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name="invitation")
    email = models.EmailField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    token_hash = models.CharField(max_length=128, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    signer_name = models.CharField(max_length=200, blank=True)
    invitee_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="claimed_invitations")
    signer_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="signed_invitations")
    signature_mode = models.CharField(max_length=16, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)


class ContractComment(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="comments")
    invitation = models.ForeignKey(ContractInvitation, null=True, blank=True, on_delete=models.SET_NULL, related_name="comments")
    author_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="contract_comments")
    author_name = models.CharField(max_length=200, blank=True)
    clause_id = models.CharField(max_length=64, blank=True)
    quoted_text = models.TextField(max_length=1000, blank=True)
    clause_index = models.PositiveIntegerField(null=True, blank=True)
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RESOLVED = "resolved", "Resolved"
        REJECTED = "rejected", "Rejected"

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    status_changed_at = models.DateTimeField(null=True, blank=True)
