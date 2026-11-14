
from django.contrib import admin

from .models import Contract, ContractInvitation, ContractComment


class CommentInline(admin.TabularInline):
    model = ContractComment
    extra = 0
    readonly_fields = ("created_at",)
    fields = ("author_name", "body", "status", "created_at")


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "creator",
        "status",
        "invited_email",
        "updated_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "title",
        "creator__username",
        "invited_email",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
    inlines = [CommentInline]
    actions = ["mark_as_draft"]

    @admin.action(description="Reset selected contracts to draft")
    def mark_as_draft(self, request, queryset):
        queryset.exclude(
            status=Contract.Status.EXECUTED
        ).update(status=Contract.Status.DRAFT)


@admin.register(ContractInvitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "contract",
        "email",
        "status",
        "expires_at",
        "signed_at",
    )
    list_filter = ("status", "signature_mode")
    search_fields = ("email", "contract__title")
    exclude = ("token_hash",)


@admin.register(ContractComment)
class CommentAdmin(admin.ModelAdmin):
    list_display = (
        "contract",
        "author_name",
        "status",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "body",
        "author_name",
        "contract__title",
    )
