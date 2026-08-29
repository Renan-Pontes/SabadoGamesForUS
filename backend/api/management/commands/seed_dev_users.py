"""
Contas de desenvolvimento: um admin e um punhado de jogadores de teste.

Party game é difícil de testar sozinho — para abrir uma sala de A Caçada você
precisa de 3 pessoas, e A Resistência exige 5. Este comando cria contas
prontas para você abrir várias abas anônimas e jogar contra si mesmo.

NUNCA roda com DEBUG desligado: senha conhecida em produção é conta invadida.
"""

import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from api.models import Profile

User = get_user_model()

DEFAULT_PASSWORD = "sabado123"
DEFAULT_PLAYERS = 6
ADMIN_EMAIL = "admin@sabado.local"


class Command(BaseCommand):
    help = "Cria conta admin e jogadores de teste (somente com DEBUG ligado)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--players",
            type=int,
            default=DEFAULT_PLAYERS,
            help=f"Quantos jogadores de teste criar (padrão: {DEFAULT_PLAYERS}).",
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("DEV_PASSWORD", DEFAULT_PASSWORD),
            help="Senha das contas. Também aceita a variável DEV_PASSWORD.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Roda mesmo com DEBUG desligado. Use por sua conta e risco.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "DEBUG está desligado. Este comando cria contas com senha conhecida "
                "e não deve rodar em produção. Use --force se souber o que está fazendo."
            )

        password = options["password"]
        count = max(1, options["players"])

        admin = self._upsert(
            email=ADMIN_EMAIL,
            nickname="Admin",
            password=password,
            superuser=True,
        )
        self.stdout.write(self.style.SUCCESS(f"admin: {admin.email}"))

        for index in range(1, count + 1):
            user = self._upsert(
                email=f"teste{index}@sabado.local",
                nickname=f"Teste {index}",
                password=password,
            )
            self.stdout.write(f"  jogador: {user.email}")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Senha de todas as contas: {password}"))
        self.stdout.write("Painel do Django: /admin/")
        self.stdout.write(
            "Dica: abra cada jogador numa janela anônima diferente — o token fica "
            "no localStorage, então abas normais compartilham a mesma sessão."
        )

    def _upsert(self, email, nickname, password, superuser=False):
        """Cria ou atualiza a conta, sempre reescrevendo a senha."""
        user, _ = User.objects.get_or_create(
            username=email,
            defaults={"email": email},
        )
        user.email = email
        user.set_password(password)
        if superuser:
            user.is_staff = True
            user.is_superuser = True
        user.save()

        # O app exige um Profile com apelido único para a pessoa entrar na sala.
        profile = Profile.objects.filter(user=user).first()
        if profile:
            profile.nickname = nickname
            profile.save(update_fields=["nickname"])
        elif not Profile.objects.filter(nickname__iexact=nickname).exists():
            Profile.objects.create(user=user, nickname=nickname)

        return user
