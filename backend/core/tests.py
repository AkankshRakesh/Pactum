import hashlib
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Contract, ContractComment, ContractInvitation


class ContractCollaborationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="password123")
        self.invitee = User.objects.create_user(username="invitee", email="invitee@example.com", password="password123")
        self.other = User.objects.create_user(username="other", email="other@example.com", password="password123")
        self.raw_token = secrets.token_urlsafe(24)
        self.contract = Contract.objects.create(
            creator=self.owner,
            title="Shared contract",
            body_html='<ol><li data-clause-id="clause-one">Payment is due within 30 days.</li><li data-clause-id="clause-two">Either party may terminate.</li></ol>',
            status=Contract.Status.SENT,
        )
        self.invitation = ContractInvitation.objects.create(
            contract=self.contract,
            email=self.invitee.email,
            status=ContractInvitation.Status.SENT,
            token_hash=hashlib.sha256(self.raw_token.encode()).hexdigest(),
            expires_at=timezone.now() + timedelta(days=2),
        )

    def test_owner_can_read_and_edit_own_contract_but_not_another_users(self):
        self.client.force_login(self.owner)
        response = self.client.get(f"/api/contracts/{self.contract.id}/")
        self.assertEqual(response.status_code, 200)

        response = self.client.post("/api/contracts/save/", {"id": str(self.contract.id), "title": "Updated", "bodyHtml": "<ol><li>New clause</li></ol>"}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.contract.refresh_from_db()
        self.assertIn("data-clause-id", self.contract.body_html)

        response = self.client.post("/api/contracts/save/", {"id": str(self.contract.id), "bodyHtml": '<ol><li data-clause-id="clause-one">New first</li><li data-clause-id="clause-two">New second</li></ol>'}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertIn('data-clause-id="clause-one"', response.json()["contract"]["bodyHtml"])
        self.assertIn('data-clause-id="clause-two"', response.json()["contract"]["bodyHtml"])

        self.client.force_login(self.other)
        response = self.client.get(f"/api/contracts/{self.contract.id}/")
        self.assertEqual(response.status_code, 404)
        response = self.client.post("/api/contracts/save/", {"id": str(self.contract.id), "bodyHtml": "<p>tampered</p>"}, content_type="application/json")
        self.assertEqual(response.status_code, 404)

    def test_owner_cannot_edit_executed_contract(self):
        self.contract.status = Contract.Status.EXECUTED
        self.contract.save(update_fields=["status"])
        self.client.force_login(self.owner)
        response = self.client.post("/api/contracts/save/", {"id": str(self.contract.id), "bodyHtml": "<p>tampered</p>"}, content_type="application/json")
        self.assertEqual(response.status_code, 409)

    def test_authenticated_invitee_must_claim_and_then_sees_same_contract(self):
        self.client.force_login(self.invitee)
        response = self.client.get(f"/api/contracts/{self.contract.id}/review/")
        self.assertEqual(response.status_code, 404)

        response = self.client.post(f"/api/invitations/{self.raw_token}/claim/")
        self.assertEqual(response.status_code, 200)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.invitee_user_id, self.invitee.id)
        self.assertEqual(self.invitation.status, ContractInvitation.Status.SENT)

        response = self.client.get("/api/contracts/invited/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["contracts"][0]["id"], str(self.contract.id))
        response = self.client.get(f"/api/contracts/{self.contract.id}/review/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["contract"]["id"], str(self.contract.id))

    def test_wrong_user_cannot_claim_or_comment(self):
        self.client.force_login(self.other)
        response = self.client.post(f"/api/invitations/{self.raw_token}/claim/")
        self.assertEqual(response.status_code, 403)
        response = self.client.post(f"/api/contracts/{self.contract.id}/comments/", {"clauseId": "clause-one", "body": "No access"}, content_type="application/json")
        self.assertEqual(response.status_code, 404)

    def test_guest_comment_and_authenticated_comment_share_the_contract(self):
        response = self.client.post(f"/api/invitations/{self.raw_token}/comments/", {"clauseId": "clause-one", "quotedText": "Payment is due within 30 days.", "body": "Please clarify whether holidays count.", "authorName": "Guest Reviewer"}, content_type="application/json")
        self.assertEqual(response.status_code, 201)

        self.client.force_login(self.invitee)
        self.client.post(f"/api/invitations/{self.raw_token}/claim/")
        response = self.client.post(f"/api/contracts/{self.contract.id}/comments/", {"clauseId": "clause-two", "quotedText": "Either party may terminate.", "body": "Add a notice period.", "authorName": "Spoofed Name"}, content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["comment"]["authorName"], "invitee")
        self.assertEqual(ContractComment.objects.filter(contract=self.contract).count(), 2)

        self.client.force_login(self.owner)
        response = self.client.get(f"/api/contracts/{self.contract.id}/comments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["comments"]), 2)

    def test_invitee_cannot_save_document_and_deleted_clause_does_not_reassign_comment(self):
        self.client.force_login(self.invitee)
        self.client.post(f"/api/invitations/{self.raw_token}/claim/")
        response = self.client.post("/api/contracts/save/", {"id": str(self.contract.id), "bodyHtml": "<p>tampered</p>"}, content_type="application/json")
        self.assertEqual(response.status_code, 404)

        comment = ContractComment.objects.create(contract=self.contract, invitation=self.invitation, clause_id="clause-one", clause_index=1, quoted_text="Payment", author_name="Guest", body="Question")
        self.contract.body_html = '<ol><li data-clause-id="clause-two">Either party may terminate.</li></ol>'
        self.contract.save(update_fields=["body_html"])
        comment.refresh_from_db()
        self.assertEqual(comment.clause_id, "clause-one")

    def test_executed_contract_is_readable_but_not_mutable(self):
        self.invitation.invitee_user = self.invitee
        self.invitation.status = ContractInvitation.Status.ACCEPTED
        self.invitation.save(update_fields=["invitee_user", "status"])
        self.contract.status = Contract.Status.EXECUTED
        self.contract.save(update_fields=["status"])
        ContractComment.objects.create(contract=self.contract, invitation=self.invitation, clause_id="clause-one", body="Existing history")

        self.client.force_login(self.invitee)
        self.assertEqual(self.client.get(f"/api/contracts/{self.contract.id}/review/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/contracts/{self.contract.id}/comments/").status_code, 200)
        response = self.client.post(f"/api/contracts/{self.contract.id}/comments/", {"clauseId": "clause-one", "body": "Late change"}, content_type="application/json")
        self.assertEqual(response.status_code, 409)
        response = self.client.post("/api/contracts/save/", {"id": str(self.contract.id), "bodyHtml": "<p>tampered</p>"}, content_type="application/json")
        self.assertEqual(response.status_code, 404)

    def test_expired_and_revoked_guest_links_are_rejected(self):
        self.invitation.expires_at = timezone.now() - timedelta(minutes=1)
        self.invitation.save(update_fields=["expires_at"])
        self.assertEqual(self.client.get(f"/api/invitations/{self.raw_token}/").status_code, 404)

        self.invitation.expires_at = timezone.now() + timedelta(days=1)
        self.invitation.status = ContractInvitation.Status.REVOKED
        self.invitation.token_hash = ""
        self.invitation.save(update_fields=["expires_at", "status", "token_hash"])
        self.assertEqual(self.client.get(f"/api/invitations/{self.raw_token}/").status_code, 404)
