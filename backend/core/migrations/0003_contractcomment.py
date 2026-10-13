from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_contractinvitation_accepted_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContractComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("clause_index", models.PositiveIntegerField()),
                ("author_name", models.CharField(max_length=200)),
                ("body", models.TextField(max_length=2000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("invitation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="core.contractinvitation")),
            ],
            options={"ordering": ("created_at",)},
        ),
    ]
