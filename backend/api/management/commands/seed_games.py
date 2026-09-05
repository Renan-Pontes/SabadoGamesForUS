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
            {
                "slug": "a-cacada",
                "name": "A Caçada",
                "description": (
                    "Cada um recebe uma pista sobre onde a criatura se esconde. "
                    "Só um hexágono do mapa satisfaz todas — encontre-o antes dos outros."
                ),
                "min_players": 3,
                "max_players": 6,
                "is_active": True,
            },
            {
                "slug": "sintonia",
                "name": "Sintonia",
                "description": (
                    "Um espectro, um alvo escondido e uma pista só. "
                    "A mesa discute e cada um aponta onde acha que está."
                ),
                "min_players": 3,
                "max_players": 12,
                "is_active": True,
            },
            {
                "slug": "caveira",
                "name": "Caveira",
                "description": (
                    "Três rosas e uma caveira. Empilhe, blefe e aposte quantas "
                    "cartas consegue virar sem achar a caveira."
                ),
                "min_players": 3,
                "max_players": 6,
                "is_active": True,
            },
            {
                "slug": "resistencia",
                "name": "A Resistência",
                "description": (
                    "Espiões infiltrados sabotam missões em segredo. "
                    "Cinco missões, votação aberta e nenhuma certeza."
                ),
                "min_players": 5,
                "max_players": 10,
                "is_active": True,
            },
            {
                "slug": "palavra-chave",
                "name": "Palavra-Chave",
                "description": (
                    "Dois times, 25 palavras e um espião-mestre que só pode dizer "
                    "uma palavra e um número. Cuidado com o assassino."
                ),
                "min_players": 4,
                "max_players": 12,
                "is_active": True,
            },
            {
                "slug": "o-infiltrado",
                "name": "O Infiltrado",
                "description": (
                    "Todos sabem onde estão, menos um. Perguntem entre si sem "
                    "entregar o local — e descubram quem está blefando."
                ),
                "min_players": 3,
                "max_players": 12,
                "is_active": True,
            },
            {
                "slug": "perfil",
                "name": "Perfil",
                "description": (
                    "Dicas reveladas uma a uma sobre uma pessoa, lugar, coisa, "
                    "ano ou ficção. Quem acerta primeiro leva mais pontos."
                ),
                "min_players": 2,
                "max_players": 12,
                "is_active": True,
            },
            {
                "slug": "camaleao",
                "name": "Camaleão",
                "description": (
                    "Todos sabem a palavra secreta, menos o camaleão. "
                    "Cada um diz uma palavra; descubram quem está blefando."
                ),
                "min_players": 3,
                "max_players": 10,
                "is_active": True,
            },
            {
                "slug": "lobisomem",
                "name": "Lobisomem de Uma Noite",
                "description": (
                    "Uma noite de trocas secretas e uma manhã para descobrir quem é lobisomem. "
                    "O app narra; ninguém precisa dormir."
                ),
                "min_players": 3,
                "max_players": 10,
                "is_active": True,
            },
            {
                "slug": "blef-jack",
                "name": "Blef Jack",
                "description": (
                    "Receba 2 cartas, blefe o valor e tente adivinhar o vencedor da rodada."
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
