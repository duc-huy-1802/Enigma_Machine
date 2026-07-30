"use strict";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const KEYBOARD_ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];

const ROTORS = {
  I: { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II: { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV: { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V: { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" },
};

const REFLECTORS = {
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

const DEFAULTS = {
  rotorOrder: ["I", "II", "III"],
  rings: [0, 0, 0],
  positions: [0, 0, 0],
  reflector: "B",
  turnover: true,
};

const machine = {
  rotorOrder: [...DEFAULTS.rotorOrder],
  rings: [...DEFAULTS.rings],
  positions: [...DEFAULTS.positions],
  initialPositions: [...DEFAULTS.positions],
  reflector: DEFAULTS.reflector,
  turnover: DEFAULTS.turnover,
  history: "",
  lastTrace: null,
};

const elements = {};
let lampTimer = null;

function toIndex(letter) {
  return ALPHABET.indexOf(letter);
}

function toLetter(index) {
  return ALPHABET[(index + 26) % 26];
}

function rotorTransform(rotorName, signal, position, ring, reverse = false) {
  const wiring = ROTORS[rotorName].wiring;
  const internalInput = (signal + position - ring + 26) % 26;
  const internalOutput = reverse
    ? wiring.indexOf(toLetter(internalInput))
    : toIndex(wiring[internalInput]);
  const externalOutput = (internalOutput - position + ring + 26) % 26;

  return {
    rotorName,
    direction: reverse ? "reverse" : "forward",
    position: toLetter(position),
    ring: toLetter(ring),
    externalInput: toLetter(signal),
    internalInput: toLetter(internalInput),
    internalOutput: toLetter(internalOutput),
    externalOutput: toLetter(externalOutput),
    output: externalOutput,
  };
}

function stepRotors() {
  const before = machine.positions.map(toLetter).join("");
  const rightName = machine.rotorOrder[2];
  const middleName = machine.rotorOrder[1];
  const rightAtNotch = toLetter(machine.positions[2]) === ROTORS[rightName].notch;
  const middleAtNotch = toLetter(machine.positions[1]) === ROTORS[middleName].notch;
  let leftStepped = false;
  let middleStepped = false;

  if (machine.turnover) {
    if (middleAtNotch) {
      machine.positions[0] = (machine.positions[0] + 1) % 26;
      leftStepped = true;
    }
    if (rightAtNotch || middleAtNotch) {
      machine.positions[1] = (machine.positions[1] + 1) % 26;
      middleStepped = true;
    }
  }
  machine.positions[2] = (machine.positions[2] + 1) % 26;

  return {
    before,
    after: machine.positions.map(toLetter).join(""),
    rightAtNotch,
    middleAtNotch,
    leftStepped,
    middleStepped,
    rightStepped: true,
  };
}

function pressKey(letter, animate = true) {
  const normalized = letter.toUpperCase();
  if (!ALPHABET.includes(normalized)) return "";

  const step = stepRotors();
  let signal = toIndex(normalized);
  const forward = [];
  const reverse = [];

  for (const rotorIndex of [2, 1, 0]) {
    const trace = rotorTransform(
      machine.rotorOrder[rotorIndex],
      signal,
      machine.positions[rotorIndex],
      machine.rings[rotorIndex],
    );
    forward.push(trace);
    signal = trace.output;
  }

  const reflectorInput = toLetter(signal);
  signal = toIndex(REFLECTORS[machine.reflector][signal]);
  const reflectorOutput = toLetter(signal);

  for (const rotorIndex of [0, 1, 2]) {
    const trace = rotorTransform(
      machine.rotorOrder[rotorIndex],
      signal,
      machine.positions[rotorIndex],
      machine.rings[rotorIndex],
      true,
    );
    reverse.push(trace);
    signal = trace.output;
  }

  const output = toLetter(signal);
  machine.history += output;
  machine.lastTrace = {
    input: normalized,
    output,
    step,
    forward,
    reflectorInput,
    reflectorOutput,
    reverse,
  };

  renderMachine();
  renderTrace();
  if (animate) illuminate(normalized, output);
  return output;
}

function populateSelect(select, values, selected) {
  select.innerHTML = values
    .map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`)
    .join("");
}

function createRotorWindows() {
  elements.rotorWindows.innerHTML = machine.rotorOrder
    .map(
      (name, index) => `
        <div class="rotor-unit">
          <div class="rotor-unit-header">
            <span>${["Left", "Middle", "Right"][index]}</span>
            <span>Rotor ${name}</span>
          </div>
          <div class="window-control">
            <button type="button" data-position-delta="-1" data-rotor-index="${index}" aria-label="Move ${["left", "middle", "right"][index]} rotor backward">−</button>
            <div class="window-letter" id="position-${index}">${toLetter(machine.positions[index])}</div>
            <button type="button" data-position-delta="1" data-rotor-index="${index}" aria-label="Move ${["left", "middle", "right"][index]} rotor forward">+</button>
          </div>
          <select class="ring-select" data-ring-index="${index}" aria-label="${["Left", "Middle", "Right"][index]} ring setting">
            ${[...ALPHABET].map((letter, setting) => `<option value="${setting}"${machine.rings[index] === setting ? " selected" : ""}>Ring ${letter}</option>`).join("")}
          </select>
        </div>
      `,
    )
    .join("");
}

function createLetterBoard(container, isKeyboard) {
  container.innerHTML = KEYBOARD_ROWS.map(
    (row) => `
      <div class="letter-row">
        ${[...row]
          .map((letter) =>
            isKeyboard
              ? `<button class="letter" type="button" data-key="${letter}" aria-label="Press ${letter}">${letter}</button>`
              : `<span class="letter" data-lamp="${letter}" aria-label="${letter} lamp">${letter}</span>`,
          )
          .join("")}
      </div>
    `,
  ).join("");
}

function updateRotorSelects() {
  const selects = [elements.leftRotor, elements.middleRotor, elements.rightRotor];
  selects.forEach((select, index) => {
    select.value = machine.rotorOrder[index];
    [...select.options].forEach((option) => {
      option.disabled =
        option.value !== machine.rotorOrder[index] && machine.rotorOrder.includes(option.value);
    });
  });
}

function renderMachine() {
  machine.positions.forEach((position, index) => {
    const window = document.getElementById(`position-${index}`);
    if (window) window.textContent = toLetter(position);
  });
  elements.cipherText.value = machine.history;
  elements.turnoverToggle.checked = machine.turnover;
  document.querySelectorAll("[data-reflector]").forEach((button) => {
    button.classList.toggle("active", button.dataset.reflector === machine.reflector);
  });
}

function renderTrace() {
  const trace = machine.lastTrace;
  if (!trace) {
    elements.traceSummary.textContent = "Press a key to follow the current.";
    elements.traceCard.innerHTML = `
      <div class="empty-trace">
        <span class="empty-trace-icon">↯</span>
        <p>The electrical journey will appear here.</p>
      </div>
    `;
    return;
  }

  elements.traceSummary.textContent =
    `${trace.input} became ${trace.output} as the rotors moved ${trace.step.before} → ${trace.step.after}.`;

  const nodes = [
    { letter: trace.input, label: "Key", detail: "Input", className: "endpoint" },
    ...trace.forward.map((item) => ({
      letter: item.externalOutput,
      label: `Rotor ${item.rotorName}`,
      detail: `→ ${item.internalInput}:${item.internalOutput}`,
      className: "",
    })),
    {
      letter: trace.reflectorOutput,
      label: `UKW ${machine.reflector}`,
      detail: `${trace.reflectorInput} ↔ ${trace.reflectorOutput}`,
      className: "reflector",
    },
    ...trace.reverse.map((item) => ({
      letter: item.externalOutput,
      label: `Rotor ${item.rotorName}`,
      detail: `← ${item.internalInput}:${item.internalOutput}`,
      className: "",
    })),
    { letter: trace.output, label: "Lamp", detail: "Output", className: "endpoint" },
  ];

  const badges = [
    { label: "Right stepped", active: trace.step.rightStepped },
    { label: "Middle stepped", active: trace.step.middleStepped },
    { label: "Left stepped", active: trace.step.leftStepped },
    { label: "Right at notch", active: trace.step.rightAtNotch },
    { label: "Middle at notch", active: trace.step.middleAtNotch },
  ];

  elements.traceCard.innerHTML = `
    <div class="trace-step">
      <strong>${trace.step.before} → ${trace.step.after}</strong>
      <div class="step-badges">
        ${badges
          .map((badge) => `<span class="step-badge${badge.active ? " active" : ""}">${badge.label}</span>`)
          .join("")}
      </div>
    </div>
    <div class="signal-path">
      ${nodes
        .map(
          (node) => `
            <div class="signal-node ${node.className}">
              <span class="signal-letter">${node.letter}</span>
              <strong>${node.label}</strong>
              <small>${node.detail}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function illuminate(input, output) {
  window.clearTimeout(lampTimer);
  document.querySelectorAll(".letter.lit, .letter.pressed").forEach((item) => {
    item.classList.remove("lit", "pressed");
  });
  document.querySelector(`[data-key="${input}"]`)?.classList.add("pressed");
  document.querySelector(`[data-lamp="${output}"]`)?.classList.add("lit");
  lampTimer = window.setTimeout(() => {
    document.querySelectorAll(".letter.lit, .letter.pressed").forEach((item) => {
      item.classList.remove("lit", "pressed");
    });
  }, 450);
}

function resetPositions(clearHistory = true) {
  machine.positions = [...machine.initialPositions];
  if (clearHistory) {
    machine.history = "";
    machine.lastTrace = null;
  }
  renderMachine();
  renderTrace();
}

function rebuildFromConfiguration({ keepPositions = false } = {}) {
  if (!keepPositions) {
    machine.initialPositions = [...machine.positions];
  }
  machine.history = "";
  machine.lastTrace = null;
  createRotorWindows();
  updateRotorSelects();
  renderMachine();
  renderTrace();
}

function restoreDefaults() {
  Object.assign(machine, {
    rotorOrder: [...DEFAULTS.rotorOrder],
    rings: [...DEFAULTS.rings],
    positions: [...DEFAULTS.positions],
    initialPositions: [...DEFAULTS.positions],
    reflector: DEFAULTS.reflector,
    turnover: DEFAULTS.turnover,
    history: "",
    lastTrace: null,
  });
  createRotorWindows();
  updateRotorSelects();
  renderMachine();
  renderTrace();
}

function cleanLetters(value) {
  return value.toUpperCase().replace(/[^A-Z]/g, "");
}

function bindEvents() {
  [elements.leftRotor, elements.middleRotor, elements.rightRotor].forEach((select, index) => {
    select.addEventListener("change", () => {
      machine.rotorOrder[index] = select.value;
      rebuildFromConfiguration({ keepPositions: true });
    });
  });

  document.querySelectorAll("[data-reflector]").forEach((button) => {
    button.addEventListener("click", () => {
      machine.reflector = button.dataset.reflector;
      rebuildFromConfiguration({ keepPositions: true });
    });
  });

  elements.turnoverToggle.addEventListener("change", () => {
    machine.turnover = elements.turnoverToggle.checked;
    rebuildFromConfiguration({ keepPositions: true });
  });

  elements.rotorWindows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-position-delta]");
    if (!button) return;
    const index = Number(button.dataset.rotorIndex);
    const delta = Number(button.dataset.positionDelta);
    machine.positions[index] = (machine.positions[index] + delta + 26) % 26;
    machine.initialPositions = [...machine.positions];
    machine.history = "";
    machine.lastTrace = null;
    renderMachine();
    renderTrace();
  });

  elements.rotorWindows.addEventListener("change", (event) => {
    const select = event.target.closest("[data-ring-index]");
    if (!select) return;
    machine.rings[Number(select.dataset.ringIndex)] = Number(select.value);
    rebuildFromConfiguration({ keepPositions: true });
  });

  elements.keyboard.addEventListener("click", (event) => {
    const key = event.target.closest("[data-key]");
    if (key) pressKey(key.dataset.key);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      ["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName)
    ) {
      return;
    }
    const letter = event.key.toUpperCase();
    if (ALPHABET.includes(letter)) {
      event.preventDefault();
      pressKey(letter);
    }
  });

  elements.plainText.addEventListener("input", () => {
    const count = cleanLetters(elements.plainText.value).length;
    elements.inputCount.textContent = `${count} letter${count === 1 ? "" : "s"}`;
  });

  elements.encryptMessage.addEventListener("click", () => {
    const message = cleanLetters(elements.plainText.value);
    if (!message) {
      elements.plainText.focus();
      return;
    }
    resetPositions(true);
    let result = "";
    for (const letter of message) result += pressKey(letter, false);
    machine.history = result;
    elements.cipherText.value = result;
    if (machine.lastTrace) illuminate(machine.lastTrace.input, machine.lastTrace.output);
  });

  elements.copyOutput.addEventListener("click", async () => {
    if (!elements.cipherText.value) return;
    try {
      await navigator.clipboard.writeText(elements.cipherText.value);
      elements.copyOutput.textContent = "Copied";
      window.setTimeout(() => {
        elements.copyOutput.textContent = "Copy";
      }, 1200);
    } catch {
      elements.cipherText.select();
      document.execCommand("copy");
    }
  });

  elements.restoreDefaults.addEventListener("click", restoreDefaults);
  elements.resetMachine.addEventListener("click", () => resetPositions(false));
  elements.clearMachine.addEventListener("click", () => {
    machine.history = "";
    machine.lastTrace = null;
    elements.plainText.value = "";
    elements.inputCount.textContent = "0 letters";
    resetPositions(true);
  });

  elements.aboutButton.addEventListener("click", () => elements.aboutDialog.showModal());
  elements.closeAbout.addEventListener("click", () => elements.aboutDialog.close());
  elements.aboutDialog.addEventListener("click", (event) => {
    if (event.target === elements.aboutDialog) elements.aboutDialog.close();
  });
}

function init() {
  [
    "leftRotor",
    "middleRotor",
    "rightRotor",
    "rotorWindows",
    "turnoverToggle",
    "lampboard",
    "keyboard",
    "plainText",
    "cipherText",
    "inputCount",
    "encryptMessage",
    "copyOutput",
    "restoreDefaults",
    "resetMachine",
    "clearMachine",
    "traceSummary",
    "traceCard",
    "aboutButton",
    "aboutDialog",
    "closeAbout",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  const rotorNames = Object.keys(ROTORS);
  populateSelect(elements.leftRotor, rotorNames, machine.rotorOrder[0]);
  populateSelect(elements.middleRotor, rotorNames, machine.rotorOrder[1]);
  populateSelect(elements.rightRotor, rotorNames, machine.rotorOrder[2]);
  createRotorWindows();
  createLetterBoard(elements.lampboard, false);
  createLetterBoard(elements.keyboard, true);
  updateRotorSelects();
  bindEvents();
  renderMachine();
}

document.addEventListener("DOMContentLoaded", init);
