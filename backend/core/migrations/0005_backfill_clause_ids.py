import re
import uuid

from django.db import migrations


def backfill_clause_ids(apps, schema_editor):
    Contract = apps.get_model("core", "Contract")

    def add_ids(match):
        opening, content, closing = match.groups()

        def add_id(li_match):
            tag = li_match.group(0)
            if re.search(r"\bdata-clause-id\s*=", tag, flags=re.IGNORECASE):
                return tag
            return tag[:-1] + f' data-clause-id="{uuid.uuid4().hex}">'

        return opening + re.sub(r"<li\b[^>]*>", add_id, content, flags=re.IGNORECASE) + closing

    for contract in Contract.objects.all().iterator():
        updated = re.sub(r"(<ol\b[^>]*>)(.*?)(</ol>)", add_ids, contract.body_html or "", flags=re.IGNORECASE | re.DOTALL)
        if updated != contract.body_html:
            Contract.objects.filter(pk=contract.pk).update(body_html=updated)


class Migration(migrations.Migration):
    dependencies = [("core", "0004_collaboration_fields")]
    operations = [migrations.RunPython(backfill_clause_ids, migrations.RunPython.noop)]
