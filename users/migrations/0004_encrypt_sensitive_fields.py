from django.db import migrations, models

import fakerni.crypto_fields


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_name_devicetoken'),
    ]

    operations = [
        migrations.AlterField(
            model_name='devicetoken',
            name='token',
            field=fakerni.crypto_fields.EncryptedCharField(max_length=255, unique=False),
        ),
        migrations.AddField(
            model_name='devicetoken',
            name='token_hash',
            field=models.CharField(default='', editable=False, max_length=64, unique=True),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='passwordresetotp',
            name='code',
            field=fakerni.crypto_fields.EncryptedCharField(max_length=6),
        ),
    ]
