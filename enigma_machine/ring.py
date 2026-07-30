"""The adjustable alphabet ring fitted around an Enigma rotor core."""

from dataclasses import dataclass

from .alphabet import ALPHABET_SIZE, to_index, to_letter, validate_signal


@dataclass(frozen=True)
class Ring:
    """A rotor ring setting.

    The ring setting opposes the visible rotor position.  If ``p`` is the
    position and ``r`` is the ring setting, the effective offset is ``p-r``.
    """

    setting: int = 0

    def __post_init__(self) -> None:
        validate_signal(self.setting, "ring setting")

    @classmethod
    def from_letter(cls, letter: str) -> "Ring":
        return cls(to_index(letter))

    @property
    def letter(self) -> str:
        return to_letter(self.setting)

    def effective_offset(self, rotor_position: int) -> int:
        """Return ``p-r`` modulo 26."""
        validate_signal(rotor_position, "rotor position")
        return (rotor_position - self.setting) % ALPHABET_SIZE

    def to_internal(self, signal: int, rotor_position: int) -> int:
        """Translate a stationary external contact to rotor coordinates."""
        validate_signal(signal)
        return (signal + self.effective_offset(rotor_position)) % ALPHABET_SIZE

    def to_external(self, signal: int, rotor_position: int) -> int:
        """Translate a rotor contact back to stationary coordinates."""
        validate_signal(signal)
        return (signal - self.effective_offset(rotor_position)) % ALPHABET_SIZE
