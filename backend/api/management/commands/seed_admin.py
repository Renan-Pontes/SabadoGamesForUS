"""
Garante a conta de administrador do Renan (roda no deploy, depois do
`seed_games`).

    login: renan@sabadogames.app   apelido: Renan   painel: /admin/

A senha NÃO está aqui: só o hash PBKDF2 dela (o mesmo formato que o Django
guarda no banco), que não dá para desfazer. A senha só é definida quando a
conta é criada — se ela já existe, o comando só garante que é admin e tem
perfil, sem mexer na senha (trocar a senha pelo site continua valendo).

    python manage.py seed_admin
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Profile

User = get_user_model()

ADMIN_EMAIL = "renan@sabadogames.app"
ADMIN_NICKNAME = "Renan"
ADMIN_PASSWORD_HASH = (
    "pbkdf2_sha256$1000000$G90o472tfIiFRdZn2zCl5x$1rt2Jb7nLzahOmZU5Kyh1z/YxW9ox5f2qlA83AmJzM0="
)


def free_nickname(wanted, user):
    """O apelido pedido, ou 'Renan (adm)', 'Renan (adm 2)'... se já tiver dono."""
    taken = Profile.objects.exclude(user=user)
    if not taken.filter(nickname__iexact=wanted).exists():
        return wanted
    candidate = f"{wanted} (adm)"
    number = 2
    while taken.filter(nickname__iexact=candidate).exists():
        candidate = f"{wanted} (adm {number})"
        number += 1
    return candidate


class Command(BaseCommand):
    help = "Garante a conta de administrador do Renan (sem senha no código: só o hash)."

    def handle(self, *args, **options):
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=ADMIN_EMAIL, defaults={"email": ADMIN_EMAIL}
            )
            user.email = ADMIN_EMAIL
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            if created:
                user.password = ADMIN_PASSWORD_HASH
            user.save()

            profile = Profile.objects.filter(user=user).first()
            if not profile:
                Profile.objects.create(user=user, nickname=free_nickname(ADMIN_NICKNAME, user))

        verb = "criada" if created else "conferida (senha mantida)"
        self.stdout.write(self.style.SUCCESS(f"Conta de admin {verb}: {ADMIN_EMAIL}"))
