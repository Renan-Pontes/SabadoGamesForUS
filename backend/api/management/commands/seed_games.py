from django.core.management.base import BaseCommand

from api.models import Game


class Command(BaseCommand):
    help = "Seed initial games."

    def handle(self, *args, **options):
        games = [
            {
                "slug": "read-my-mind",
                "name": "Read My Mind",
                "description": (
                    "Ordene cartas em silêncio. Co-op: sobrevivam até a rodada 10; "
                    "Versus: elimine quem cortar a sequência."
                ),
                "min_players": 2,
                "max_players": 10,
                "is_active": True,
            },
            {
                "slug": "confinamento-solitario",
                "name": "Confinamento Solitario: Valete de Copas",
                "description": (
                    "Descubra seu próprio naipe olhando o dos outros. "
                    "Se errar, você é eliminado. O jogo termina quando o valete sai."
                ),
                "min_players": 3,
                "max_players": 12,
                "is_active": True,
            },
            {
                "slug": "concurso-de-beleza",
                "name": "Concurso de Beleza: Rei de Ouros",
                "description": (
                    "Escolha um número de 0 a 100. A média * 0.8 define o alvo. "
                    "Quem chegar mais perto vence; os demais perdem pontos."
                ),
                "min_players": 3,
                "max_players": 12,
                "is_active": True,
            },
            {
                "slug": "future-sugoroku",
                "name": "Future Sugoroku",
                "description": (
                    "Role os dados, escolha portas e encontre a saída em até 15 turnos."
                ),
                "min_players": 2,
                "max_players": 16,
                "is_active": True,
            },
            {
                "slug": "leilao-de-cem-votos",
                "name": "Leilão de Cem Votos",
                "description": (
                    "Aposte pontos para ganhar o pote da rodada. O excedente aumenta o pote seguinte."
                ),
                "min_players": 2,
                "max_players": 12,
                "is_active": True,
            },
        ]

        for data in games:
            obj, created = Game.objects.update_or_create(slug=data["slug"], defaults=data)
            action = "Created" if created else "Updated"
            self.stdout.write(f"{action} {obj.name}")
