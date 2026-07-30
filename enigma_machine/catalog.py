"""Historical Enigma I component specifications and constructors."""

from typing import Dict, Tuple

from .alphabet import to_index
from .reflector import Reflector
from .ring import Ring
from .rotor import Rotor

ROTOR_SPECS: Dict[str, Tuple[str, str]] = {
    "I": ("EKMFLGDQVZNTOWYHXUSPAIBRCJ", "Q"),
    "II": ("AJDKSIRUXBLHWTMCQGZNPYFVOE", "E"),
    "III": ("BDFHJLCPRTXVZNYEIWGAKMUSQO", "V"),
    "IV": ("ESOVPZJAYQUIRHXLNFTGKDCMWB", "J"),
    "V": ("VZBRGITYUPSDNHLXAWMJQOFECK", "Z"),
}

REFLECTOR_SPECS: Dict[str, str] = {
    "B": "YRUHQSLDPXNGOKMIEBFZCWVJAT",
    "C": "FVPJIAOYEDRZXWGCTKUQSBNMHL",
}


def create_rotor(
    name: str,
    position: str = "A",
    ring_setting: str = "A",
) -> Rotor:
    if not isinstance(name, str):
        raise TypeError("rotor name must be a string")
    normalized = name.upper()
    if normalized not in ROTOR_SPECS:
        raise ValueError("unknown Enigma I rotor: {}".format(name))
    wiring, notches = ROTOR_SPECS[normalized]
    return Rotor(
        name=normalized,
        wiring=wiring,
        notch_letters=notches,
        ring=Ring.from_letter(ring_setting),
        position=to_index(position),
    )


def create_reflector(name: str = "B") -> Reflector:
    if not isinstance(name, str):
        raise TypeError("reflector name must be a string")
    normalized = name.upper()
    if normalized not in REFLECTOR_SPECS:
        raise ValueError("unknown Enigma I reflector: {}".format(name))
    return Reflector(normalized, REFLECTOR_SPECS[normalized])
