import unittest

from enigma_machine.catalog import create_reflector, create_rotor
from enigma_machine.keyboard import Keyboard
from enigma_machine.lampboard import Lampboard
from enigma_machine.ring import Ring


class RingTests(unittest.TestCase):
    def test_position_and_ring_create_effective_offset(self):
        ring = Ring.from_letter("A")
        self.assertEqual(ring.effective_offset(1), 1)
        self.assertEqual(ring.to_internal(0, 1), 1)
        self.assertEqual(ring.to_external(3, 1), 2)

    def test_matching_position_and_ring_cancel(self):
        ring = Ring.from_letter("C")
        self.assertEqual(ring.effective_offset(2), 0)

    def test_ring_rejects_invalid_component_contacts(self):
        ring = Ring.from_letter("A")
        with self.assertRaises(ValueError):
            ring.to_internal(-1, 0)
        with self.assertRaises(ValueError):
            ring.to_external(26, 0)
        with self.assertRaises(TypeError):
            ring.effective_offset(True)


class RotorTests(unittest.TestCase):
    def test_rotor_three_at_b_maps_a_to_c(self):
        rotor = create_rotor("III", position="B", ring_setting="A")
        self.assertEqual(rotor.trace_forward(0).external_output, "C")

    def test_reverse_undoes_forward_at_same_state(self):
        rotor = create_rotor("III", position="D", ring_setting="B")
        for signal in range(26):
            self.assertEqual(
                rotor.encode_reverse(rotor.encode_forward(signal)),
                signal,
            )

    def test_notch_and_wiring_are_independent(self):
        rotor = create_rotor("I", position="Q")
        self.assertTrue(rotor.at_notch())
        self.assertEqual(rotor.wiring[16], "X")

    def test_forward_and_reverse_are_inverses_for_all_contacts(self):
        for position in "ACMVZ":
            for ring_setting in "ABFQZ":
                rotor = create_rotor(
                    "III",
                    position=position,
                    ring_setting=ring_setting,
                )
                for signal in range(26):
                    self.assertEqual(
                        rotor.encode_reverse(rotor.encode_forward(signal)),
                        signal,
                    )

    def test_rotor_rejects_invalid_component_contacts(self):
        rotor = create_rotor("III")
        with self.assertRaises(ValueError):
            rotor.encode_forward(26)
        with self.assertRaises(TypeError):
            rotor.encode_reverse("A")


class ReflectorTests(unittest.TestCase):
    def test_reflector_b_is_fixed_point_free_involution(self):
        reflector = create_reflector("B")
        for signal in range(26):
            reflected = reflector.reflect(signal)
            self.assertNotEqual(reflected, signal)
            self.assertEqual(reflector.reflect(reflected), signal)

    def test_reflector_b_exposes_thirteen_pairs(self):
        reflector = create_reflector("B")
        self.assertEqual(len(reflector.pairs), 13)
        self.assertIn(("A", "Y"), reflector.pairs)
        self.assertIn(("V", "W"), reflector.pairs)

    def test_reflector_rejects_invalid_component_contacts(self):
        reflector = create_reflector("B")
        with self.assertRaises(ValueError):
            reflector.reflect(-1)


class InputOutputTests(unittest.TestCase):
    def test_keyboard_and_lampboard(self):
        keyboard = Keyboard()
        lampboard = Lampboard()
        self.assertEqual(keyboard.press("a"), 0)
        self.assertEqual(lampboard.illuminate(1), "B")
        self.assertEqual(lampboard.lit_letter, "B")
        self.assertEqual(lampboard.history, "B")

    def test_releasing_key_turns_off_lamp_but_keeps_history(self):
        lampboard = Lampboard()
        lampboard.illuminate(8)
        lampboard.release()
        self.assertIsNone(lampboard.lit_letter)
        self.assertEqual(lampboard.history, "I")

    def test_keyboard_does_not_expand_non_ascii_characters(self):
        keyboard = Keyboard()
        self.assertEqual(
            keyboard.prepare_message("Straße"),
            [18, 19, 17, 0, 4],
        )

    def test_keyboard_strict_message_mode_reports_non_letters(self):
        keyboard = Keyboard()
        with self.assertRaises(ValueError):
            keyboard.prepare_message("A B", ignore_non_letters=False)

    def test_lampboard_rejects_invalid_component_contacts(self):
        lampboard = Lampboard()
        with self.assertRaises(ValueError):
            lampboard.illuminate(26)


if __name__ == "__main__":
    unittest.main()
