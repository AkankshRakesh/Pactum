from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def move_comments_to_contract(apps, schema_editor):
    ContractComment = apps.get_model("core", "ContractComment")
    for comment in ContractComment.objects.select_related("invitation__contract").all():
        comment.contract_id = comment.invitation.contract_id
        comment.save(update_fields=["contract"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_contractcomment"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="contractinvitation",
            name="invitee_user",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="claimed_invitations", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="contractcomment",
            name="author_user",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="contract_comments", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="contractcomment",
            name="clause_id",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="contractcomment",
            name="quoted_text",
            field=models.TextField(blank=True, max_length=1000),
        ),
        migrations.AddField(
            model_name="contractcomment",
            name="contract",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="core.contract"),
        ),
        migrations.AlterField(
            model_name="contractcomment",
            name="invitation",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="comments", to="core.contractinvitation"),
        ),
        migrations.AlterField(
            model_name="contractcomment",
            name="author_name",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AlterField(
            model_name="contractcomment",
            name="clause_index",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(move_comments_to_contract, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="contractcomment",
            name="contract",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="core.contract"),
        ),
    ]
