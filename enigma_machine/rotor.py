"""Rotating wired wheels used by an Enigma machine."""

from dataclasses import dataclass
from typing import Tuple

from .alphabet import (
    ALPHABET_SIZE,
    to_index,
    to_letter,
    validate_signal,
    validate_permutation,
)
from .ring import Ring


@dataclass(frozen=True)
class RotorTrace:
    """The coordinate changes made by one pass through a rotor."""

    rotor_name: str
    direction: str
    position: str
    ring_setting: str
    external_input: str
    internal_input: str
    internal_output: str
    external_output: str


class Rotor:
    """A fixed wiring core, turnover notch, ring, and current position."""

    def __init__(
        self,
        name: str,
        wiring: str,
        notch_letters: str,
        ring: Ring,
        position: int = 0,
    ) -> None:
        if not isinstance(name, str) or not name:
            raise ValueError("rotor name must be a non-empty string")
        if not isinstance(wiring, str):
            raise TypeError("rotor wiring must be a string")
        wiring = wiring.upper()
        if len(wiring) != ALPHABET_SIZE:
            raise ValueError("rotor wiring must contain exactly 26 letters")

        forward = validate_permutation(
            (to_index(letter) for letter in wiring),
            "{} wiring".format(name),
        )
        inverse = [0] * ALPHABET_SIZE
        for source, target in enumerate(forward):
            inverse[target] = source

        if not isinstance(notch_letters, str) or not notch_letters:
            raise ValueError("a stepping rotor needs at least one notch")
        notches = tuple(to_index(letter) for letter in notch_letters.upper())
        if len(set(notches)) != len(notches):
            raise ValueError("rotor notch letters must be distinct")

        if not isinstance(ring, Ring):
            raise TypeError("ring must be a Ring object")
        validate_signal(position, "rotor position")

        self.name = name
        self._forward: Tuple[int, ...] = forward
        self._inverse: Tuple[int, ...] = tuple(inverse)
        self._notches: Tuple[int, ...] = notches
        self.ring = ring
        self._position = position

    @property
    def wiring(self) -> str:
        return "".join(to_letter(value) for value in self._forward)

    @property
    def notch_letters(self) -> str:
        return "".join(to_letter(value) for value in self._notches)

    @property
    def position(self) -> int:
        return self._position

    @property
    def position_letter(self) -> str:
        return to_letter(self._position)

    def set_position(self, position: int) -> None:
        self._position = validate_signal(position, "rotor position")

    def at_notch(self) -> bool:
        """Whether the current window letter is a turnover letter."""
        return self._position in self._notches

    def step(self) -> None:
        self._position = (self._position + 1) % ALPHABET_SIZE

    def encode_forward(self, signal: int) -> int:
        validate_signal(signal)
        internal = self.ring.to_internal(signal, self._position)
        wired = self._forward[internal]
        return self.ring.to_external(wired, self._position)

    def encode_reverse(self, signal: int) -> int:
        validate_signal(signal)
        internal = self.ring.to_internal(signal, self._position)
        wired = self._inverse[internal]
        return self.ring.to_external(wired, self._position)

    def trace_forward(self, signal: int) -> RotorTrace:
        return self._trace(signal, self._forward, "forward")

    def trace_reverse(self, signal: int) -> RotorTrace:
        return self._trace(signal, self._inverse, "reverse")

    def _trace(
        self,
        signal: int,
        wiring: Tuple[int, ...],
        direction: str,
    ) -> RotorTrace:
        validate_signal(signal)
        internal_input = self.ring.to_internal(signal, self._position)
        internal_output = wiring[internal_input]
        external_output = self.ring.to_external(
            internal_output,
            self._position,
        )
        return RotorTrace(
            rotor_name=self.name,
            direction=direction,
            position=self.position_letter,
            ring_setting=self.ring.letter,
            external_input=to_letter(signal),
            internal_input=to_letter(internal_input),
            internal_output=to_letter(internal_output),
            external_output=to_letter(external_output),
        )
