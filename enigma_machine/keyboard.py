"""Keyboard input component."""

from dataclasses import dataclass
from typing import List, Tuple

from .alphabet import ALPHABET, to_index


@dataclass(frozen=True)
class Keyboard:
    """Convert physical key labels into electrical contact numbers."""

    @property
    def keys(self) -> Tuple[str, ...]:
        """Return the keyboard labels in electrical-contact order."""
        return tuple(ALPHABET)

    def press(self, key: str) -> int:
        """Return the electrical contact closed by a keypress."""
        return to_index(key)

    def prepare_message(
        self,
        message: str,
        ignore_non_letters: bool = True,
    ) -> List[int]:
        if not isinstance(message, str):
            raise TypeError("message must be a string")

        signals: List[int] = []
        for character in message:
            normalized = character.upper()
            if len(normalized) == 1 and normalized in ALPHABET:
                signals.append(to_index(normalized))
            elif not ignore_non_letters:
                raise ValueError(
                    "message contains a non-alphabetic character: {!r}".format(
                        character
                    )
                )
        return signals
