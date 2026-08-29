"""
Cria (ou atualiza) a conta de administrador.

O `createsuperuser` do Django não cria o `Profile`, que é onde mora o apelido
usado nas salas — uma conta sem perfil entra no painel mas aparece como o
e-mail inteiro na mesa. Este comando cria os dois.

A senha nunca fica no código: vem do prompt ou de DJANGO_SUPERUSER_PASSWORD.
Por isso, ao contrário de `seed_dev_users`, este comando pode rodar em
produção — quem escolhe a senha é quem executa.

    python manage.py ensure_admin --email voce@exemplo.com --nickname Renan
"""

import getpass
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Profile

User = get_user_model()

PASSWORD_ENV = "DJANGO_SUPERUSER_PASSWORD"


class Command(BaseCommand):
    help = "Cria ou atualiza um superusuário com perfil (apelido) de jogador."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="E-mail e login da conta.")
        parser.add_argument(
            "--nickname",
            help="Apelido nas salas. Sem isso, usa a parte antes do @.",
        )
        parser.add_argument(
            "--skip-password",
            action="store_true",
            help="Só garante o superusuário e o perfil, sem mexer na senha.",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        if "@" not in email:
            raise CommandError("Informe um e-mail válido.")

        nickname = (options.get("nickname") or email.split("@")[0]).strip()
        password = None

        if not options["skip_password"]:
            password = os.environ.get(PASSWORD_ENV)
            if not password:
                password = getpass.getpass("Senha: ")
                confirmation = getpass.getpass("Confirme a senha: ")
                if password != confirmation:
                    raise CommandError("As senhas não conferem.")
            if not password:
                raise CommandError(
                    f"Senha vazia. Informe no prompt ou em {PASSWORD_ENV}."
                )

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=email, defaults={"email": email}
            )
            user.email = email
            user.is_staff = True
            user.is_superuser = True

            if password:
                try:
                    validate_password(password, user)
                except ValidationError as error:
                    raise CommandError(
                        "Senha recusada: " + " ".join(error.messages)
                    ) from error
                user.set_password(password)

            user.save()

            profile = Profile.objects.filter(user=user).first()
            if profile:
                if profile.nickname != nickname:
                    clash = (
                        Profile.objects.filter(nickname__iexact=nickname)
                        .exclude(pk=profile.pk)
                        .exists()
                    )
                    if clash:
                        raise CommandError(f"O apelido '{nickname}' já está em uso.")
                    profile.nickname = nickname
                    profile.save(update_fields=["nickname"])
            else:
                if Profile.objects.filter(nickname__iexact=nickname).exists():
                    raise CommandError(f"O apelido '{nickname}' já está em uso.")
                Profile.objects.create(user=user, nickname=nickname)

        verb = "criada" if created else "atualizada"
        self.stdout.write(self.style.SUCCESS(f"Conta {verb}: {email} ({nickname})"))
        if password:
            self.stdout.write("Senha definida.")
        self.stdout.write("Painel: /admin/")
