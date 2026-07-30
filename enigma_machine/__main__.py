"""Small command-line entry point for backend experiments."""

import argparse

from .machine import EnigmaMachine


def main() -> None:
    parser = argparse.ArgumentParser(description="Enigma I backend simulator")
    parser.add_argument("message", help="message to encrypt")
    parser.add_argument(
        "--positions",
        default="AAA",
        help="initial left-to-right rotor positions (default: AAA)",
    )
    parser.add_argument(
        "--rings",
        default="AAA",
        help="left-to-right ring settings (default: AAA)",
    )
    parser.add_argument(
        "--rotors",
        nargs=3,
        default=("I", "II", "III"),
        metavar=("LEFT", "MIDDLE", "RIGHT"),
        help="left-to-right rotor order",
    )
    parser.add_argument(
        "--no-turnover",
        action="store_true",
        help="experimental mode: advance only the right rotor",
    )
    parser.add_argument(
        "--trace",
        action="store_true",
        help="print the component path for each keypress",
    )
    args = parser.parse_args()

    machine = EnigmaMachine.enigma_i(
        rotor_order=args.rotors,
        ring_settings=args.rings,
        positions=args.positions,
        turnover_enabled=not args.no_turnover,
    )

    if not args.trace:
        print(machine.encrypt_message(args.message))
        return

    for item in machine.trace_message(args.message):
        print(
            "{}: {} -> {} ({} -> {})".format(
                item.input_letter,
                item.step.positions_before,
                item.step.positions_after,
                item.input_letter,
                item.output_letter,
            )
        )
        for rotor in item.forward_path:
            print(
                "  {} {}: {} -> {} -> {} -> {}".format(
                    rotor.rotor_name,
                    rotor.direction,
                    rotor.external_input,
                    rotor.internal_input,
                    rotor.internal_output,
                    rotor.external_output,
                )
            )
        print(
            "  Reflector {}: {} -> {}".format(
                machine.reflector.name,
                item.reflector_input,
                item.reflector_output,
            )
        )
        for rotor in item.reverse_path:
            print(
                "  {} {}: {} -> {} -> {} -> {}".format(
                    rotor.rotor_name,
                    rotor.direction,
                    rotor.external_input,
                    rotor.internal_input,
                    rotor.internal_output,
                    rotor.external_output,
                )
            )


if __name__ == "__main__":
    main()
