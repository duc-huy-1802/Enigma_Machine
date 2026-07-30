# Enigma Machine backend

This repository implements the backend logic of a three-rotor Enigma I
without a plugboard. Each physical part is represented by a separate Python
object:

- `Keyboard` converts typed letters to electrical contact numbers.
- `Ring` owns a rotor's ring setting and coordinate shifts.
- `Rotor` owns fixed wiring, position, notch, and forward/reverse traversal.
- `Reflector` validates and applies a fixed-point-free involution.
- `Lampboard` records the illuminated output letters.
- `EnigmaMachine` coordinates stepping, double-stepping, and the signal path.

The included Enigma I catalog contains Rotors I-V and Reflectors B and C.

## Run

No third-party runtime dependencies are required.

```bash
python3 -m enigma_machine HELLOWORLD
```

Expected output:

```text
ILBDAAMTAZ
```

Choose a starting position and show every internal coordinate change:

```bash
python3 -m enigma_machine HELLO --positions ADU --trace
```

For the research comparison in which only the right rotor advances:

```bash
python3 -m enigma_machine HELLO --positions ADU --no-turnover
```

## Python API

```python
from enigma_machine import EnigmaMachine

machine = EnigmaMachine.enigma_i(
    rotor_order=("I", "II", "III"),
    ring_settings="AAA",
    positions="AAA",
    reflector="B",
)

ciphertext = machine.encrypt_message("HELLO")
assert ciphertext == "ILBDA"
```

The machine steps before each keypress. Rotor order and compact settings are
always supplied from left to right, although the forward electrical path is
right rotor, middle rotor, left rotor.

Each public component accepts electrical contacts as integers in `0..25` and
rejects invalid values instead of silently wrapping them. Rotor coordinate
shifts are still modular:

```text
effective offset = position - ring setting
signal path = shift into rotor -> fixed wiring -> shift back out
```

For a UI, the current backend state can be read without exposing mutable
internals:

```python
machine.press_key("A")
assert machine.state.positions == "AAB"
assert machine.state.lit_letter == "B"

machine.release_key()  # lamp turns off; output history remains
machine.reset()        # restore the construction-time positions
```

## Verify

```bash
python3 -m unittest discover -s tests -v
```

Tests cover component validation, forward/reverse rotor traversal, the
standard vectors `AAAAA -> BDZGO` and `HELLOWORLD -> ILBDAAMTAZ`, historical
double-stepping, the fixed-point property, and the optional no-turnover
comparison.
