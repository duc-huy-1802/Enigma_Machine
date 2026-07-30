"""Coordination and stepping logic for a three-rotor Enigma I."""

from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

from .alphabet import parse_settings, to_index, to_letter
from .keyboard import Keyboard
from .lampboard import Lampboard
from .reflector import Reflector
from .rotor import Rotor, RotorTrace


@dataclass(frozen=True)
class StepEvent:
    """A record of the pre-keypress stepping operation."""

    positions_before: str
    positions_after: str
    right_at_notch: bool
    middle_at_notch: bool
    left_stepped: bool
    middle_stepped: bool
    right_stepped: bool


@dataclass(frozen=True)
class KeypressTrace:
    """A complete backend trace for one keypress."""

    input_letter: str
    output_letter: str
    step: StepEvent
    forward_path: Tuple[RotorTrace, ...]
    reflector_input: str
    reflector_output: str
    reverse_path: Tuple[RotorTrace, ...]


@dataclass(frozen=True)
class MachineState:
    """A read-only snapshot suitable for a UI or research trace."""

    positions: str
    ring_settings: str
    lit_letter: Optional[str]
    lamp_history: str
    turnover_enabled: bool


class EnigmaMachine:
    """Three-rotor Enigma I without a plugboard.

    Rotors are supplied left-to-right, but electrical current enters the
    right rotor first.  Stepping happens before the signal is enciphered.
    """

    def __init__(
        self,
        rotors: Sequence[Rotor],
        reflector: Reflector,
        keyboard: Keyboard = None,
        lampboard: Lampboard = None,
        turnover_enabled: bool = True,
    ) -> None:
        if len(rotors) != 3:
            raise ValueError("Enigma I requires exactly three rotors")
        if not all(isinstance(rotor, Rotor) for rotor in rotors):
            raise TypeError("all rotor components must be Rotor objects")
        if not isinstance(reflector, Reflector):
            raise TypeError("reflector must be a Reflector object")
        if keyboard is not None and not isinstance(keyboard, Keyboard):
            raise TypeError("keyboard must be a Keyboard object")
        if lampboard is not None and not isinstance(lampboard, Lampboard):
            raise TypeError("lampboard must be a Lampboard object")
        if not isinstance(turnover_enabled, bool):
            raise TypeError("turnover_enabled must be a boolean")

        self.left, self.middle, self.right = rotors
        self.reflector = reflector
        self.keyboard = keyboard if keyboard is not None else Keyboard()
        self.lampboard = lampboard if lampboard is not None else Lampboard()
        self.turnover_enabled = turnover_enabled
        self._initial_positions = self.positions

    @classmethod
    def enigma_i(
        cls,
        rotor_order: Sequence[str] = ("I", "II", "III"),
        ring_settings: str = "AAA",
        positions: str = "AAA",
        reflector: str = "B",
        turnover_enabled: bool = True,
    ) -> "EnigmaMachine":
        """Construct a historical Enigma I configuration.

        ``rotor_order``, ``ring_settings``, and ``positions`` are all ordered
        from the operator's left to right.
        """
        from .catalog import create_reflector, create_rotor

        if isinstance(rotor_order, str) or len(rotor_order) != 3:
            raise ValueError("rotor_order must contain exactly three names")
        if not all(isinstance(name, str) for name in rotor_order):
            raise TypeError("rotor names must be strings")
        if len(set(name.upper() for name in rotor_order)) != 3:
            raise ValueError("the three installed rotors must be distinct")

        ring_values = parse_settings(ring_settings)
        position_values = parse_settings(positions)
        rotors = [
            create_rotor(
                name,
                position=to_letter(position),
                ring_setting=to_letter(ring),
            )
            for name, position, ring in zip(
                rotor_order,
                position_values,
                ring_values,
            )
        ]
        return cls(
            rotors=rotors,
            reflector=create_reflector(reflector),
            turnover_enabled=turnover_enabled,
        )

    @property
    def positions(self) -> str:
        return (
            self.left.position_letter
            + self.middle.position_letter
            + self.right.position_letter
        )

    @property
    def ring_settings(self) -> str:
        return (
            self.left.ring.letter
            + self.middle.ring.letter
            + self.right.ring.letter
        )

    @property
    def state(self) -> MachineState:
        """Return the current machine state without exposing mutable parts."""
        return MachineState(
            positions=self.positions,
            ring_settings=self.ring_settings,
            lit_letter=self.lampboard.lit_letter,
            lamp_history=self.lampboard.history,
            turnover_enabled=self.turnover_enabled,
        )

    def set_positions(self, positions: str) -> None:
        left, middle, right = parse_settings(positions)
        self.left.set_position(left)
        self.middle.set_position(middle)
        self.right.set_position(right)

    def reset(self, positions: Optional[str] = None) -> None:
        """Reset positions and clear the lampboard.

        With no argument, restore the positions used when this machine was
        constructed.  Supplying a setting establishes a one-off reset state.
        """
        self.set_positions(
            self._initial_positions if positions is None else positions
        )
        self.lampboard.clear()

    def release_key(self) -> None:
        """Model releasing a key, which turns off the lamp."""
        self.lampboard.release()

    def step_rotors(self) -> StepEvent:
        """Perform historical pre-keypress stepping.

        If turnover is disabled for comparison experiments, only the right
        rotor moves.
        """
        before = self.positions
        right_at_notch = self.right.at_notch()
        middle_at_notch = self.middle.at_notch()

        left_stepped = False
        middle_stepped = False

        if self.turnover_enabled:
            if middle_at_notch:
                self.left.step()
                left_stepped = True
            if right_at_notch or middle_at_notch:
                self.middle.step()
                middle_stepped = True

        self.right.step()

        return StepEvent(
            positions_before=before,
            positions_after=self.positions,
            right_at_notch=right_at_notch,
            middle_at_notch=middle_at_notch,
            left_stepped=left_stepped,
            middle_stepped=middle_stepped,
            right_stepped=True,
        )

    def encipher_at_current_state(self, letter: str) -> str:
        """Encipher one letter without stepping or touching the lampboard."""
        signal = self.keyboard.press(letter)
        return to_letter(self._transform_signal(signal))

    def press_key(self, key: str) -> str:
        """Step, encipher one key, and illuminate the output lamp."""
        signal = self.keyboard.press(key)
        self.step_rotors()
        return self.lampboard.illuminate(self._transform_signal(signal))

    def press_key_with_trace(self, key: str) -> KeypressTrace:
        signal = self.keyboard.press(key)
        step = self.step_rotors()
        output, forward, reflector_pair, reverse = self._trace_signal(signal)
        output_letter = self.lampboard.illuminate(output)
        return KeypressTrace(
            input_letter=to_letter(signal),
            output_letter=output_letter,
            step=step,
            forward_path=tuple(forward),
            reflector_input=to_letter(reflector_pair[0]),
            reflector_output=to_letter(reflector_pair[1]),
            reverse_path=tuple(reverse),
        )

    def encrypt_message(
        self,
        message: str,
        ignore_non_letters: bool = True,
    ) -> str:
        signals = self.keyboard.prepare_message(message, ignore_non_letters)
        return "".join(self.press_key(to_letter(signal)) for signal in signals)

    def trace_message(
        self,
        message: str,
        ignore_non_letters: bool = True,
    ) -> List[KeypressTrace]:
        signals = self.keyboard.prepare_message(message, ignore_non_letters)
        return [
            self.press_key_with_trace(to_letter(signal))
            for signal in signals
        ]

    def _transform_signal(self, signal: int) -> int:
        """Apply the electrical path without stepping or allocating traces."""
        for rotor in (self.right, self.middle, self.left):
            signal = rotor.encode_forward(signal)

        signal = self.reflector.reflect(signal)

        for rotor in (self.left, self.middle, self.right):
            signal = rotor.encode_reverse(signal)

        return signal

    def _trace_signal(
        self,
        signal: int,
    ) -> Tuple[int, List[RotorTrace], Tuple[int, int], List[RotorTrace]]:
        forward: List[RotorTrace] = []
        for rotor in (self.right, self.middle, self.left):
            trace = rotor.trace_forward(signal)
            forward.append(trace)
            signal = to_index(trace.external_output)

        reflector_input = signal
        signal = self.reflector.reflect(signal)
        reflector_pair = (reflector_input, signal)

        reverse: List[RotorTrace] = []
        for rotor in (self.left, self.middle, self.right):
            trace = rotor.trace_reverse(signal)
            reverse.append(trace)
            signal = to_index(trace.external_output)

        return signal, forward, reflector_pair, reverse
