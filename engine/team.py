"""The shared team model every engine reads. A Member is a species plus whatever is known about
the individual; anything left empty is judged from what the species *can* do in that game."""
from dataclasses import dataclass, field

import rules


@dataclass
class Member:
    species: str
    moves: list = field(default_factory=list)   # empty = judge by the learnable pool
    ability: str | None = None
    item: str | None = None
    nature: str | None = None
    evs: dict = field(default_factory=dict)
    ivs: dict = field(default_factory=dict)
    level: int = 50


@dataclass
class Team:
    game: str
    members: list
    name: str = ""

    @property
    def gen(self):
        return rules.GAME_GEN[self.game]

    @property
    def vg(self):
        return rules.GAME_VG[self.game]

    @classmethod
    def of(cls, game, species, name=""):
        return cls(game, [Member(s) for s in species], name)
