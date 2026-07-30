import unittest

from enigma_machine import EnigmaMachine


class EnigmaMachineTests(unittest.TestCase):
    def test_standard_five_a_vector(self):
        machine = EnigmaMachine.enigma_i()
        self.assertEqual(machine.encrypt_message("AAAAA"), "BDZGO")
        self.assertEqual(machine.positions, "AAF")

    def test_standard_hello_world_vector(self):
        machine = EnigmaMachine.enigma_i()
        self.assertEqual(
            machine.encrypt_message("HELLOWORLD"),
            "ILBDAAMTAZ",
        )

    def test_same_initial_state_decrypts_message(self):
        sender = EnigmaMachine.enigma_i(positions="MCK", ring_settings="BDF")
        receiver = EnigmaMachine.enigma_i(positions="MCK", ring_settings="BDF")
        ciphertext = sender.encrypt_message("ENIGMAMACHINE")
        self.assertEqual(
            receiver.encrypt_message(ciphertext),
            "ENIGMAMACHINE",
        )

    def test_double_step_sequence(self):
        machine = EnigmaMachine.enigma_i(positions="ADU")
        events = [machine.step_rotors() for _ in range(4)]
        self.assertEqual(
            [event.positions_after for event in events],
            ["ADV", "AEW", "BFX", "BFY"],
        )
        self.assertTrue(events[1].middle_stepped)
        self.assertTrue(events[2].middle_stepped)
        self.assertTrue(events[2].left_stepped)

    def test_turnover_changes_hello_ciphertext(self):
        historical = EnigmaMachine.enigma_i(positions="ADU")
        simplified = EnigmaMachine.enigma_i(
            positions="ADU",
            turnover_enabled=False,
        )
        self.assertEqual(historical.encrypt_message("HELLO"), "IBXXX")
        self.assertEqual(simplified.encrypt_message("HELLO"), "IQIGK")

    def test_no_fixed_point_at_a_fixed_state(self):
        machine = EnigmaMachine.enigma_i(
            positions="QEV",
            ring_settings="BDF",
        )
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            self.assertNotEqual(
                machine.encipher_at_current_state(letter),
                letter,
            )

    def test_trace_exposes_every_component(self):
        machine = EnigmaMachine.enigma_i()
        trace = machine.press_key_with_trace("A")
        self.assertEqual(trace.step.positions_after, "AAB")
        self.assertEqual(
            [item.rotor_name for item in trace.forward_path],
            ["III", "II", "I"],
        )
        self.assertEqual(
            [item.rotor_name for item in trace.reverse_path],
            ["I", "II", "III"],
        )
        self.assertEqual(trace.output_letter, "B")

    def test_fast_and_traced_keypresses_have_identical_results(self):
        fast = EnigmaMachine.enigma_i(
            positions="QEV",
            ring_settings="BDF",
        )
        traced = EnigmaMachine.enigma_i(
            positions="QEV",
            ring_settings="BDF",
        )
        message = "BACKENDLOGIC"
        self.assertEqual(
            "".join(fast.press_key(letter) for letter in message),
            "".join(
                traced.press_key_with_trace(letter).output_letter
                for letter in message
            ),
        )
        self.assertEqual(fast.positions, traced.positions)

    def test_reset_without_argument_restores_initial_positions(self):
        machine = EnigmaMachine.enigma_i(positions="MCK")
        ciphertext = machine.encrypt_message("ENIGMA")
        self.assertNotEqual(machine.positions, "MCK")
        self.assertEqual(machine.lampboard.history, ciphertext)

        machine.reset()

        self.assertEqual(machine.positions, "MCK")
        self.assertEqual(machine.lampboard.history, "")
        self.assertIsNone(machine.lampboard.lit_letter)

    def test_machine_state_is_read_only_snapshot(self):
        machine = EnigmaMachine.enigma_i(positions="ADU")
        machine.press_key("H")
        state = machine.state
        self.assertEqual(state.positions, "ADV")
        self.assertEqual(state.ring_settings, "AAA")
        self.assertEqual(state.lit_letter, "I")
        self.assertEqual(state.lamp_history, "I")
        self.assertTrue(state.turnover_enabled)

        machine.release_key()
        self.assertIsNone(machine.lampboard.lit_letter)
        self.assertEqual(machine.lampboard.history, "I")


if __name__ == "__main__":
    unittest.main()
