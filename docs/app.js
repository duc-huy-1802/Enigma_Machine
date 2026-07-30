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

const CUSTOM_ROTOR_IDS = ["CUSTOM_LEFT", "CUSTOM_MIDDLE", "CUSTOM_RIGHT"];
const POSITION_NAMES = ["Left", "Middle", "Right"];

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
  customRotors: [
    { wiring: ALPHABET, notch: "Q", valid: true, error: "" },
    { wiring: ALPHABET, notch: "E", valid: true, error: "" },
    { wiring: ALPHABET, notch: "V", valid: true, error: "" },
  ],
  customReflector: {
    pairs: pairsFromWiring(REFLECTORS.B),
    wiring: REFLECTORS.B,
    valid: true,
    error: "",
    invalidIndexes: [],
  },
};

const machine = {
  rotorOrder: [...DEFAULTS.rotorOrder],
  rings: [...DEFAULTS.rings],
  positions: [...DEFAULTS.positions],
  initialPositions: [...DEFAULTS.positions],
  reflector: DEFAULTS.reflector,
  turnover: DEFAULTS.turnover,
  customRotors: DEFAULTS.customRotors.map((rotor) => ({ ...rotor })),
  customReflector: {
    ...DEFAULTS.customReflector,
    pairs: [...DEFAULTS.customReflector.pairs],
    invalidIndexes: [],
  },
  history: "",
  lastTrace: null,
};

const elements = {};
let lampTimer = null;
let operationMode = "encrypt";

function toIndex(letter) {
  return ALPHABET.indexOf(letter);
}

function toLetter(index) {
  return ALPHABET[(index + 26) % 26];
}

function pairsFromWiring(wiring) {
  return [...ALPHABET]
    .map((letter, index) => [letter, wiring[index]])
    .filter(([source, target]) => source < target)
    .map((pair) => pair.join(""));
}

function wiringFromPairs(pairs) {
  const wiring = Array(26).fill("");
  pairs.forEach((pair) => {
    const [first, second] = pair;
    wiring[toIndex(first)] = second;
    wiring[toIndex(second)] = first;
  });
  return wiring.join("");
}

function getReflectorWiring() {
  return machine.reflector === "CUSTOM"
    ? machine.customReflector.wiring
    : REFLECTORS[machine.reflector];
}

function reflectorDisplayName() {
  if (machine.reflector === "CUSTOM") return "Custom";
  return machine.reflector === "B" ? "Option 1" : "Option 2";
}

function customRotorIndex(rotorName) {
  return CUSTOM_ROTOR_IDS.indexOf(rotorName);
}

function getRotorSpec(rotorName) {
  const customIndex = customRotorIndex(rotorName);
  return customIndex >= 0 ? machine.customRotors[customIndex] : ROTORS[rotorName];
}

function rotorDisplayName(rotorName) {
  const customIndex = customRotorIndex(rotorName);
  return customIndex >= 0 ? `Custom ${POSITION_NAMES[customIndex]}` : rotorName;
}

function activeCustomIndexes() {
  return machine.rotorOrder
    .map((name) => customRotorIndex(name))
    .filter((index) => index >= 0);
}

function machineIsValid() {
  const rotorsValid = activeCustomIndexes().every(
    (index) => machine.customRotors[index].valid,
  );
  const reflectorValid =
    machine.reflector !== "CUSTOM" || machine.customReflector.valid;
  return rotorsValid && reflectorValid;
}

