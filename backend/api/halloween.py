"""
Os jogos da Noite do Terror (Halloween 2026).

Nesses jogos a TV é o juiz: as regras rodam no navegador dela e o backend só
guarda e entrega JSON (ver deposito.py e HALLOWEEN.md). Por isso nada aqui
conhece regra de jogo — basta saber quais slugs são "da TV" para o resto do
backend (start, ticks, redatores) deixá-los em paz.

A lista é a mesma, e na mesma ordem, de frontend/src/halloween/slugs.ts.
"""

HALLOWEEN_SLUGS = (
    "espiao-assombrado",
    "cidade-dorme",
    "retrato-assombrado",
    "mentira-macabra",
    "resposta-do-alem",
    "quem-morre-primeiro",
    "abobora-bomba",
    "portas-do-alem",
    "quiz-do-terror",
    "corrida-de-vassouras",
)

_HALLOWEEN_SET = frozenset(HALLOWEEN_SLUGS)


def is_halloween(slug: str | None) -> bool:
    """O jogo é da TV-juiz? Então o backend só guarda o estado, sem motor."""
    return slug in _HALLOWEEN_SET
