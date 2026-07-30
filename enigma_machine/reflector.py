"""Fixed involutive reflector component."""

from typing import Tuple

from .alphabet import (
    ALPHABET_SIZE,
    to_index,
    to_letter,
    validate_permutation,
    validate_signal,
)


class Reflector:
    """A fixed-point-free involutive permutation of the alphabet."""

    def __init__(self, name: str, wiring: str) -> None:
        if not isinstance(name, str) or not name:
            raise ValueError("reflector name must be a non-empty string")
        if not isinstance(wiring, str):
            raise TypeError("reflector wiring must be a string")
        wiring = wiring.upper()
        if len(wiring) != ALPHABET_SIZE:
            raise ValueError("reflector wiring must contain exactly 26 letters")

        permutation = validate_permutation(
            (to_index(letter) for letter in wiring),
            "{} wiring".format(name),
        )
        for source, target in enumerate(permutation):
            if source == target:
                raise ValueError("reflector cannot map a letter to itself")
            if permutation[target] != source:
                raise ValueError("reflector wiring must be involutive")

        self.name = name
        self._wiring: Tuple[int, ...] = permutation

    @property
    def wiring(self) -> str:
        return "".join(to_letter(value) for value in self._wiring)

    @property
    def pairs(self) -> Tuple[Tuple[str, str], ...]:
        """Return the 13 unordered contact pairs."""
        return tuple(
            (to_letter(source), to_letter(target))
            for source, target in enumerate(self._wiring)
            if source < target
        )

    def reflect(self, signal: int) -> int:
        validate_signal(signal)
        return self._wiring[signal]