function rotorTransform(rotorName, signal, position, ring, reverse = false) {
  const wiring = getRotorSpec(rotorName).wiring;
  const internalInput = (signal + position - ring + 26) % 26;
  const internalOutput = reverse
    ? wiring.indexOf(toLetter(internalInput))
    : toIndex(wiring[internalInput]);
  const externalOutput = (internalOutput - position + ring + 26) % 26;

  return {
    rotorName: rotorDisplayName(rotorName),
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
  const rightAtNotch = getRotorSpec(rightName).notch.includes(toLetter(machine.positions[2]));
  const middleAtNotch = getRotorSpec(middleName).notch.includes(toLetter(machine.positions[1]));
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
  if (!ALPHABET.includes(normalized) || !machineIsValid()) return "";

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
  signal = toIndex(getReflectorWiring()[signal]);
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

function populateRotorSelect(select, selected, customId, customLabel) {
  select.innerHTML = [
    ...Object.keys(ROTORS).map(
      (name) => `<option value="${name}">Rotor ${name}</option>`,
    ),
    `<option value="${customId}">${customLabel}</option>`,
  ].join("");
  select.value = selected;
}

function createRotorWindows() {
  elements.rotorWindows.innerHTML = machine.rotorOrder
    .map(
      (name, index) => `
        <div class="rotor-unit">
          <div class="rotor-unit-header">
            <span>${POSITION_NAMES[index]}</span>
            <span>${customRotorIndex(name) >= 0 ? rotorDisplayName(name) : `Rotor ${name}`}</span>
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

function validateCustomRotor(index, wiring, notch) {
  const cleanWiring = wiring.toUpperCase().replace(/[^A-Z]/g, "");
  const cleanNotch = notch.toUpperCase().replace(/[^A-Z]/g, "");
  let error = "";

  if (cleanWiring.length !== 26) {
    error = `Wiring needs 26 letters; currently ${cleanWiring.length}.`;
  } else if (new Set(cleanWiring).size !== 26) {
    error = "Each letter A–Z must appear exactly once.";
  } else if (!cleanNotch.length) {
    error = "Enter at least one turnover notch letter.";
  } else if (new Set(cleanNotch).size !== cleanNotch.length) {
    error = "Notch letters cannot repeat.";
  }

  machine.customRotors[index] = {
    wiring: cleanWiring,
    notch: cleanNotch,
    valid: !error,
    error,
  };
  return machine.customRotors[index];
}

function createCustomRotorEditor() {
  elements.customRotorEditor.innerHTML = machine.customRotors
    .map((rotor, index) => {
      const active = machine.rotorOrder.includes(CUSTOM_ROTOR_IDS[index]);
      return `
        <article class="wiring-card${active ? "" : " inactive"}" data-custom-card="${index}">
          <div class="wiring-card-header">
            <span>
              <strong>${POSITION_NAMES[index]} custom rotor</strong>
              <small>Independent wiring</small>
            </span>
            <span class="custom-badge">${active ? "Installed" : "Available"}</span>
          </div>
          <label class="wiring-field">
            <span>Wiring permutation</span>
            <input
              data-custom-wiring="${index}"
              value="${rotor.wiring}"
              maxlength="26"
              autocomplete="off"
              spellcheck="false"
              aria-label="${POSITION_NAMES[index]} custom rotor wiring"
              aria-invalid="${rotor.valid ? "false" : "true"}"
            />
          </label>
          <label class="wiring-field">
            <span>Turnover notch</span>
            <input
              data-custom-notch="${index}"
              value="${rotor.notch}"
              maxlength="26"
              autocomplete="off"
              spellcheck="false"
              aria-label="${POSITION_NAMES[index]} custom rotor turnover notch"
              aria-invalid="${rotor.valid ? "false" : "true"}"
            />
          </label>
          <p class="wiring-help${rotor.error ? " error" : ""}" data-custom-status="${index}">
            ${rotor.error || "Valid permutation · Ready to install"}
          </p>
        </article>
      `;
    })
    .join("");
  renderCustomValidity();
}

function renderCustomValidity() {
  const invalidActive = activeCustomIndexes().filter(
    (index) => !machine.customRotors[index].valid,
  );
  elements.wiringValidity.classList.toggle("invalid", invalidActive.length > 0);
  elements.wiringValidity.textContent = invalidActive.length
    ? `Fix ${invalidActive.length} installed custom rotor${invalidActive.length === 1 ? "" : "s"}`
    : "All installed rotors valid";
}

function validateCustomReflector(pairs) {
  const cleanPairs = pairs.map((pair) =>
    pair.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
  );
  const invalidIndexes = new Set();
  const letterOwners = new Map();
  let hasIncompletePair = false;
  let hasSelfPair = false;

  cleanPairs.forEach((pair, index) => {
    if (pair.length !== 2) {
      hasIncompletePair = true;
      invalidIndexes.add(index);
    }
    if (pair.length === 2 && pair[0] === pair[1]) {
      hasSelfPair = true;
      invalidIndexes.add(index);
    }
    [...pair].forEach((letter) => {
      const owners = letterOwners.get(letter) || [];
      owners.push(index);
      letterOwners.set(letter, owners);
    });
  });

  let hasDuplicates = false;
  letterOwners.forEach((owners) => {
    if (owners.length > 1) {
      hasDuplicates = true;
      owners.forEach((index) => invalidIndexes.add(index));
    }
  });

  let error = "";
  if (hasIncompletePair) {
    error = "Each reflector pair needs exactly two letters.";
  } else if (hasSelfPair) {
    error = "A reflector cannot connect a letter to itself.";
  } else if (hasDuplicates || letterOwners.size !== 26) {
    error = "Use every letter A–Z exactly once across the 13 pairs.";
  }

  const valid = !error;
  machine.customReflector = {
    pairs: cleanPairs,
    wiring: valid ? wiringFromPairs(cleanPairs) : "",
    valid,
    error,
    invalidIndexes: [...invalidIndexes],
  };
  return machine.customReflector;
}

function createReflectorEditor() {
  const isCustom = machine.reflector === "CUSTOM";
  const pairs = isCustom
    ? machine.customReflector.pairs
    : pairsFromWiring(REFLECTORS[machine.reflector]);

  elements.reflectorPairs.innerHTML = pairs
    .map(
      (pair, index) => `
        <label class="reflector-pair">
          <span>Pair ${String(index + 1).padStart(2, "0")}</span>
          <input
            data-reflector-pair="${index}"
            value="${pair}"
            maxlength="2"
            autocomplete="off"
            spellcheck="false"
            aria-label="${isCustom ? "Custom" : reflectorDisplayName()} reflector pair ${index + 1}"
            aria-invalid="${isCustom && machine.customReflector.invalidIndexes.includes(index)}"
            ${isCustom ? "" : "readonly"}
          />
        </label>
      `,
    )
    .join("");
  renderReflectorValidity();
}

function renderReflectorValidity() {
  const isCustom = machine.reflector === "CUSTOM";
  elements.reflectorLabEyebrow.textContent = isCustom
    ? "Custom component"
    : "Preset reflector";
  elements.reflectorLabTitle.textContent = isCustom
    ? "Custom reflector pairboard"
    : `${reflectorDisplayName()} reflector pairboard`;
  elements.reflectorLabCopy.textContent = isCustom
    ? "Connect the alphabet into 13 pairs. Each letter must appear exactly once, and a letter cannot connect to itself."
    : `${reflectorDisplayName()} connects the alphabet into 13 fixed reciprocal pairs. Select Custom to create your own.`;

  if (!isCustom) {
    elements.reflectorValidity.classList.remove("invalid");
    elements.reflectorValidity.textContent = `${reflectorDisplayName()} preset`;
    elements.reflectorError.textContent = "Preset wiring is displayed read-only.";
    elements.reflectorError.classList.remove("error");
    return;
  }

  const reflector = machine.customReflector;
  elements.reflectorValidity.classList.toggle("invalid", !reflector.valid);
  elements.reflectorValidity.textContent = reflector.valid
    ? "Valid reciprocal reflector"
    : "Custom reflector incomplete";
  elements.reflectorError.textContent =
    reflector.error || "All 26 contacts are paired.";
  elements.reflectorError.classList.toggle("error", !reflector.valid);
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
      option.disabled = Boolean(
        ROTORS[option.value] &&
        option.value !== machine.rotorOrder[index] &&
        machine.rotorOrder.includes(option.value),
      );
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
  const valid = machineIsValid();
  elements.encryptMessage.disabled = !valid;
  elements.keyboard.classList.toggle("disabled", !valid);
  document.querySelectorAll("[data-reflector]").forEach((button) => {
    button.classList.toggle("active", button.dataset.reflector === machine.reflector);
  });
}

function renderOperationMode() {
  const decrypting = operationMode === "decrypt";
  document.querySelectorAll("[data-operation-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.operationMode === operationMode);
  });
  elements.inputLabel.textContent = decrypting ? "Ciphertext" : "Plaintext";
  elements.outputLabel.textContent = decrypting ? "Plaintext" : "Ciphertext";
  elements.operationAction.textContent = decrypting
    ? "Decipher message"
    : "Encipher message";
  elements.modeExplanation.textContent = decrypting
    ? "Enter ciphertext with the original settings to recover the plaintext."
    : "Enter plaintext; the machine will produce ciphertext.";
  elements.plainText.placeholder = decrypting
    ? "TYPE OR PASTE CIPHERTEXT…"
    : "TYPE A MESSAGE…";
  elements.cipherText.placeholder = decrypting
    ? "PLAINTEXT APPEARS HERE…"
    : "CIPHERTEXT APPEARS HERE…";
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
      label: `Reflector ${reflectorDisplayName()}`,
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
  createCustomRotorEditor();
  createReflectorEditor();
  updateRotorSelects();
  renderMachine();
  renderTrace();
}

function restoreDefaults() {
  operationMode = "encrypt";
  Object.assign(machine, {
    rotorOrder: [...DEFAULTS.rotorOrder],
    rings: [...DEFAULTS.rings],
    positions: [...DEFAULTS.positions],
    initialPositions: [...DEFAULTS.positions],
    reflector: DEFAULTS.reflector,
    turnover: DEFAULTS.turnover,
    customRotors: DEFAULTS.customRotors.map((rotor) => ({ ...rotor })),
    customReflector: {
      ...DEFAULTS.customReflector,
      pairs: [...DEFAULTS.customReflector.pairs],
      invalidIndexes: [],
    },
    history: "",
    lastTrace: null,
  });
  createRotorWindows();
  createCustomRotorEditor();
  createReflectorEditor();
  updateRotorSelects();
  renderMachine();
  renderOperationMode();
  renderTrace();
}

function cleanLetters(value) {
  return value.toUpperCase().replace(/[^A-Z]/g, "");
}

function bindEvents() {
  [elements.leftRotor, elements.middleRotor, elements.rightRotor].forEach((select, index) => {
    select.addEventListener("change", () => {
      machine.rotorOrder[index] = select.value;
      if (customRotorIndex(select.value) >= 0) elements.wiringLab.open = true;
      rebuildFromConfiguration({ keepPositions: true });
    });
  });

  document.querySelectorAll("[data-reflector]").forEach((button) => {
    button.addEventListener("click", () => {
      machine.reflector = button.dataset.reflector;
      rebuildFromConfiguration({ keepPositions: true });
    });
  });

  document.querySelectorAll("[data-operation-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      operationMode = button.dataset.operationMode;
      machine.history = "";
      machine.lastTrace = null;
      resetPositions(true);
      renderOperationMode();
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
    if (key && machineIsValid()) pressKey(key.dataset.key);
  });

  elements.customRotorEditor.addEventListener("input", (event) => {
    const wiringInput = event.target.closest("[data-custom-wiring]");
    const notchInput = event.target.closest("[data-custom-notch]");
    if (!wiringInput && !notchInput) return;

    const index = Number(
      wiringInput?.dataset.customWiring ?? notchInput?.dataset.customNotch,
    );
    const card = elements.customRotorEditor.querySelector(`[data-custom-card="${index}"]`);
    const wiring = card.querySelector("[data-custom-wiring]").value;
    const notch = card.querySelector("[data-custom-notch]").value;
    const rotor = validateCustomRotor(index, wiring, notch);
    card.querySelectorAll("input").forEach((input) => {
      input.setAttribute("aria-invalid", String(!rotor.valid));
    });
    const status = card.querySelector("[data-custom-status]");
    status.textContent = rotor.error || "Valid permutation · Ready to install";
    status.classList.toggle("error", !rotor.valid);
    machine.history = "";
    machine.lastTrace = null;
    renderCustomValidity();
    renderMachine();
    renderTrace();
  });

  elements.reflectorPairs.addEventListener("input", (event) => {
    if (machine.reflector !== "CUSTOM") return;
    const input = event.target.closest("[data-reflector-pair]");
    if (!input) return;

    input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    const pairs = [...elements.reflectorPairs.querySelectorAll("[data-reflector-pair]")]
      .map((pairInput) => pairInput.value);
    const reflector = validateCustomReflector(pairs);
    elements.reflectorPairs
      .querySelectorAll("[data-reflector-pair]")
      .forEach((pairInput, index) => {
        pairInput.setAttribute(
          "aria-invalid",
          String(reflector.invalidIndexes.includes(index)),
        );
      });
    machine.history = "";
    machine.lastTrace = null;
    renderReflectorValidity();
    renderMachine();
    renderTrace();
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
    "wiringLab",
    "customRotorEditor",
    "wiringValidity",
    "reflectorPanel",
    "reflectorPairs",
    "reflectorLabEyebrow",
    "reflectorLabTitle",
    "reflectorLabCopy",
    "reflectorValidity",
    "reflectorError",
    "lampboard",
    "keyboard",
    "plainText",
    "cipherText",
    "inputLabel",
    "outputLabel",
    "operationAction",
    "modeExplanation",
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

  populateRotorSelect(
    elements.leftRotor,
    machine.rotorOrder[0],
    CUSTOM_ROTOR_IDS[0],
    "Custom wiring…",
  );
  populateRotorSelect(
    elements.middleRotor,
    machine.rotorOrder[1],
    CUSTOM_ROTOR_IDS[1],
    "Custom wiring…",
  );
  populateRotorSelect(
    elements.rightRotor,
    machine.rotorOrder[2],
    CUSTOM_ROTOR_IDS[2],
    "Custom wiring…",
  );
  createRotorWindows();
  createCustomRotorEditor();
  createReflectorEditor();
  createLetterBoard(elements.lampboard, false);
  createLetterBoard(elements.keyboard, true);
  updateRotorSelects();
  bindEvents();
  renderMachine();
  renderOperationMode();
}

document.addEventListener("DOMContentLoaded", init);
