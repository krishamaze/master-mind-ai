from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Project",
            new_name="Assignment",
        ),
        migrations.AlterField(
            model_name="assignment",
            name="owner",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="assignments",
                to="api.userprofile",
            ),
        ),
        migrations.RenameField(
            model_name="conversation",
            old_name="project",
            new_name="assignment",
        ),
        migrations.AlterField(
            model_name="conversation",
            name="assignment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="conversations",
                to="api.assignment",
            ),
        ),
    ]
