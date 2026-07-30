"""Lampboard output component."""

from typing import List, Optional, Tuple

from .alphabet import ALPHABET, to_letter, validate_signal


class Lampboard:
    """Convert output contacts into illuminated letters."""

    def __init__(self) -> None:
        self._lit_letter: Optional[str] = None
        self._history: List[str] = []

    @property
    def lit_letter(self) -> Optional[str]:
        return self._lit_letter

    @property
    def lamps(self) -> Tuple[str, ...]:
        """Return all lamp labels in electrical-contact order."""
        return tuple(ALPHABET)

    @property
    def history(self) -> str:
        return "".join(self._history)

    def illuminate(self, signal: int) -> str:
        """Illuminate exactly one lamp and append it to output history."""
        validate_signal(signal)
        letter = to_letter(signal)
        self._lit_letter = letter
        self._history.append(letter)
        return letter

    def release(self) -> None:
        """Turn off the currently lit lamp without discarding output history."""
        self._lit_letter = None

    def clear(self) -> None:
        """Turn off the lamp and clear all recorded output."""
        self._lit_letter = None
        self._history.clear()
