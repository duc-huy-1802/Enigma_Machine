"""Shared alphabet conversion and validation helpers."""

from typing import Iterable, Tuple

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
ALPHABET_SIZE = len(ALPHABET)


def validate_signal(signal: int, name: str = "signal") -> int:
    """Return a validated electrical contact number in ``0..25``.

    Component boundaries are deliberately strict.  Modular reduction belongs
    inside coordinate-shift operations; accepting ``-1`` or ``26`` as a
    component input would otherwise hide wiring mistakes.
    """
    if isinstance(signal, bool) or not isinstance(signal, int):
        raise TypeError("{} must be an integer".format(name))
    if not 0 <= signal < ALPHABET_SIZE:
        raise ValueError("{} must be between 0 and 25".format(name))
    return signal


def to_index(letter: str) -> int:
    """Convert one ASCII letter to its value in ``0..25``."""
    if not isinstance(letter, str) or len(letter) != 1:
        raise ValueError("expected exactly one letter")

    normalized = letter.upper()
    if normalized not in ALPHABET:
        raise ValueError("expected a letter from A to Z")
    return ord(normalized) - ord("A")


def to_letter(index: int) -> str:
    """Convert an integer to a letter, reducing it modulo 26."""
    if isinstance(index, bool) or not isinstance(index, int):
        raise TypeError("letter index must be an integer")
    return ALPHABET[index % ALPHABET_SIZE]


def parse_settings(settings: str, expected_length: int = 3) -> Tuple[int, ...]:
    """Parse a compact setting such as ``AAA`` into numeric positions."""
    if not isinstance(settings, str) or len(settings) != expected_length:
        raise ValueError(
            "expected exactly {} setting letters".format(expected_length)
        )
    return tuple(to_index(letter) for letter in settings)


def validate_permutation(values: Iterable[int], name: str) -> Tuple[int, ...]:
    """Return a validated permutation of the alphabet."""
    permutation = tuple(values)
    expected = set(range(ALPHABET_SIZE))
    if len(permutation) != ALPHABET_SIZE or set(permutation) != expected:
        raise ValueError("{} must be a permutation of A-Z".format(name))
    return permutation
