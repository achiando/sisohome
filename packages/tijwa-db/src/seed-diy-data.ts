export type DiySeedSpec = { label: string; material: string; pieces?: number }
export type DiySeedImage = { url: string; alt: string }

export type DiySeedCategory = {
  name: string
  slug: string
  description: string
  sortOrder: number
}

export type DiySeedProduct = {
  categorySlug: string
  name: string
  slug: string
  shortDesc: string
  description: string
  unit: string
  price: number
  specifications: DiySeedSpec[]
  images: DiySeedImage[]
  isFeatured: boolean
  sortOrder: number
  seoTitle: string
  seoDesc: string
}

export type DiySeedProjectProduct = {
  productSlug: string
  quantity: number
  isRequired: boolean
}

export type DiySeedProject = {
  title: string
  slug: string
  category: string
  shortDesc: string
  description: string
  steps: { title: string; body: string }[]
  images: DiySeedImage[]
  isFeatured: boolean
  sortOrder: number
  seoTitle: string
  seoDesc: string
  products: DiySeedProjectProduct[]
}

/* ================================================================== */
/* ENGINE — do not hand-edit below this line until "CATEGORIES"        */
/* ================================================================== */

type SpecTuple = [label: string, value: string, pieces?: number]

type Row = {
  slug: string
  name: string
  unit: string // "Each" | "Set" | "Kit" | "Pack of N"
  price: number // KSh
  short: string
  use: string // appended to short to form the long description
  specs: SpecTuple[]
  q?: string // Wikimedia Commons search term for the image fetcher
}

const r = (
  slug: string,
  name: string,
  unit: string,
  price: number,
  short: string,
  use: string,
  specs: SpecTuple[],
  q?: string
): Row => ({ slug, name, unit, price, short, use, specs, q })

/** slug -> image search term, consumed by seed-diy.ts --images */
export const diyImageQueries: Record<string, string> = {}

const rows: Record<string, Row[]> = {}
const push = (cat: string, ...list: Row[]) => {
  rows[cat] = [...(rows[cat] ?? []), ...list]
}

const featured = new Set([
  "uno-r3-development-board",
  "esp32-devkit-v1",
  "hc-sr04-ultrasonic-sensor",
  "1-channel-relay-module",
  "830-point-breadboard",
  "digital-multimeter",
  "resistor-kit-1-4w",
  "led-kit-5mm",
  "sg90-micro-servo",
  "soldering-iron-60w",
  "robot-chassis-2wd-kit",
  "jumper-wire-set",
  "student-electronics-starter-kit",
  "arduino-uno-starter-kit",
  "esp32-iot-starter-kit",
  "sensor-kit-37-in-1",
])

/* ------------------------------------------------------------------ */
/* Generator helpers                                                   */
/* ------------------------------------------------------------------ */

const fmtOhms = (o: number) =>
  o >= 1e6 ? `${o / 1e6} MΩ` : o >= 1e3 ? `${o / 1e3} kΩ` : `${o} Ω`

const codeOhms = (o: number) => {
  if (o >= 1e6) {
    const m = o / 1e6
    return Number.isInteger(m) ? `${m}m` : String(m).replace(".", "m")
  }
  if (o >= 1e3) {
    const k = o / 1e3
    return Number.isInteger(k) ? `${k}k` : String(k).replace(".", "k")
  }
  return `${o}r`
}

const codeUf = (v: number) =>
  Number.isInteger(v) ? `${v}u` : String(v).replace(".", "u")

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const diyCategories: DiySeedCategory[] = [
  {
    name: "Starter Kits & Bundles",
    slug: "starter-kits",
    sortOrder: 1,
    description:
      "Ready-made kits for students and beginners — everything for a first project in one box.",
  },
  {
    name: "Electronics Components",
    slug: "electronics-components",
    sortOrder: 2,
    description:
      "Resistors, capacitors, LEDs, potentiometers, buzzers and other passive parts, sold in packs so you always have spares.",
  },
  {
    name: "Semiconductors & ICs",
    slug: "semiconductors",
    sortOrder: 3,
    description:
      "Diodes, transistors, MOSFETs, voltage regulators, timers and logic chips for building circuits from scratch.",
  },
  {
    name: "Switches & Connectors",
    slug: "switches-connectors",
    sortOrder: 4,
    description:
      "Push buttons, switches, pin headers, terminals, jacks and sockets for wiring projects together.",
  },
  {
    name: "Sensors",
    slug: "sensors",
    sortOrder: 5,
    description:
      "Temperature, humidity, motion, light, gas, distance, pressure, weight and motion-tracking sensors.",
  },
  {
    name: "Modules & Boards",
    slug: "modules-boards",
    sortOrder: 6,
    description:
      "Arduino, ESP32 and Pico boards plus relay, motor driver, display, clock and expansion modules.",
  },
  {
    name: "Wireless & IoT",
    slug: "wireless-iot",
    sortOrder: 7,
    description:
      "Bluetooth, WiFi, RF, LoRa, GPS, RFID, NFC, GSM and camera modules for connected builds.",
  },
  {
    name: "Prototyping",
    slug: "prototyping",
    sortOrder: 8,
    description:
      "Breadboards, jumper wires, perfboards and copper-clad boards for building before you solder.",
  },
  {
    name: "Electrical & Power",
    slug: "electrical",
    sortOrder: 9,
    description:
      "Power supplies, batteries, chargers, converters, hookup wire, fuses and heat shrink.",
  },
  {
    name: "Tools & Workshop",
    slug: "tools-workshop",
    sortOrder: 10,
    description:
      "Soldering, measuring and hand tools for the workbench, plus solder and flux.",
  },
  {
    name: "Enclosures & Hardware",
    slug: "enclosures-hardware",
    sortOrder: 11,
    description:
      "Project boxes, standoffs, screws, cable ties and fixings to turn a breadboard build into a finished product.",
  },
  {
    name: "Robotics & Automation",
    slug: "robotics-automation",
    sortOrder: 12,
    description:
      "Servos, motors, steppers, pumps, valves, fans and chassis kits for moving and automating things.",
  },
]

/* ================================================================== */
/* GENERATED FAMILIES — value ladders. Add a number = add a product.   */
/* ================================================================== */

/* ---- Resistors: 1/4 W, 100 per pack ---- */
const ohmHints: Record<number, string> = {
  10: "low-value current sensing and snubbers",
  12: "current sensing and snubber networks",
  18: "series damping and protection",
  22: "series damping and low-current limiting",
  33: "gate resistors and current limiting",
  47: "series terminations and current sensing",
  56: "gate resistors and LED limiting",
  82: "LED limiting on 3.3 V boards",
  100: "LED limiting on 3.3 V boards",
  120: "LED limiting and gate resistors",
  150: "bright LED limiting on 5 V",
  180: "IR LED limiting and dividers",
  220: "the standard LED current-limiting value on 5 V boards",
  270: "LED limiting and sensor outputs",
  330: "LED limiting with a softer glow",
  390: "LED limiting and transistor bases",
  470: "LED limiting and transistor base resistors",
  560: "dividers and LED limiting",
  680: "LED limiting and gentle dimming",
  820: "dividers and current sensing",
  1000: "transistor bases, LED limiting and general signal work",
  1200: "transistor bases and dividers",
  1500: "voltage dividers and base resistors",
  1800: "base resistors and current sense",
  2200: "I2C pull-ups and transistor bases",
  2700: "dividers and sensor bias",
  3300: "voltage dividers and logic-level shifting",
  3900: "pull-ups and dividers",
  4700: "I2C and 1-Wire pull-ups (DS18B20, DHT)",
  5600: "dividers and timing networks",
  6800: "dividers and timing networks",
  8200: "timing and filter networks",
  10000: "pull-ups, pull-downs and voltage dividers",
  12000: "pull-ups and dividers",
  15000: "dividers and filter networks",
  18000: "bias and timing networks",
  22000: "bias networks and timing",
  27000: "bias networks and filters",
  33000: "high-impedance dividers",
  39000: "high-impedance dividers",
  47000: "high-impedance dividers and timing",
  56000: "timing and bias networks",
  68000: "timing and bias networks",
  82000: "timing and filter networks",
  100000: "timing circuits and high-impedance inputs",
  120000: "timing and high-impedance inputs",
  150000: "timing circuits and dimming",
  180000: "long time constants",
  220000: "long time constants and bias",
  270000: "long time constants and bias",
  330000: "high-impedance inputs",
  390000: "very high-impedance inputs",
  470000: "very high-impedance inputs",
  560000: "very high-impedance inputs",
  680000: "very high-impedance inputs",
  820000: "very high-impedance inputs",
  1000000: "very high-impedance inputs and long time constants",
  2200000: "leakage-sensitive, very high-impedance inputs",
}
const ohms = Object.keys(ohmHints).map(Number)

push(
  "electronics-components",
  r(
    "resistor-kit-1-4w",
    "Resistor Kit — 1/4 W Assorted (600 pcs)",
    "Kit",
    450,
    "30 common values, 20 of each, in a labelled case.",
    "Covers LED limiting, dividers, pull-ups and sensor inputs. The best first purchase for a student bench.",
    [
      ["Contents", "30 values × 20 pcs", 600],
      ["Power rating", "1/4 W"],
      ["Tolerance", "±5%"],
    ],
    "resistor"
  ),
  ...ohms.map((o) =>
    r(
      `resistor-${codeOhms(o)}-pack-100`,
      `${fmtOhms(o)} Resistor — 1/4 W (Pack of 100)`,
      "Pack of 100",
      o >= 1e6 ? 120 : 100,
      `100 carbon-film ${fmtOhms(o)} resistors, 1/4 W, ±5%.`,
      `Useful for ${ohmHints[o]}. Sold in 100s so a whole class or workshop stays stocked.`,
      [
        ["Value", fmtOhms(o)],
        ["Power rating", "1/4 W"],
        ["Tolerance", "±5%"],
        ["Type", "Carbon film, through-hole"],
      ],
      "carbon film resistor"
    )
  ),
  ...[100, 220, 470, 1000, 4700, 10000].map((o) =>
    r(
      `resistor-${codeOhms(o)}-half-w-pack-50`,
      `${fmtOhms(o)} Resistor — 1/2 W (Pack of 50)`,
      "Pack of 50",
      120,
      `50 carbon-film ${fmtOhms(o)} resistors rated 1/2 W.`,
      "Use where a quarter-watt part runs hot, such as LED strips and small power stages.",
      [
        ["Value", fmtOhms(o)],
        ["Power rating", "1/2 W"],
        ["Tolerance", "±5%"],
      ],
      "carbon film resistor"
    )
  )
)

/* ---- Ceramic capacitors, 50 per pack ---- */
const ceramics: [string, string][] = [
  ["10 pF", "10p"],
  ["22 pF", "22p"],
  ["47 pF", "47p"],
  ["100 pF", "100p"],
  ["330 pF", "330p"],
  ["470 pF", "470p"],
  ["1 nF", "1n"],
  ["2.2 nF", "2n2"],
  ["4.7 nF", "4n7"],
  ["10 nF", "10n"],
  ["22 nF", "22n"],
  ["47 nF", "47n"],
  ["100 nF", "100n"],
  ["1 µF", "1u"],
]
push(
  "electronics-components",
  r(
    "ceramic-capacitor-kit",
    "Ceramic Capacitor Kit (100 pcs)",
    "Kit",
    350,
    "Assorted ceramic capacitors from 10 pF to 100 nF.",
    "Decoupling, filtering and timing. Place a 100 nF beside each IC's power pins.",
    [
      ["Contents", "10 values × 10 pcs", 100],
      ["Range", "10 pF – 100 nF"],
    ],
    "ceramic capacitor"
  ),
  ...ceramics.map(([label, code]) =>
    r(
      `ceramic-cap-${code}-pack-50`,
      `${label} Ceramic Capacitor (Pack of 50)`,
      "Pack of 50",
      150,
      `50 ceramic disc capacitors, ${label}, 50 V.`,
      label === "22 pF"
        ? "The pair of 22 pF caps that go with a 16 MHz crystal."
        : label === "100 nF"
          ? "The standard decoupling capacitor — one per IC."
          : "General decoupling, filtering and timing.",
      [
        ["Value", label],
        ["Voltage", "50 V"],
        ["Type", "Ceramic disc"],
      ],
      "ceramic capacitor"
    )
  )
)

/* ---- Electrolytic capacitors, 20 per pack ---- */
const electros = [
  0.47, 1, 3.3, 4.7, 10, 15, 22, 33, 47, 68, 100, 150, 220, 330, 470, 1000,
  2200, 4700,
]
push(
  "electronics-components",
  r(
    "electrolytic-capacitor-kit",
    "Electrolytic Capacitor Kit (120 pcs)",
    "Kit",
    450,
    "Assorted 1 µF to 1000 µF electrolytic capacitors.",
    "Smoothing, audio coupling and 555 timing. The striped lead is negative.",
    [
      ["Contents", "10 values × 12 pcs", 120],
      ["Range", "1 µF – 1000 µF"],
    ],
    "electrolytic capacitor"
  ),
  ...electros.map((v) =>
    r(
      `electrolytic-${codeUf(v)}-pack-20`,
      `${v} µF Electrolytic Capacitor (Pack of 20)`,
      "Pack of 20",
      v >= 1000 ? 300 : v >= 220 ? 200 : 150,
      `20 radial electrolytic capacitors, ${v} µF.`,
      "Polarised — mind the stripe. Use for power smoothing, timing and coupling.",
      [
        ["Value", `${v} µF`],
        ["Voltage", v >= 1000 ? "16 V" : "25 V"],
        ["Type", "Radial electrolytic"],
      ],
      "electrolytic capacitor"
    )
  )
)

/* ---- LEDs by colour ---- */
const ledColours: [string, string][] = [
  ["red", "Red"],
  ["green", "Green"],
  ["yellow", "Yellow"],
  ["blue", "Blue"],
  ["white", "White"],
  ["orange", "Orange"],
]
for (const size of [5, 3]) {
  push(
    "electronics-components",
    ...ledColours.map(([c, label]) =>
      r(
        `led-${size}mm-${c}-pack-50`,
        `${label} LED ${size} mm (Pack of 50)`,
        "Pack of 50",
        size === 5 ? 200 : 180,
        `50 ${label.toLowerCase()} ${size} mm through-hole LEDs.`,
        "Always use a series resistor — 220 Ω is a safe default on 5 V.",
        [
          ["Colour", label],
          ["Size", `${size} mm`],
          ["Leads", "Through-hole, 2.54 mm"],
        ],
        `${size}mm LED`
      )
    )
  )
}

/* ---- Screws, standoffs, heat shrink, cable ties ---- */
const screws: [string, number[]][] = [
  ["M2", [4, 6, 8, 10]],
  ["M2.5", [6, 10, 12]],
  ["M3", [6, 10, 16, 20, 30]],
  ["M4", [10, 20]],
  ["M5", [10, 16, 20, 30]],
]
for (const [thread, lengths] of screws) {
  push(
    "enclosures-hardware",
    ...lengths.map((len) =>
      r(
        `screw-${thread.toLowerCase().replace(".", "")}x${len}-pack-50`,
        `${thread}×${len} mm Pan-Head Screw (Pack of 50)`,
        "Pack of 50",
        150,
        `50 ${thread} × ${len} mm cross-head screws.`,
        "Zinc-plated steel for boards, enclosures and chassis.",
        [
          ["Thread", thread],
          ["Length", `${len} mm`],
          ["Head", "Pan, Phillips"],
        ],
        "machine screw"
      )
    ),
    r(
      `nut-${thread.toLowerCase().replace(".", "")}-pack-100`,
      `${thread} Hex Nut (Pack of 100)`,
      "Pack of 100",
      150,
      `100 ${thread} hex nuts.`,
      "Pairs with the matching screws.",
      [["Thread", thread]],
      "hex nut"
    )
  )
}
push(
  "enclosures-hardware",
  ...[6, 8, 10, 12, 15, 20, 25, 30, 40].map((len) =>
    r(
      `standoff-m3-${len}mm-pack-20`,
      `M3 Male-Female Standoff ${len} mm (Pack of 20)`,
      "Pack of 20",
      250,
      `20 brass M3 standoffs, ${len} mm.`,
      "Lift boards off a base plate or enclosure floor.",
      [
        ["Thread", "M3"],
        ["Length", `${len} mm`],
        ["Material", "Brass"],
      ],
      "standoff spacer"
    )
  ),
  ...[50, 100, 150, 200, 250, 300, 370].map((len) =>
    r(
      `cable-tie-${len}mm-pack-100`,
      `Nylon Cable Ties ${len} mm (Pack of 100)`,
      "Pack of 100",
      len >= 200 ? 200 : 150,
      `100 nylon cable ties, ${len} mm.`,
      "Bundle wiring inside enclosures and on chassis.",
      [
        ["Length", `${len} mm`],
        ["Material", "Nylon"],
      ],
      "cable tie"
    )
  )
)
push(
  "electrical",
  ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((d) =>
    r(
      `heat-shrink-${d}mm-pack-10`,
      `Heat Shrink Tubing ${d} mm × 10 cm (Pack of 10)`,
      "Pack of 10",
      d >= 10 ? 150 : 120,
      `10 black heat-shrink tubes, ${d} mm, 10 cm long.`,
      "Slide over a wire before soldering, then shrink for an insulated joint.",
      [
        ["Diameter", `${d} mm`],
        ["Shrink ratio", "2:1"],
      ],
      "heat shrink tubing"
    )
  ),
  ...(["red", "black", "yellow", "green", "blue", "white"] as const).map((c) =>
    r(
      `hookup-wire-22awg-${c}-5m`,
      `Hookup Wire 22 AWG ${c[0].toUpperCase() + c.slice(1)} (5 m roll)`,
      "Roll",
      120,
      `5 m of solid-core 22 AWG hookup wire in ${c}.`,
      "Breadboard and perfboard wiring; colour-code your rails.",
      [
        ["Gauge", "22 AWG solid core"],
        ["Length", "5 m"],
      ],
      "hookup wire"
    )
  ),
  ...(["red", "black", "yellow", "green", "blue", "white"] as const).map((c) =>
    r(
      `hookup-wire-24awg-${c}-5m`,
      `Hookup Wire 24 AWG ${c[0].toUpperCase() + c.slice(1)} (5 m roll)`,
      "Roll",
      100,
      `5 m of solid-core 24 AWG hookup wire in ${c}.`,
      "Thinner than 22 AWG — fits tight breadboard rows and fine signal wiring.",
      [
        ["Gauge", "24 AWG solid core"],
        ["Length", "5 m"],
      ],
      "hookup wire"
    )
  ),
  r(
    "silicone-wire-24awg-1m-pair",
    "Silicone Stranded Wire 24 AWG (Red + Black, 1 m each)",
    "Pair",
    150,
    "Flexible stranded leads that stay soft.",
    "Servo extensions, battery leads and anything that moves.",
    [
      ["Gauge", "24 AWG stranded silicone"],
      ["Length", "2 × 1 m"],
    ],
    "silicone wire"
  ),
  r(
    "fuse-blade-assortment-40",
    "Blade Fuse Assortment ATO/ATC (40 pcs)",
    "Kit",
    400,
    "5 A to 30 A blade fuses in a compartment case.",
    "Protect 12 V supply leads to motors, pumps and LED strips.",
    [
      ["Contents", "5 – 30 A assorted", 40],
      ["Type", "ATO/ATC blade"],
    ],
    "blade fuse"
  ),
  r(
    "fuse-holder-blade-pack-5",
    "Blade Fuse Holder (Pack of 5)",
    "Pack of 5",
    250,
    "Inline holders for blade fuses.",
    "Add one close to the battery on every 12 V build.",
    [
      ["Fits", "ATO/ATC"],
      ["Rating", "30 A"],
    ],
    "fuse holder"
  ),
  r(
    "usb-c-cable-1m",
    "USB-C Data Cable 1 m",
    "Each",
    300,
    "Power and program modern USB-C boards.",
    "Make sure the cable carries data, not just power.",
    [
      ["Length", "1 m"],
      ["Type", "USB 2.0"],
    ],
    "USB-C cable"
  ),
  r(
    "solar-panel-6v-3w",
    "6 V 3 W Mini Solar Panel",
    "Each",
    1200,
    "Sized for small battery-charging builds.",
    "Daylight power for sensors; use a charge controller when charging batteries.",
    [
      ["Power", "3 W"],
      ["Output", "6 V"],
    ],
    "solar panel"
  ),
  r(
    "aa-alkaline-pack-4",
    "AA Alkaline Battery (Pack of 4)",
    "Pack of 4",
    300,
    "Fresh AA cells for portable projects.",
    "Runs sensor nodes and small motors; recycle when flat.",
    [
      ["Voltage", "1.5 V"],
      ["Type", "Alkaline"],
    ],
    "AA battery"
  ),
  r(
    "aaa-alkaline-pack-4",
    "AAA Alkaline Battery (Pack of 4)",
    "Pack of 4",
    250,
    "Fresh AAA cells for compact builds.",
    "Fits the smaller 2× and 4×AAA holders.",
    [
      ["Voltage", "1.5 V"],
      ["Type", "Alkaline"],
    ],
    "AAA battery"
  ),
  r(
    "9v-battery-pack-2",
    "9 V PP3 Alkaline Battery (Pack of 2)",
    "Pack of 2",
    350,
    "Snap-on 9 V batteries for UNO builds.",
    "Pairs with the 9 V battery clip for portable power.",
    [
      ["Voltage", "9 V"],
      ["Type", "Alkaline"],
    ],
    "9V battery"
  )
)

/* ---- Metal-film 1% resistors, film capacitors, inductors, LED extras ---- */
const metalFilm = [100, 330, 1000, 4700, 10000, 100000]
push(
  "electronics-components",
  ...metalFilm.map((o) =>
    r(
      `resistor-mf-${codeOhms(o)}-pack-50`,
      `${fmtOhms(o)} Resistor — 1/4 W Metal Film 1% (Pack of 50)`,
      "Pack of 50",
      150,
      `50 metal-film ${fmtOhms(o)} resistors, 1/4 W, ±1%.`,
      "Tighter tolerance than carbon film for dividers, sensor circuits and anything calibration matters.",
      [
        ["Value", fmtOhms(o)],
        ["Power rating", "1/4 W"],
        ["Tolerance", "±1%"],
        ["Type", "Metal film, through-hole"],
      ],
      "metal film resistor"
    )
  ),
  ...(
    [
      ["10 nF", "10n"],
      ["33 nF", "33n"],
      ["100 nF", "100n"],
      ["220 nF", "220n"],
      ["1 µF", "1u"],
      ["2.2 µF", "2u2"],
    ] as [string, string][]
  ).map(([label, code]) =>
    r(
      `film-cap-${code}-pack-20`,
      `${label} Film Capacitor (Pack of 20)`,
      "Pack of 20",
      150,
      `20 polyester film capacitors, ${label}, 50 V.`,
      "Stable where ceramic capacitance drifts — timing, coupling and audio filters.",
      [
        ["Value", label],
        ["Voltage", "50 V"],
        ["Type", "Polyester film"],
      ],
      "film capacitor"
    )
  ),
  ...(
    [
      ["10 µH", "10uh"],
      ["47 µH", "47uh"],
      ["100 µH", "100uh"],
      ["330 µH", "330uh"],
      ["1 mH", "1mh"],
    ] as [string, string][]
  ).map(([label, code]) =>
    r(
      `inductor-${code}-pack-10`,
      `${label} Power Inductor (Pack of 10)`,
      "Pack of 10",
      150,
      `10 axial power inductors, ${label}.`,
      "Filtering and energy storage in switching supplies and oscillator tanks.",
      [
        ["Value", label],
        ["Type", "Axial, ferrite core"],
        ["Tolerance", "±10%"],
      ],
      "power inductor"
    )
  ),
  ...ledColours.map(([c, label]) =>
    r(
      `led-10mm-${c}-pack-20`,
      `${label} LED 10 mm (Pack of 20)`,
      "Pack of 20",
      220,
      `20 ${label.toLowerCase()} 10 mm through-hole LEDs.`,
      "Larger lens for indicator panels and light effects — always use a series resistor.",
      [
        ["Colour", label],
        ["Size", "10 mm"],
        ["Leads", "Through-hole, 2.54 mm"],
      ],
      "10mm LED"
    )
  ),
  r(
    "ir-led-5mm-940nm-pack-10",
    "IR LED 5 mm 940 nm (Pack of 10)",
    "Pack of 10",
    200,
    "Infrared emitters for remotes and light barriers.",
    "Pair with an IR receiver or phototransistor; the beam is invisible to the eye.",
    [
      ["Wavelength", "940 nm"],
      ["Size", "5 mm"],
    ],
    "infrared LED"
  ),
  r(
    "uv-led-5mm-pack-10",
    "UV LED 5 mm (Pack of 10)",
    "Pack of 10",
    300,
    "Near-ultraviolet LEDs.",
    "Curing resin, fluorescent effects and counterfeit-note checks.",
    [
      ["Wavelength", "≈ 400 nm"],
      ["Size", "5 mm"],
    ],
    "ultraviolet LED"
  ),
  r(
    "rgb-led-common-anode-pack-5",
    "RGB LED 5 mm Common Anode (Pack of 5)",
    "Pack of 5",
    200,
    "Four-pin RGB LEDs with a shared positive lead.",
    "Colour mixing with PWM — one resistor per channel.",
    [
      ["Type", "Common anode"],
      ["Pins", "4"],
    ],
    "RGB LED"
  ),
  r(
    "led-bicolor-rg-pack-10",
    "Bi-Colour Red/Green LED 3 mm (Pack of 10)",
    "Pack of 10",
    250,
    "Two colours in one small package.",
    "Status indicators: red for fault, green for OK.",
    [
      ["Colours", "Red / green"],
      ["Size", "3 mm"],
      ["Pins", "3"],
    ],
    "bi-color LED"
  ),
  r(
    "led-holder-5mm-pack-20",
    "5 mm LED Holder Bezel (Pack of 20)",
    "Pack of 20",
    150,
    "Panel bezels for 5 mm LEDs.",
    "Snap an LED neatly into a drilled panel.",
    [
      ["Fits", "5 mm LED"],
      ["Mount", "8 mm hole"],
    ],
    "LED holder"
  ),
  r(
    "led-holder-10mm-pack-10",
    "10 mm LED Holder Bezel (Pack of 10)",
    "Pack of 10",
    150,
    "Panel bezels for 10 mm LEDs.",
    "Neat indicators on boxes and dashboards.",
    [
      ["Fits", "10 mm LED"],
      ["Mount", "12 mm hole"],
    ],
    "LED holder"
  ),
  r(
    "crystal-8mhz-pack-5",
    "8 MHz Crystal HC-49S (Pack of 5)",
    "Pack of 5",
    150,
    "Clock crystals for 8 MHz ATmega and PIC builds.",
    "Use with two 22 pF load capacitors.",
    [
      ["Frequency", "8 MHz"],
      ["Package", "HC-49S"],
    ],
    "quartz crystal"
  ),
  r(
    "crystal-32768hz-pack-5",
    "32.768 kHz Watch Crystal (Pack of 5)",
    "Pack of 5",
    150,
    "Tuning-fork crystals for real-time clocks.",
    "The standard clock source for RTC circuits.",
    [
      ["Frequency", "32.768 kHz"],
      ["Load capacitance", "12.5 pF"],
    ],
    "watch crystal"
  ),
  r(
    "potentiometer-500r-pack-5",
    "500 Ω Rotary Potentiometer (Pack of 5)",
    "Pack of 5",
    250,
    "Low-value linear pots for LED dimming.",
    "Fine brightness control with little heat.",
    [
      ["Value", "500 Ω"],
      ["Taper", "Linear (B)"],
    ],
    "potentiometer"
  ),
  r(
    "potentiometer-4k7-pack-5",
    "4.7 kΩ Rotary Potentiometer (Pack of 5)",
    "Pack of 5",
    250,
    "Linear 4.7 kΩ pots.",
    "Sensor calibration and gain adjustment.",
    [
      ["Value", "4.7 kΩ"],
      ["Taper", "Linear (B)"],
    ],
    "potentiometer"
  ),
  r(
    "potentiometer-50k-pack-5",
    "50 kΩ Rotary Potentiometer (Pack of 5)",
    "Pack of 5",
    250,
    "Linear 50 kΩ pots.",
    "Audio and timing controls between the common 10 k and 100 k values.",
    [
      ["Value", "50 kΩ"],
      ["Taper", "Linear (B)"],
    ],
    "potentiometer"
  )
)

push(
  "enclosures-hardware",
  ...(["M2", "M2.5", "M3", "M4", "M5"] as const).map((thread) =>
    r(
      `washer-${thread.toLowerCase().replace(".", "")}-pack-100`,
      `${thread} Flat Washer (Pack of 100)`,
      "Pack of 100",
      150,
      `100 ${thread} zinc flat washers.`,
      "Spread the load under screw heads so lids and standoffs do not crush.",
      [
        ["Thread", thread],
        ["Material", "Zinc-plated steel"],
      ],
      "flat washer"
    )
  ),
  ...[10, 20, 30].map((len) =>
    r(
      `standoff-nylon-m3-${len}mm-pack-20`,
      `Nylon M3 Standoff ${len} mm (Pack of 20)`,
      "Pack of 20",
      200,
      `20 insulating nylon M3 standoffs, ${len} mm.`,
      "Electrically isolate a board from a metal base plate.",
      [
        ["Thread", "M3"],
        ["Length", `${len} mm`],
        ["Material", "Nylon"],
      ],
      "nylon standoff"
    )
  ),
  ...["PG9", "PG11", "PG13.5"].map((size) =>
    r(
      `cable-gland-${size.toLowerCase().replace(".", "")}-pack-5`,
      `Cable Gland ${size} (Pack of 5)`,
      "Pack of 5",
      250,
      `5 ${size} cable glands for thicker leads.`,
      "Strain relief and dust sealing where PG7 is too small.",
      [["Size", size]],
      "cable gland"
    )
  ),
  r(
    "screw-self-tapping-2x8-pack-50",
    "Self-Tapping Screw 2×8 mm (Pack of 50)",
    "Pack of 50",
    150,
    "Thread-forming screws for plastic enclosures.",
    "Bite into plastic bosses without needing a nut.",
    [
      ["Thread", "2×8 mm"],
      ["Head", "Pan, Phillips"],
    ],
    "self-tapping screw"
  ),
  r(
    "screw-self-tapping-3x12-pack-50",
    "Self-Tapping Screw 3×12 mm (Pack of 50)",
    "Pack of 50",
    200,
    "Larger thread-forming screws.",
    "Fix brackets and standoffs into thicker plastic walls.",
    [
      ["Thread", "3×12 mm"],
      ["Head", "Pan, Phillips"],
    ],
    "self-tapping screw"
  )
)

push(
  "prototyping",
  r(
    "ribbon-cable-10way-1m",
    "IDC Ribbon Cable 10-Way (1 m)",
    "Roll",
    250,
    "Flat ten-conductor cable for IDC connectors.",
    "Clean bus wiring between boards, displays and keypads.",
    [
      ["Conductors", "10"],
      ["Length", "1 m"],
    ],
    "ribbon cable"
  ),
  r(
    "jumper-wires-mm-10cm-pack-40",
    "Male-to-Male Jumper Wires 10 cm (Pack of 40)",
    "Pack of 40",
    120,
    "Short jumpers for tidy breadboards.",
    "Keeps low-profile wiring out of the way of the work.",
    [
      ["Type", "Male-male"],
      ["Length", "10 cm"],
    ],
    "jumper wires"
  ),
  r(
    "jumper-wires-mm-30cm-pack-20",
    "Male-to-Male Jumper Wires 30 cm (Pack of 20)",
    "Pack of 20",
    120,
    "Long jumpers for spread-out builds.",
    "Reach from a bench supply across to the board.",
    [
      ["Type", "Male-male"],
      ["Length", "30 cm"],
    ],
    "jumper wires"
  ),
  r(
    "copper-clad-board-5x7",
    "Copper-Clad Board 5×7 cm (Single-Sided)",
    "Each",
    200,
    "Blank PCB stock for etching your own layout.",
    "Toner-transfer or photoresist methods at home.",
    [
      ["Size", "5×7 cm"],
      ["Copper", "Single-sided, 1 oz"],
    ],
    "copper clad board"
  ),
  r(
    "copper-clad-board-9x15",
    "Copper-Clad Board 9×15 cm (Single-Sided)",
    "Each",
    400,
    "Larger blank PCB stock.",
    "Etch several small boards from one piece.",
    [
      ["Size", "9×15 cm"],
      ["Copper", "Single-sided, 1 oz"],
    ],
    "copper clad board"
  )
)

/* ================================================================== */
/* CURATED PRODUCTS                                                    */
/* ================================================================== */

push(
  "starter-kits",
  r(
    "student-electronics-starter-kit",
    "Student Electronics Starter Kit",
    "Kit",
    2800,
    "Breadboard, resistors, LEDs, capacitors, buttons and jumpers for first circuits.",
    "Everything for the first term of an electronics class without needing a board. Pairs with the multimeter for measuring.",
    [
      [
        "Includes",
        "830-pt breadboard, 600 resistors, 100 LEDs, capacitor kit, 20 buttons, jumpers, 9 V clip",
      ],
    ],
    "electronics components kit"
  ),
  r(
    "arduino-uno-starter-kit",
    "UNO R3 Starter Kit (Board + Sensors + Parts)",
    "Kit",
    4500,
    "UNO R3 board with breadboard, sensors, LEDs, servo, LCD and parts.",
    "The classic learn-to-code-hardware kit with parts for 20+ beginner projects.",
    [
      [
        "Includes",
        "UNO R3, breadboard, LCD1602, servo, HC-SR04, LEDs, resistors, jumpers, USB cable",
      ],
    ],
    "Arduino starter kit"
  ),
  r(
    "esp32-iot-starter-kit",
    "ESP32 IoT Starter Kit",
    "Kit",
    3500,
    "ESP32 DevKit with sensors and relay for WiFi and Bluetooth projects.",
    "Build web-controlled switches, weather stations and MQTT sensors out of the box.",
    [
      [
        "Includes",
        "ESP32 DevKit, DHT22, relay module, OLED, breadboard, jumpers",
      ],
    ],
    "ESP32 development board"
  ),
  r(
    "sensor-kit-37-in-1",
    "37-in-1 Sensor Module Kit",
    "Kit",
    3200,
    "37 common sensor and actuator modules in one box.",
    "A broad set for learning how each sensor type works; no soldering needed.",
    [["Contents", "37 modules", 37]],
    "Arduino sensor kit"
  ),
  r(
    "soldering-starter-kit",
    "Soldering Starter Kit",
    "Kit",
    3200,
    "Iron, stand, solder, flux, pump and braid for first soldering.",
    "Everything to start soldering header pins and through-hole boards.",
    [["Includes", "60 W iron, stand, solder, flux, desoldering pump, braid"]],
    "soldering iron kit"
  ),
  r(
    "robotics-starter-kit-2wd",
    "2WD Robotics Starter Kit",
    "Kit",
    5500,
    "UNO, motor driver, ultrasonic sensor, servo, chassis and batteries.",
    "Build an obstacle-avoiding or Bluetooth-driven robot car straight away.",
    [
      [
        "Includes",
        "UNO, L298N, HC-SR04, SG90, 2WD chassis, battery holder, jumpers",
      ],
    ],
    "robot car kit"
  ),

  /* ---- Batch F: starter kits ---- */
  r(
    "raspberry-pi-pico-starter-kit",
    "Raspberry Pi Pico Starter Kit",
    "Kit",
    3800,
    "Pico board with breadboard, sensors, LEDs and USB cable.",
    "MicroPython and C on the RP2040 with everything to start blinking.",
    [
      [
        "Includes",
        "Pico, breadboard, DHT22, LEDs, resistors, jumpers, USB cable",
      ],
    ],
    "Raspberry Pi Pico"
  ),
  r(
    "esp8266-iot-starter-kit",
    "ESP8266 IoT Starter Kit",
    "Kit",
    3200,
    "NodeMCU board with relay, sensor, OLED and breadboard.",
    "First WiFi projects: web dashboards, timers and remote switches.",
    [["Includes", "NodeMCU, relay, DHT11, OLED, breadboard, jumpers"]],
    "ESP8266 development board"
  ),
  r(
    "microbit-starter-kit",
    "micro:bit Starter Kit",
    "Kit",
    4800,
    "micro:bit V2 with battery box, breakout board and LEDs.",
    "Block-based coding in MakeCode with real hardware inputs.",
    [["Includes", "micro:bit V2, AAA box, breakout board, LEDs, cables"]],
    "microbit"
  ),
  r(
    "solar-energy-starter-kit",
    "Solar Energy Starter Kit",
    "Kit",
    4500,
    "6 V panel, charge controller, lithium cell and DC-DC converter.",
    "Charge a battery from the sun and power a small sensor node.",
    [["Includes", "6 V 3 W panel, CN3791 controller, 18650, TP4056, XL6009"]],
    "solar panel"
  ),
  r(
    "robotics-starter-kit-4wd",
    "4WD Robotics Starter Kit",
    "Kit",
    5000,
    "4WD chassis with UNO, motor driver and line sensors.",
    "Heavier platform for line following and load carrying.",
    [
      [
        "Includes",
        "UNO, L298N, 4WD chassis, 4 motors, line sensor, battery box",
      ],
    ],
    "4WD robot chassis"
  ),
  r(
    "home-automation-starter-kit",
    "Home Automation Starter Kit",
    "Kit",
    4800,
    "UNO with 4-channel relay, PIR, DHT and lamp holder.",
    "Control lights and fans from sensors; have mains wiring checked by a qualified person.",
    [["Includes", "UNO, 4-channel relay, PIR, DHT22, lamp holder, cables"]],
    "home automation kit"
  ),
  r(
    "stepper-cnc-starter-kit",
    "Stepper & CNC Starter Kit",
    "Kit",
    4200,
    "Two NEMA 17 steppers with A4988 drivers, PSU and UNO.",
    "Build a plotter, mini mill or 3D printer motion stage.",
    [["Includes", "2 × NEMA 17, 2 × A4988, 12 V PSU, UNO, limit switches"]],
    "NEMA 17"
  ),
  r(
    "rfid-access-control-kit",
    "RFID Access Control Kit",
    "Kit",
    4200,
    "UNO with RC522 reader, relay, buzzer and cards.",
    "Door locks and attendance systems with swipe cards.",
    [["Includes", "UNO, RC522 kit, relay, buzzer, RFID cards, LEDs"]],
    "RC522 RFID"
  ),
  r(
    "weather-station-starter-kit",
    "Weather Station Starter Kit",
    "Kit",
    4500,
    "ESP32 with DHT22, OLED display and solar panel.",
    "Log temperature and humidity online or show them on the screen.",
    [["Includes", "ESP32, DHT22, OLED 0.96, 6 V solar, battery holder"]],
    "weather station kit"
  )
)

push(
  "electronics-components",
  r(
    "potentiometer-10k-pack-5",
    "10 kΩ Rotary Potentiometer (Pack of 5)",
    "Pack of 5",
    250,
    "Linear 10 kΩ pots for volume, dimming and analog input.",
    "Wire the outer pins to 5 V and ground and read the wiper on an analog pin.",
    [
      ["Value", "10 kΩ"],
      ["Taper", "Linear (B)"],
    ],
    "potentiometer"
  ),
  r(
    "potentiometer-1k-pack-5",
    "1 kΩ Rotary Potentiometer (Pack of 5)",
    "Pack of 5",
    250,
    "Linear 1 kΩ pots.",
    "Good for LED dimming and bias adjustment.",
    [
      ["Value", "1 kΩ"],
      ["Taper", "Linear (B)"],
    ],
    "potentiometer"
  ),
  r(
    "potentiometer-100k-pack-5",
    "100 kΩ Rotary Potentiometer (Pack of 5)",
    "Pack of 5",
    250,
    "Linear 100 kΩ pots.",
    "Higher-impedance controls and timing adjustments.",
    [
      ["Value", "100 kΩ"],
      ["Taper", "Linear (B)"],
    ],
    "potentiometer"
  ),
  r(
    "trimmer-pot-3296-kit",
    "3296 Multi-Turn Trimmer Kit (50 pcs)",
    "Kit",
    500,
    "Precise preset trimmers from 100 Ω to 1 MΩ.",
    "Set thresholds and calibrate sensor circuits with fine adjustment.",
    [
      ["Contents", "10 values × 5 pcs", 50],
      ["Turns", "25"],
    ],
    "trimmer potentiometer"
  ),
  r(
    "ldr-photoresistor-pack-10",
    "LDR Photoresistor GL5528 (Pack of 10)",
    "Pack of 10",
    200,
    "Light-dependent resistors for light sensing.",
    "Pair with a 10 kΩ resistor as a divider and read it on an analog pin.",
    [
      ["Model", "GL5528"],
      ["Light resistance", "10 – 20 kΩ"],
    ],
    "photoresistor"
  ),
  r(
    "ntc-thermistor-10k-pack-5",
    "NTC Thermistor 10 kΩ (Pack of 5)",
    "Pack of 5",
    200,
    "Simple analog temperature sensing element.",
    "Use in a divider with a 10 kΩ resistor; convert with the beta equation.",
    [
      ["Value", "10 kΩ at 25 °C"],
      ["Beta", "3950"],
    ],
    "NTC thermistor"
  ),
  r(
    "led-kit-5mm",
    "LED Kit — 5 mm Assorted (100 pcs)",
    "Kit",
    350,
    "100 × 5 mm LEDs in five colours.",
    "Plugs straight into a breadboard; add a 220 Ω resistor per LED.",
    [
      ["Contents", "5 colours × 20 pcs", 100],
      ["Size", "5 mm"],
    ],
    "5mm LED"
  ),
  r(
    "led-kit-3mm",
    "LED Kit — 3 mm Assorted (100 pcs)",
    "Kit",
    300,
    "Compact 3 mm LEDs in five colours.",
    "For dense boards and model builds.",
    [
      ["Contents", "5 colours × 20 pcs", 100],
      ["Size", "3 mm"],
    ],
    "3mm LED"
  ),
  r(
    "rgb-led-common-cathode-pack-5",
    "RGB LED 5 mm Common Cathode (Pack of 5)",
    "Pack of 5",
    200,
    "Four-pin RGB LEDs for colour mixing with PWM.",
    "Drive each colour pin through its own resistor.",
    [
      ["Type", "Common cathode"],
      ["Pins", "4"],
    ],
    "RGB LED"
  ),
  r(
    "seven-segment-single-pack-5",
    '7-Segment Display 0.56" Single Digit (Pack of 5)',
    "Pack of 5",
    250,
    "Red single-digit displays for counters and timers.",
    "Drive directly with resistors or through a 74HC595.",
    [
      ["Type", "Common cathode"],
      ["Size", "0.56 in"],
    ],
    "seven segment display"
  ),
  r(
    "buzzer-active-5v-pack-5",
    "Active Buzzer 5 V (Pack of 5)",
    "Pack of 5",
    250,
    "Self-oscillating buzzers — apply 5 V and they beep.",
    "Alarms, timers and key-press feedback.",
    [
      ["Voltage", "3.3 – 5 V"],
      ["Type", "Active"],
    ],
    "piezo buzzer"
  ),
  r(
    "buzzer-passive-pack-5",
    "Passive Buzzer Module (Pack of 5)",
    "Pack of 5",
    250,
    "Play tones and tunes with PWM.",
    "Needs a square wave, so it can play melodies.",
    [["Type", "Passive"]],
    "piezo buzzer"
  ),
  r(
    "crystal-16mhz-pack-5",
    "16 MHz Crystal HC-49S (Pack of 5)",
    "Pack of 5",
    150,
    "Clock crystals for standalone ATmega builds.",
    "Use with two 22 pF capacitors.",
    [["Frequency", "16 MHz"]],
    "quartz crystal"
  ),
  r(
    "speaker-8ohm-0-5w-pack-2",
    "8 Ω 0.5 W Mini Speaker (Pack of 2)",
    "Pack of 2",
    250,
    "Small speakers for tones and simple audio.",
    "Drive from an amplifier module or a transistor.",
    [
      ["Impedance", "8 Ω"],
      ["Power", "0.5 W"],
    ],
    "loudspeaker"
  )
)

push(
  "semiconductors",
  r(
    "diode-1n4007-pack-20",
    "1N4007 Rectifier Diode (Pack of 20)",
    "Pack of 20",
    150,
    "1 A, 1000 V general-purpose rectifier diodes.",
    "Flyback diodes across relay coils and motors; reverse-polarity protection.",
    [
      ["Current", "1 A"],
      ["Reverse voltage", "1000 V"],
      ["Package", "DO-41"],
    ],
    "1N4007 diode"
  ),
  r(
    "diode-1n4148-pack-50",
    "1N4148 Signal Diode (Pack of 50)",
    "Pack of 50",
    150,
    "Fast small-signal switching diodes.",
    "Logic steering and clamping.",
    [
      ["Current", "200 mA"],
      ["Package", "DO-35"],
    ],
    "1N4148 diode"
  ),
  r(
    "diode-1n5819-pack-20",
    "1N5819 Schottky Diode (Pack of 20)",
    "Pack of 20",
    200,
    "Low-drop 1 A Schottky diodes.",
    "Efficient protection and rectification in low-voltage supplies.",
    [
      ["Current", "1 A"],
      ["Voltage", "40 V"],
    ],
    "Schottky diode"
  ),
  r(
    "zener-diode-kit",
    "Zener Diode Kit 1 W (50 pcs)",
    "Kit",
    300,
    "Assorted 1 W zeners from 3.3 V to 15 V.",
    "Clamp or reference a voltage.",
    [["Contents", "Assorted 3.3 – 15 V", 50]],
    "zener diode"
  ),
  r(
    "bridge-rectifier-w10-pack-5",
    "W10 Bridge Rectifier (Pack of 5)",
    "Pack of 5",
    200,
    "1.5 A bridge rectifier in a DIP package.",
    "Turn AC from a transformer into DC.",
    [
      ["Current", "1.5 A"],
      ["Voltage", "1000 V"],
    ],
    "bridge rectifier"
  ),
  r(
    "transistor-2n2222a-pack-10",
    "2N2222A NPN Transistor (Pack of 10)",
    "Pack of 10",
    150,
    "General-purpose NPN for loads to 800 mA.",
    "Switch LEDs, small relays and buzzers through a 1 kΩ base resistor.",
    [
      ["Type", "NPN"],
      ["Collector current", "800 mA"],
      ["Package", "TO-92"],
    ],
    "2N2222 transistor"
  ),
  r(
    "transistor-bc547-pack-10",
    "BC547 NPN Transistor (Pack of 10)",
    "Pack of 10",
    100,
    "Small-signal NPN for amplifiers and light loads.",
    "A staple of student circuits.",
    [
      ["Type", "NPN"],
      ["Collector current", "100 mA"],
    ],
    "BC547 transistor"
  ),
  r(
    "transistor-bc557-pack-10",
    "BC557 PNP Transistor (Pack of 10)",
    "Pack of 10",
    100,
    "PNP complement to the BC547.",
    "Push-pull stages and high-side switching.",
    [
      ["Type", "PNP"],
      ["Collector current", "100 mA"],
    ],
    "BC557 transistor"
  ),
  r(
    "transistor-bc337-pack-10",
    "BC337 NPN Transistor (Pack of 10)",
    "Pack of 10",
    120,
    "800 mA NPN in TO-92.",
    "A stronger alternative to the BC547.",
    [
      ["Type", "NPN"],
      ["Collector current", "800 mA"],
    ],
    "BC337 transistor"
  ),
  r(
    "transistor-2n3904-pack-10",
    "2N3904 NPN Transistor (Pack of 10)",
    "Pack of 10",
    120,
    "General-purpose NPN, 200 mA.",
    "Switching and small amplifier stages.",
    [
      ["Type", "NPN"],
      ["Collector current", "200 mA"],
    ],
    "2N3904"
  ),
  r(
    "transistor-2n3906-pack-10",
    "2N3906 PNP Transistor (Pack of 10)",
    "Pack of 10",
    120,
    "General-purpose PNP, 200 mA.",
    "Complement to the 2N3904.",
    [
      ["Type", "PNP"],
      ["Collector current", "200 mA"],
    ],
    "2N3906"
  ),
  r(
    "tip120-darlington-pack-5",
    "TIP120 Darlington Transistor (Pack of 5)",
    "Pack of 5",
    250,
    "NPN Darlington for loads up to 5 A.",
    "Add a flyback diode across inductive loads.",
    [
      ["Type", "NPN Darlington"],
      ["Collector current", "5 A"],
      ["Package", "TO-220"],
    ],
    "TIP120 transistor"
  ),
  r(
    "mosfet-irlz44n-pack-5",
    "IRLZ44N Logic-Level MOSFET (Pack of 5)",
    "Pack of 5",
    450,
    "N-channel MOSFET switchable from 5 V.",
    "Switch motors, LED strips and pumps with low loss.",
    [
      ["Type", "N-channel, logic level"],
      ["Drain current", "47 A"],
      ["Package", "TO-220"],
    ],
    "IRLZ44N MOSFET"
  ),
  r(
    "mosfet-irf540n-pack-5",
    "IRF540N MOSFET (Pack of 5)",
    "Pack of 5",
    400,
    "N-channel power MOSFET, 33 A, 100 V.",
    "Needs about 10 V gate drive; use a driver or transistor stage.",
    [
      ["Type", "N-channel"],
      ["Drain current", "33 A"],
      ["Package", "TO-220"],
    ],
    "IRF540N MOSFET"
  ),
  r(
    "triac-bt136-pack-5",
    "BT136 Triac (Pack of 5)",
    "Pack of 5",
    300,
    "4 A, 600 V triac for AC switching.",
    "Mains dimmers and switches. Use with an optoisolated driver and take care with mains.",
    [
      ["Current", "4 A"],
      ["Voltage", "600 V"],
    ],
    "triac"
  ),
  r(
    "lm7805-regulator-pack-5",
    "LM7805 5 V Regulator (Pack of 5)",
    "Pack of 5",
    200,
    "Fixed 5 V regulator, up to 1.5 A.",
    "Add 100 nF capacitors on input and output.",
    [
      ["Output", "5 V"],
      ["Input", "7 – 25 V"],
    ],
    "7805 voltage regulator"
  ),
  r(
    "lm7809-regulator-pack-5",
    "LM7809 9 V Regulator (Pack of 5)",
    "Pack of 5",
    200,
    "Fixed 9 V regulator.",
    "Steady 9 V from 12 V sources.",
    [
      ["Output", "9 V"],
      ["Max current", "1.5 A"],
    ],
    "7809 voltage regulator"
  ),
  r(
    "lm7812-regulator-pack-5",
    "LM7812 12 V Regulator (Pack of 5)",
    "Pack of 5",
    200,
    "Fixed 12 V regulator.",
    "Steady 12 V from higher DC sources.",
    [
      ["Output", "12 V"],
      ["Max current", "1.5 A"],
    ],
    "7812 voltage regulator"
  ),
  r(
    "ams1117-3v3-pack-5",
    "AMS1117-3.3 Regulator (Pack of 5)",
    "Pack of 5",
    200,
    "3.3 V low-dropout regulator, SOT-223.",
    "Power 3.3 V sensors from a 5 V rail.",
    [
      ["Output", "3.3 V"],
      ["Current", "800 mA"],
    ],
    "AMS1117"
  ),
  r(
    "lm317-regulator-pack-3",
    "LM317 Adjustable Regulator (Pack of 3)",
    "Pack of 3",
    200,
    "Adjustable 1.25 – 37 V regulator.",
    "Set any voltage with two resistors.",
    [
      ["Output", "1.25 – 37 V"],
      ["Max current", "1.5 A"],
    ],
    "LM317 voltage regulator"
  ),
  r(
    "tl431-reference-pack-10",
    "TL431 Voltage Reference (Pack of 10)",
    "Pack of 10",
    150,
    "Adjustable shunt reference.",
    "Precision references and simple regulators.",
    [["Reference", "2.5 V adjustable"]],
    "TL431"
  ),
  r(
    "ne555-timer-pack-5",
    "NE555 Timer IC DIP-8 (Pack of 5)",
    "Pack of 5",
    200,
    "The classic timer for flashers, delays and oscillators.",
    "The best first IC for students.",
    [
      ["Package", "DIP-8"],
      ["Supply", "4.5 – 15 V"],
    ],
    "NE555 timer"
  ),
  r(
    "lm358-op-amp-pack-5",
    "LM358 Dual Op-Amp (Pack of 5)",
    "Pack of 5",
    200,
    "Dual single-supply op-amp.",
    "Amplifiers and comparators from 5 V.",
    [
      ["Channels", "2"],
      ["Package", "DIP-8"],
    ],
    "LM358"
  ),
  r(
    "lm324-op-amp-pack-3",
    "LM324 Quad Op-Amp (Pack of 3)",
    "Pack of 3",
    200,
    "Four op-amps in one package.",
    "Multi-stage filters and sensor conditioning.",
    [
      ["Channels", "4"],
      ["Package", "DIP-14"],
    ],
    "LM324"
  ),
  r(
    "lm393-comparator-pack-5",
    "LM393 Dual Comparator (Pack of 5)",
    "Pack of 5",
    200,
    "Dual voltage comparator.",
    "Threshold detectors and level sensing.",
    [
      ["Channels", "2"],
      ["Package", "DIP-8"],
    ],
    "LM393"
  ),
  r(
    "lm386-audio-amp-pack-3",
    "LM386 Audio Amplifier (Pack of 3)",
    "Pack of 3",
    250,
    "Low-voltage power amp for small speakers.",
    "Add audio output to your builds.",
    [
      ["Power", "≈ 0.7 W"],
      ["Package", "DIP-8"],
    ],
    "LM386"
  ),
  r(
    "74hc595-shift-register-pack-3",
    "74HC595 Shift Register (Pack of 3)",
    "Pack of 3",
    250,
    "8 outputs from 3 pins.",
    "LED rows, 7-segment displays and relay banks.",
    [
      ["Outputs", "8"],
      ["Package", "DIP-16"],
    ],
    "74HC595"
  ),
  r(
    "74hc14-schmitt-pack-3",
    "74HC14 Schmitt Trigger Inverter (Pack of 3)",
    "Pack of 3",
    200,
    "Six inverters with hysteresis.",
    "Debouncing and clean-up of slow signals.",
    [
      ["Gates", "6"],
      ["Package", "DIP-14"],
    ],
    "74HC14"
  ),
  r(
    "cd4017-counter-pack-3",
    "CD4017 Decade Counter (Pack of 3)",
    "Pack of 3",
    200,
    "Ten sequential outputs from a clock.",
    "Chaser lights and sequencers with a 555.",
    [
      ["Outputs", "10"],
      ["Package", "DIP-16"],
    ],
    "CD4017"
  ),
  r(
    "uln2003a-driver-pack-3",
    "ULN2003A Darlington Array (Pack of 3)",
    "Pack of 3",
    250,
    "Seven 500 mA drivers in one chip.",
    "Relays, solenoids and unipolar steppers.",
    [
      ["Channels", "7"],
      ["Package", "DIP-16"],
    ],
    "ULN2003"
  ),
  r(
    "l293d-motor-driver-pack-2",
    "L293D Motor Driver IC (Pack of 2)",
    "Pack of 2",
    400,
    "Dual H-bridge in DIP-16.",
    "Drive two small DC motors with built-in flyback diodes.",
    [
      ["Current", "600 mA per channel"],
      ["Package", "DIP-16"],
    ],
    "L293D"
  ),
  r(
    "pc817-optocoupler-pack-10",
    "PC817 Optocoupler (Pack of 10)",
    "Pack of 10",
    250,
    "Isolate a signal between two circuits.",
    "Protects a microcontroller from noisy or higher-voltage circuits.",
    [
      ["Isolation", "5000 V"],
      ["Package", "DIP-4"],
    ],
    "PC817 optocoupler"
  ),
  r(
    "atmega328p-pu-bootloader",
    "ATmega328P-PU with Bootloader",
    "Each",
    700,
    "Bare chip pre-loaded for Arduino IDE.",
    "Build a standalone board with a crystal and two capacitors.",
    [
      ["Package", "DIP-28"],
      ["Flash", "32 KB"],
    ],
    "ATmega328P"
  ),
  r(
    "relay-srd-05vdc-pack-5",
    "SRD-05VDC Relay (Pack of 5)",
    "Pack of 5",
    350,
    "Bare 5 V relays, 10 A contacts.",
    "Build your own relay board with a transistor and flyback diode.",
    [
      ["Coil", "5 V"],
      ["Contacts", "10 A 250 V AC"],
    ],
    "relay"
  )
)

/* ---- Batch B: diodes, zeners, rectifiers, transistors, linear & logic ICs ---- */
const zeners: [string, string, string][] = [
  ["3v3", "3.3", "1N4728A"],
  ["3v9", "3.9", "1N4730A"],
  ["5v1", "5.1", "1N4733A"],
  ["5v6", "5.6", "1N4734A"],
  ["6v8", "6.8", "1N4736A"],
  ["9v1", "9.1", "1N4739A"],
  ["10v", "10", "1N4740A"],
  ["12v", "12", "1N4742A"],
  ["15v", "15", "1N4744A"],
]
push(
  "semiconductors",
  r(
    "diode-1n5408-pack-10",
    "1N5408 Rectifier Diode (Pack of 10)",
    "Pack of 10",
    250,
    "3 A, 1000 V rectifiers in a heavy DO-201 package.",
    "Higher-current flyback protection and power-supply rectification.",
    [
      ["Current", "3 A"],
      ["Reverse voltage", "1000 V"],
      ["Package", "DO-201"],
    ],
    "1N5408 diode"
  ),
  r(
    "diode-1n5817-pack-20",
    "1N5817 Schottky Diode (Pack of 20)",
    "Pack of 20",
    200,
    "1 A, 20 V Schottky diodes.",
    "Low-drop reverse protection on 5 V rails.",
    [
      ["Current", "1 A"],
      ["Voltage", "20 V"],
      ["Package", "DO-41"],
    ],
    "Schottky diode"
  ),
  r(
    "diode-assortment-kit-100",
    "Diode Assortment Kit (100 pcs)",
    "Kit",
    400,
    "1N4007, 1N4148, 1N5819 and assorted zeners in labelled compartments.",
    "Restocks a classroom bench with the diodes used in the classic power and protection circuits.",
    [["Contents", "Rectifier, signal, Schottky, zener", 100]],
    "diode"
  ),
  ...zeners.map(([code, v, part]) =>
    r(
      `zener-${code}-1w-pack-20`,
      `${v} V Zener Diode 1 W — ${part} (Pack of 20)`,
      "Pack of 20",
      200,
      `20 × ${part} zener diodes, ${v} V, 1 W.`,
      `Clamp a line to about ${v} V or build a simple shunt reference; keep dissipation under 1 W.`,
      [
        ["Voltage", `${v} V`],
        ["Power", "1 W"],
        ["Package", "DO-41"],
      ],
      "zener diode"
    )
  ),
  r(
    "bridge-rectifier-gbu8j-pack-3",
    "GBU8J Bridge Rectifier (Pack of 3)",
    "Pack of 3",
    300,
    "8 A bridge rectifiers for transformer supplies.",
    "Turn low-voltage AC into DC for power projects.",
    [
      ["Current", "8 A"],
      ["Voltage", "600 V"],
    ],
    "bridge rectifier"
  ),
  r(
    "bridge-rectifier-kbpc3510-pack-2",
    "KBPC3510 Bridge Rectifier (Pack of 2)",
    "Pack of 2",
    450,
    "35 A metal-case bridge with a mounting hole.",
    "High-current supplies for motors and chargers; bolt to a heatsink.",
    [
      ["Current", "35 A"],
      ["Voltage", "1000 V"],
    ],
    "bridge rectifier"
  ),
  r(
    "diac-db3-pack-10",
    "DB3 DIAC (Pack of 10)",
    "Pack of 10",
    200,
    "Trigger diodes for triac circuits.",
    "Fires a triac gate at about 32 V — the classic dimmer trigger.",
    [
      ["Breakover", "28 – 36 V"],
      ["Package", "DO-35"],
    ],
    "DIAC"
  ),
  r(
    "varistor-14d471-pack-10",
    "14D471 MOV Varistor (Pack of 10)",
    "Pack of 10",
    300,
    "Mains-voltage surge suppressors.",
    "Clamp voltage spikes across an AC input. Mains safety applies — fit inside an enclosure.",
    [
      ["Varistor voltage", "470 V"],
      ["Disc", "14 mm"],
    ],
    "varistor"
  ),
  r(
    "transistor-bd139-pack-5",
    "BD139 NPN Transistor (Pack of 5)",
    "Pack of 5",
    250,
    "800 mA NPN in TO-126 for driver stages.",
    "Audio drivers and medium loads that run warm in TO-92.",
    [
      ["Type", "NPN"],
      ["Collector current", "800 mA"],
      ["Package", "TO-126"],
    ],
    "BD139 transistor"
  ),
  r(
    "transistor-bd140-pack-5",
    "BD140 PNP Transistor (Pack of 5)",
    "Pack of 5",
    250,
    "PNP complement to the BD139.",
    "Push-pull output stages and high-side switching.",
    [
      ["Type", "PNP"],
      ["Collector current", "800 mA"],
      ["Package", "TO-126"],
    ],
    "BD140 transistor"
  ),
  r(
    "transistor-tip31c-pack-5",
    "TIP31C NPN Transistor (Pack of 5)",
    "Pack of 5",
    300,
    "3 A medium-power NPN.",
    "Driver for motors, lamps and larger relays.",
    [
      ["Type", "NPN"],
      ["Collector current", "3 A"],
      ["Package", "TO-220"],
    ],
    "TIP31 transistor"
  ),
  r(
    "transistor-tip32c-pack-5",
    "TIP32C PNP Transistor (Pack of 5)",
    "Pack of 5",
    300,
    "PNP complement to the TIP31C.",
    "Complementary output stages and high-side switching.",
    [
      ["Type", "PNP"],
      ["Collector current", "3 A"],
      ["Package", "TO-220"],
    ],
    "TIP32 transistor"
  ),
  r(
    "transistor-tip125-pack-5",
    "TIP125 PNP Darlington (Pack of 5)",
    "Pack of 5",
    350,
    "PNP Darlington for loads up to 5 A.",
    "High-side complement to the TIP120.",
    [
      ["Type", "PNP Darlington"],
      ["Collector current", "5 A"],
      ["Package", "TO-220"],
    ],
    "TIP125 transistor"
  ),
  r(
    "transistor-2sd880-pack-5",
    "2SD880 NPN Transistor (Pack of 5)",
    "Pack of 5",
    300,
    "3 A audio-driver NPN in TO-126.",
    "Speaker drivers and medium motor control.",
    [
      ["Type", "NPN"],
      ["Collector current", "3 A"],
      ["Package", "TO-126"],
    ],
    "2SD880 transistor"
  ),
  r(
    "transistor-2n7000-pack-10",
    "2N7000 MOSFET (Pack of 10)",
    "Pack of 10",
    250,
    "Small-signal N-channel MOSFET in TO-92.",
    "Level shifting and low-side switching of small loads.",
    [
      ["Type", "N-channel"],
      ["Drain-source voltage", "60 V"],
      ["Package", "TO-92"],
    ],
    "2N7000 MOSFET"
  ),
  r(
    "mosfet-irfz44n-pack-5",
    "IRFZ44N MOSFET (Pack of 5)",
    "Pack of 5",
    400,
    "N-channel power MOSFET, 49 A, 55 V.",
    "Needs about 10 V gate drive; pair it with a logic-level driver stage.",
    [
      ["Type", "N-channel"],
      ["Drain current", "49 A"],
      ["Package", "TO-220"],
    ],
    "IRFZ44N MOSFET"
  ),
  r(
    "mosfet-irf9540n-pack-5",
    "IRF9540N P-Channel MOSFET (Pack of 5)",
    "Pack of 5",
    450,
    "P-channel power MOSFET for high-side switching.",
    "Switch the positive rail without a charge pump.",
    [
      ["Type", "P-channel"],
      ["Drain current", "23 A"],
      ["Package", "TO-220"],
    ],
    "P-channel MOSFET"
  ),
  r(
    "mosfet-irf3205-pack-3",
    "IRF3205 MOSFET (Pack of 3)",
    "Pack of 3",
    450,
    "110 A, 55 V N-channel MOSFET.",
    "Battery chargers and high-current inverters; bolt one to a proper heatsink.",
    [
      ["Type", "N-channel"],
      ["Drain current", "110 A"],
      ["Package", "TO-220"],
    ],
    "IRF3205 MOSFET"
  ),
  r(
    "transistor-assortment-kit-60",
    "Transistor Assortment Kit (60 pcs)",
    "Kit",
    450,
    "Six common NPN, PNP and Darlington types, ten of each.",
    "Covers switching, amplifying and driver roles from a single box.",
    [["Contents", "2N2222A, BC547, BC557, 2N3904, 2N3906, TIP120", 60]],
    "transistor"
  ),
  r(
    "lm78l05-regulator-pack-10",
    "LM78L05 5 V Regulator TO-92 (Pack of 10)",
    "Pack of 10",
    250,
    "100 mA fixed 5 V regulator in a small package.",
    "Power a sensor or logic chip without a full-size 7805.",
    [
      ["Output", "5 V"],
      ["Max current", "100 mA"],
      ["Package", "TO-92"],
    ],
    "voltage regulator"
  ),
  r(
    "ams1117-5v-pack-5",
    "AMS1117-5.0 Regulator (Pack of 5)",
    "Pack of 5",
    200,
    "5 V low-dropout regulator, SOT-223.",
    "Run 5 V logic from a 6–12 V rail with little dropout.",
    [
      ["Output", "5 V"],
      ["Current", "1 A"],
    ],
    "AMS1117 regulator"
  ),
  r(
    "ams1117-adj-pack-5",
    "AMS1117 Adjustable Regulator (Pack of 5)",
    "Pack of 5",
    250,
    "Adjustable LDO, SOT-223.",
    "Set the output with two resistors; 1.25 V up to the input minus dropout.",
    [
      ["Output", "1.25 V – input"],
      ["Current", "1 A"],
    ],
    "AMS1117 regulator"
  ),
  r(
    "lm337-negative-regulator-pack-3",
    "LM337 Negative Regulator (Pack of 3)",
    "Pack of 3",
    300,
    "Adjustable negative regulator, the complement to the LM317.",
    "Build the −12 V rail for op-amp circuits.",
    [
      ["Output", "−1.25 – −37 V"],
      ["Max current", "1.5 A"],
    ],
    "LM337 voltage regulator"
  ),
  r(
    "lm2576-5v-regulator-pack-3",
    "LM2576-5.0 Switching Regulator (Pack of 3)",
    "Pack of 3",
    450,
    "3 A buck regulator that runs cool.",
    "Efficient 5 V from 12 V — far less heat than a 7805.",
    [
      ["Output", "5 V"],
      ["Current", "3 A"],
      ["Package", "TO-220"],
    ],
    "LM2576 voltage regulator"
  ),
  r(
    "mc34063-regulator-pack-5",
    "MC34063 Switching Regulator (Pack of 5)",
    "Pack of 5",
    300,
    "Buck, boost and inverting controller in DIP-8.",
    "Learn switch-mode supplies with one inductor and a diode.",
    [
      ["Function", "Buck / boost / inverting"],
      ["Package", "DIP-8"],
    ],
    "MC34063"
  ),
  r(
    "ua741-op-amp-pack-5",
    "UA741 Op-Amp (Pack of 5)",
    "Pack of 5",
    200,
    "The classic single op-amp.",
    "Internal compensation makes it forgiving for first amplifier builds.",
    [
      ["Channels", "1"],
      ["Package", "DIP-8"],
    ],
    "UA741 op-amp"
  ),
  r(
    "tl072-op-amp-pack-5",
    "TL072 JFET Op-Amp (Pack of 5)",
    "Pack of 5",
    300,
    "Dual JFET-input op-amp with low noise.",
    "Audio stages and high-impedance sensor inputs.",
    [
      ["Channels", "2"],
      ["Package", "DIP-8"],
    ],
    "TL072 op-amp"
  ),
  r(
    "lm339-comparator-pack-5",
    "LM339 Quad Comparator (Pack of 5)",
    "Pack of 5",
    250,
    "Four comparators with open-collector outputs.",
    "Threshold detectors, window alarms and level shifting.",
    [
      ["Channels", "4"],
      ["Package", "DIP-14"],
    ],
    "LM339 comparator"
  ),
  r(
    "tlc555-timer-pack-5",
    "TLC555 CMOS Timer (Pack of 5)",
    "Pack of 5",
    250,
    "Low-power CMOS version of the 555.",
    "Same pinout as the NE555 but draws far less supply current.",
    [
      ["Package", "DIP-8"],
      ["Supply", "2 – 15 V"],
    ],
    "TLC555 timer"
  ),
  r(
    "linear-ic-kit-30",
    "Linear IC Kit — Timers & Op-Amps (30 pcs)",
    "Kit",
    500,
    "LM358, LM324, UA741, LM393 and NE555, six of each.",
    "The complete analog IC set for student experiments.",
    [["Contents", "LM358, LM324, UA741, LM393, NE555", 30]],
    "integrated circuit"
  ),
  r(
    "regulator-kit-20",
    "Voltage Regulator Kit (20 pcs)",
    "Kit",
    450,
    "LM7805, LM7809, LM7812, AMS1117-3.3 and LM317 in one box.",
    "Fixed and adjustable regulation for every supply rail a project asks for.",
    [["Contents", "7805, 7809, 7812, AMS1117, LM317", 20]],
    "voltage regulator"
  ),
  r(
    "logic-ic-kit-50",
    "Logic IC Kit — 74HC & CD4000 (50 pcs)",
    "Kit",
    600,
    "Ten common gates, decoders and counters, five of each.",
    "Build anything from chaser lights to keypad readers without ordering single chips.",
    [["Contents", "74HC00/08/32/86/14/138/595, CD4011/4017/4060", 50]],
    "logic gate integrated circuit"
  ),
  r(
    "74hc00-quad-nand-pack-5",
    "74HC00 Quad NAND Gate (Pack of 5)",
    "Pack of 5",
    200,
    "Four NAND gates — the universal logic family.",
    "Any gate can be built from NAND alone; great for teaching.",
    [
      ["Gates", "4 NAND"],
      ["Package", "DIP-14"],
    ],
    "74HC00"
  ),
  r(
    "74hc02-quad-nor-pack-5",
    "74HC02 Quad NOR Gate (Pack of 5)",
    "Pack of 5",
    200,
    "Four NOR gates.",
    "Active-low logic and simple latch circuits.",
    [
      ["Gates", "4 NOR"],
      ["Package", "DIP-14"],
    ],
    "74HC02"
  ),
  r(
    "74hc08-quad-and-pack-5",
    "74HC08 Quad AND Gate (Pack of 5)",
    "Pack of 5",
    200,
    "Four AND gates.",
    "Combine enable and permission signals from two sources.",
    [
      ["Gates", "4 AND"],
      ["Package", "DIP-14"],
    ],
    "74HC08"
  ),
  r(
    "74hc32-quad-or-pack-5",
    "74HC32 Quad OR Gate (Pack of 5)",
    "Pack of 5",
    200,
    "Four OR gates.",
    "Merge alarm conditions from several sensors.",
    [
      ["Gates", "4 OR"],
      ["Package", "DIP-14"],
    ],
    "74HC32"
  ),
  r(
    "74hc86-quad-xor-pack-5",
    "74HC86 Quad XOR Gate (Pack of 5)",
    "Pack of 5",
    200,
    "Four XOR gates.",
    "Parity checks, toggles and edge-detection tricks.",
    [
      ["Gates", "4 XOR"],
      ["Package", "DIP-14"],
    ],
    "74HC86"
  ),
  r(
    "74hc125-quad-buffer-pack-5",
    "74HC125 Quad Buffer (Pack of 5)",
    "Pack of 5",
    200,
    "Four buffers with tri-state outputs.",
    "Share one bus between several chips.",
    [
      ["Gates", "4 buffers"],
      ["Package", "DIP-14"],
    ],
    "74HC125"
  ),
  r(
    "74hc132-quad-nand-schmitt-pack-5",
    "74HC132 Schmitt NAND (Pack of 5)",
    "Pack of 5",
    250,
    "Four NAND gates with Schmitt triggers.",
    "Clean up slow or noisy signals coming straight from sensors.",
    [
      ["Gates", "4 NAND, Schmitt"],
      ["Package", "DIP-14"],
    ],
    "74HC132"
  ),
  r(
    "74hc138-decoder-pack-3",
    "74HC138 3-to-8 Decoder (Pack of 3)",
    "Pack of 3",
    250,
    "Eight active-low outputs from three select lines.",
    "Address several displays, relays or sensors.",
    [
      ["Outputs", "8 active-low"],
      ["Package", "DIP-16"],
    ],
    "74HC138 decoder"
  ),
  r(
    "74hc165-shift-register-pack-3",
    "74HC165 Parallel-In Shift Register (Pack of 3)",
    "Pack of 3",
    300,
    "Read eight parallel inputs over three pins.",
    "Add buttons to a board that has run out of GPIO.",
    [
      ["Inputs", "8 parallel"],
      ["Package", "DIP-16"],
    ],
    "74HC165"
  ),
  r(
    "74hc245-bus-transceiver-pack-3",
    "74HC245 Bus Transceiver (Pack of 3)",
    "Pack of 3",
    300,
    "Eight bidirectional buffers with direction control.",
    "Bus wiring between boards at different logic levels.",
    [
      ["Channels", "8 bidirectional"],
      ["Package", "DIP-20"],
    ],
    "74HC245"
  ),
  r(
    "74hc4051-mux-pack-3",
    "74HC4051 8-Channel Mux (Pack of 3)",
    "Pack of 3",
    300,
    "Eight analog inputs on one output.",
    "Read many analog sensors with a single ADC pin.",
    [
      ["Channels", "8 analog"],
      ["Package", "DIP-16"],
    ],
    "74HC4051"
  ),
  r(
    "74hc574-octal-latch-pack-3",
    "74HC574 Octal D Flip-Flop (Pack of 3)",
    "Pack of 3",
    300,
    "Eight edge-triggered outputs from eight inputs.",
    "Drive LED banks or latched outputs from three pins.",
    [
      ["Outputs", "8"],
      ["Package", "DIP-20"],
    ],
    "74HC574"
  ),
  r(
    "74hc4511-bcd-driver-pack-3",
    "74HC4511 BCD-to-7-Segment Driver (Pack of 3)",
    "Pack of 3",
    300,
    "Drives common-cathode 7-segment displays from BCD.",
    "Pair with a counter for a display with no microcontroller.",
    [
      ["Function", "BCD to 7-segment"],
      ["Package", "DIP-16"],
    ],
    "74HC4511"
  ),
  r(
    "cd4011-quad-nand-pack-5",
    "CD4011 Quad NAND Gate (Pack of 5)",
    "Pack of 5",
    200,
    "CMOS NAND gates for 3–18 V supplies.",
    "Wide-voltage logic for battery-powered projects.",
    [
      ["Gates", "4 NAND"],
      ["Package", "DIP-14"],
    ],
    "CD4011"
  ),
  r(
    "cd4026-counter-pack-5",
    "CD4026 Decade Counter + Display Driver (Pack of 5)",
    "Pack of 5",
    300,
    "Counts pulses and drives a 7-segment display directly.",
    "Digital counters with no chip left over.",
    [
      ["Function", "BCD counter + 7-seg driver"],
      ["Package", "DIP-16"],
    ],
    "CD4026"
  ),
  r(
    "cd4060-oscillator-pack-5",
    "CD4060 Oscillator + Counter (Pack of 5)",
    "Pack of 5",
    250,
    "Built-in oscillator driving a 14-stage divider.",
    "Long timers and clock dividers from a crystal or RC network.",
    [
      ["Stages", "14-stage counter"],
      ["Package", "DIP-16"],
    ],
    "CD4060"
  ),
  r(
    "cd4066-analog-switch-pack-5",
    "CD4066 Quad Analog Switch (Pack of 5)",
    "Pack of 5",
    250,
    "Four bilateral switches for analog signals.",
    "Route audio or sensor signals under logic control.",
    [
      ["Switches", "4"],
      ["Package", "DIP-14"],
    ],
    "CD4066"
  ),
  r(
    "moc3021-optocoupler-pack-5",
    "MOC3021 Opto-Triac Driver (Pack of 5)",
    "Pack of 5",
    300,
    "Isolates logic from a triac gate.",
    "Build solid-state relays; keep mains wiring inside the enclosure.",
    [
      ["Isolation", "5000 V"],
      ["Package", "DIP-6"],
    ],
    "MOC3021"
  ),
  r(
    "4n25-optocoupler-pack-10",
    "4N25 Optocoupler (Pack of 10)",
    "Pack of 10",
    300,
    "Transistor-output optocoupler in a 6-pin DIP.",
    "Isolate noisy or higher-voltage inputs from the board.",
    [
      ["Isolation", "5000 V"],
      ["Package", "DIP-6"],
    ],
    "4N25 optocoupler"
  ),
  r(
    "triac-bta16-pack-3",
    "BTA16-600B Triac (Pack of 3)",
    "Pack of 3",
    450,
    "16 A, 600 V triac for heavier AC loads.",
    "Heaters and motors. Use an optoisolated driver; mains safety applies.",
    [
      ["Current", "16 A"],
      ["Voltage", "600 V"],
      ["Package", "TO-220"],
    ],
    "triac"
  ),
  r(
    "relay-srd-12vdc-pack-5",
    "SRD-12VDC Relay (Pack of 5)",
    "Pack of 5",
    400,
    "Bare 12 V relays, 10 A contacts.",
    "For 12 V systems — drive the coil through a transistor and flyback diode.",
    [
      ["Coil", "12 V"],
      ["Contacts", "10 A 250 V AC"],
    ],
    "relay"
  ),
  r(
    "eeprom-24c02-pack-5",
    "24C02 I²C EEPROM (Pack of 5)",
    "Pack of 5",
    250,
    "2 Kbit of persistent memory on two wires.",
    "Save settings and counters that survive power loss.",
    [
      ["Capacity", "2 Kbit"],
      ["Interface", "I²C"],
      ["Package", "DIP-8"],
    ],
    "EEPROM chip"
  ),
  r(
    "max232-rs232-pack-5",
    "MAX232 RS-232 Level Shifter (Pack of 5)",
    "Pack of 5",
    300,
    "Converts board UART levels to true RS-232.",
    "Talk to barcode scanners, PLCs and older equipment.",
    [
      ["Interface", "UART to RS-232"],
      ["Package", "DIP-16"],
    ],
    "MAX232"
  ),
  r(
    "uln2803a-driver-pack-3",
    "ULN2803A Darlington Array (Pack of 3)",
    "Pack of 3",
    300,
    "Eight 500 mA drivers in an 18-pin DIP.",
    "Drive eight relays, lamps or a unipolar stepper.",
    [
      ["Channels", "8"],
      ["Package", "DIP-18"],
    ],
    "ULN2803"
  ),
  r(
    "ds1307-rtc-ic-pack-5",
    "DS1307 Real-Time Clock IC (Pack of 5)",
    "Pack of 5",
    300,
    "The bare RTC chip behind the common modules.",
    "Battery-backed time over I²C with a 32.768 kHz crystal.",
    [
      ["Interface", "I²C"],
      ["Package", "DIP-8"],
    ],
    "DS1307"
  ),
  r(
    "tda2030-audio-amp-pack-3",
    "TDA2030 Audio Amplifier (Pack of 3)",
    "Pack of 3",
    450,
    "14 W class-AB amplifier in a five-pin package.",
    "Drive a small speaker from a board; bolt it to a heatsink.",
    [
      ["Power", "14 W"],
      ["Supply", "±6 – ±18 V"],
    ],
    "TDA2030 audio amplifier"
  )
)

push(
  "switches-connectors",
  r(
    "tactile-button-6x6-pack-20",
    "Tactile Push Button 6×6 mm (Pack of 20)",
    "Pack of 20",
    150,
    "Four-pin momentary buttons.",
    "Use INPUT_PULLUP and wire the other side to ground.",
    [
      ["Size", "6×6×5 mm"],
      ["Type", "Momentary NO"],
    ],
    "tactile switch"
  ),
  r(
    "tactile-button-12x12-pack-10",
    "Tactile Push Button 12×12 mm (Pack of 10)",
    "Pack of 10",
    200,
    "Large tactile buttons for panels.",
    "Easier to press on handheld builds.",
    [["Size", "12×12 mm"]],
    "tactile switch"
  ),
  r(
    "panel-pushbutton-16mm-pack-5",
    "16 mm Panel Push Button (Pack of 5)",
    "Pack of 5",
    300,
    "Metal momentary buttons for enclosures.",
    "Snap into a drilled panel.",
    [["Mount", "16 mm hole"]],
    "push button switch"
  ),
  r(
    "slide-switch-spdt-pack-10",
    "SPDT Slide Switch (Pack of 10)",
    "Pack of 10",
    200,
    "Mini slide switches for battery builds.",
    "Put one in the battery lead.",
    [["Rating", "0.5 A at 50 V DC"]],
    "slide switch"
  ),
  r(
    "toggle-switch-spdt-pack-5",
    "Mini Toggle Switch SPDT (Pack of 5)",
    "Pack of 5",
    250,
    "Panel-mount toggle switches.",
    "Mode selection and power on/off.",
    [["Rating", "3 A 250 V AC"]],
    "toggle switch"
  ),
  r(
    "rocker-switch-2pin-pack-5",
    "Rocker Switch 2-Pin (Pack of 5)",
    "Pack of 5",
    250,
    "Panel-mount rockers.",
    "Main power switch in an enclosure.",
    [["Rating", "6 A 250 V AC"]],
    "rocker switch"
  ),
  r(
    "dip-switch-8pos-pack-5",
    "8-Position DIP Switch (Pack of 5)",
    "Pack of 5",
    250,
    "Set binary addresses and options.",
    "Configuration switches on boards.",
    [["Positions", "8"]],
    "DIP switch"
  ),
  r(
    "limit-switch-micro-pack-5",
    "Micro Limit Switch with Lever (Pack of 5)",
    "Pack of 5",
    250,
    "End-stop switches for moving parts.",
    "CNC and printer end-stops, door sensors.",
    [["Rating", "5 A 250 V AC"]],
    "micro switch"
  ),
  r(
    "pin-header-male-pack-10",
    "Male Pin Header 40-Pin Strip (Pack of 10)",
    "Pack of 10",
    150,
    "Breakable 2.54 mm header strips.",
    "Snap off the length you need and solder to modules.",
    [
      ["Pitch", "2.54 mm"],
      ["Pins per strip", "40"],
    ],
    "pin header"
  ),
  r(
    "pin-header-female-pack-10",
    "Female Pin Header 40-Pin Strip (Pack of 10)",
    "Pack of 10",
    200,
    "Female socket strips.",
    "Make a plug-in socket on perfboard.",
    [
      ["Pitch", "2.54 mm"],
      ["Pins per strip", "40"],
    ],
    "female pin header"
  ),
  r(
    "pin-header-right-angle-pack-10",
    "Right-Angle Male Pin Header (Pack of 10)",
    "Pack of 10",
    200,
    "Side-mounted headers.",
    "Connect boards at 90°.",
    [
      ["Pitch", "2.54 mm"],
      ["Pins per strip", "40"],
    ],
    "pin header"
  ),
  r(
    "screw-terminal-2p-pack-10",
    "2-Pin Screw Terminal 5.08 mm (Pack of 10)",
    "Pack of 10",
    200,
    "PCB screw terminals.",
    "Secure supply and motor connections.",
    [
      ["Pitch", "5.08 mm"],
      ["Rating", "10 A"],
    ],
    "screw terminal block"
  ),
  r(
    "screw-terminal-3p-pack-10",
    "3-Pin Screw Terminal 5.08 mm (Pack of 10)",
    "Pack of 10",
    250,
    "Three-way PCB terminals.",
    "Relay and sensor connections.",
    [["Pitch", "5.08 mm"]],
    "screw terminal block"
  ),
  r(
    "dc-barrel-jack-pack-5",
    "DC Barrel Jack 5.5×2.1 mm (Pack of 5)",
    "Pack of 5",
    150,
    "Female barrel jacks.",
    "Add a power input to a build.",
    [["Size", "5.5×2.1 mm"]],
    "DC barrel jack"
  ),
  r(
    "dc-barrel-plug-screw-pack-5",
    "DC Barrel Plug with Screw Terminals (Pack of 5)",
    "Pack of 5",
    250,
    "Male 5.5×2.1 mm plug adapters.",
    "Connect a battery or supply to a barrel input.",
    [["Size", "5.5×2.1 mm"]],
    "DC power plug"
  ),
  r(
    "ic-socket-kit-20",
    "DIP IC Socket Kit (20 pcs)",
    "Kit",
    250,
    "Assorted DIP-8/14/16/28 sockets.",
    "Solder the socket, not the chip.",
    [["Contents", "DIP-8/14/16/28", 20]],
    "DIP IC socket"
  ),
  r(
    "jst-xh-connector-kit",
    "JST-XH 2.54 mm Connector Kit (230 pcs)",
    "Kit",
    900,
    "Keyed connectors with headers and housings.",
    "Tidy, polarised plug-in wiring for sensors and batteries.",
    [["Contents", "2–5 pin, 230 pcs", 230]],
    "JST connector"
  ),
  r(
    "alligator-clip-leads-pack-10",
    "Alligator Clip Test Leads (Pack of 10)",
    "Pack of 10",
    300,
    "Insulated clip leads for temporary connections.",
    "Handy for testing and demos.",
    [["Length", "≈ 30 cm"]],
    "crocodile clip"
  ),
  r(
    "usb-micro-breakout-pack-3",
    "Micro-USB Breakout Board (Pack of 3)",
    "Pack of 3",
    200,
    "Bring USB power to a breadboard.",
    "Power a project from a phone charger.",
    [["Connector", "Micro-USB"]],
    "micro USB breakout"
  ),

  /* ---- Batch E: switches and connectors ---- */
  r(
    "tactile-button-cap-pack-20",
    "Tactile Button Caps (Pack of 20)",
    "Pack of 20",
    150,
    "Colour caps that fit 6×6 mm and 12×12 mm tactiles.",
    "Labels and colour coding on button panels.",
    [["Fits", "6×6 / 12×12 mm"]],
    "button cap"
  ),
  r(
    "panel-pushbutton-12mm-illuminated-pack-5",
    "12 mm Illuminated Panel Push Button (Pack of 5)",
    "Pack of 5",
    400,
    "Momentary button with an indicator lamp.",
    "Shows run/fault state on a panel.",
    [
      ["Mount", "12 mm hole"],
      ["Rating", "3 A 250 V AC"],
    ],
    "illuminated push button"
  ),
  r(
    "emergency-stop-button-22mm",
    "Emergency Stop Button 22 mm",
    "Each",
    550,
    "Mushroom-head stop button.",
    "Cuts the control circuit of a machine until twisted to release.",
    [
      ["Mount", "22 mm hole"],
      ["Type", "1 NC contact"],
    ],
    "emergency stop button"
  ),
  r(
    "keyed-panel-switch-pack-3",
    "Keyed Panel Switch (Pack of 3)",
    "Pack of 3",
    450,
    "Key-operated panel switches.",
    "Locks a machine or meter behind a key.",
    [
      ["Mount", "16 mm hole"],
      ["Rating", "5 A 250 V AC"],
    ],
    "key switch"
  ),
  r(
    "rocker-switch-illuminated-pack-5",
    "Illuminated Rocker Switch (Pack of 5)",
    "Pack of 5",
    400,
    "Rocker switch with an indicator lamp.",
    "Power switches that show they are live.",
    [
      ["Rating", "6 A 250 V AC"],
      ["Terminals", "4"],
    ],
    "illuminated rocker switch"
  ),
  r(
    "toggle-switch-dpdt-pack-5",
    "Mini Toggle Switch DPDT (Pack of 5)",
    "Pack of 5",
    350,
    "Two-pole panel toggles.",
    "Switch two circuits at once or reverse a motor.",
    [["Rating", "6 A 250 V AC"]],
    "toggle switch"
  ),
  r(
    "dip-switch-4pos-pack-5",
    "4-Position DIP Switch (Pack of 5)",
    "Pack of 5",
    200,
    "Small binary config switches.",
    "Address bits on a board.",
    [["Positions", "4"]],
    "DIP switch"
  ),
  r(
    "slide-switch-dpdt-pack-10",
    "DPDT Slide Switch (Pack of 10)",
    "Pack of 10",
    250,
    "Two-pole mini slide switches.",
    "Mode and direction selection in small builds.",
    [["Rating", "0.5 A at 50 V DC"]],
    "slide switch"
  ),
  r(
    "panel-pushbutton-22mm-pack-5",
    "22 mm Panel Push Button (Pack of 5)",
    "Pack of 5",
    400,
    "Big metal panel buttons.",
    "Glove-friendly controls on machine fronts.",
    [
      ["Mount", "22 mm hole"],
      ["Type", "Momentary NO"],
    ],
    "push button switch"
  ),
  r(
    "cord-switch-inline-pack-2",
    "Inline Cord Switch (Pack of 2)",
    "Pack of 2",
    250,
    "Switches that fit in a lamp cord.",
    "Fit in the live lead of a desk-lamp cable; unplug before wiring.",
    [["Rating", "2 A 250 V AC"]],
    "cord switch"
  ),
  r(
    "jumper-cap-shunts-pack-50",
    "Jumper Cap Shunts (Pack of 50)",
    "Pack of 50",
    150,
    "Shorting caps for 2.54 mm headers.",
    "Set addresses, modes and clock dividers.",
    [["Pitch", "2.54 mm"]],
    "jumper shunt"
  ),
  r(
    "screw-terminal-4p-pack-10",
    "4-Pin Screw Terminal 5.08 mm (Pack of 10)",
    "Pack of 10",
    300,
    "Four-way PCB terminals.",
    "Relay boards and power distribution.",
    [["Pitch", "5.08 mm"]],
    "screw terminal block"
  ),
  r(
    "screw-terminal-5p-pack-10",
    "5-Pin Screw Terminal 5.08 mm (Pack of 10)",
    "Pack of 10",
    350,
    "Five-way PCB terminals.",
    "Motor drivers and sensor harnesses.",
    [["Pitch", "5.08 mm"]],
    "screw terminal block"
  ),
  r(
    "banana-plug-pack-5",
    "4 mm Banana Plug (Pack of 5)",
    "Pack of 5",
    300,
    "Screw-type plugs for test leads.",
    "Build your own patch leads.",
    [
      ["Diameter", "4 mm"],
      ["Type", "Solder / screw"],
    ],
    "banana plug"
  ),
  r(
    "banana-binding-post-pack-5",
    "4 mm Banana Binding Post (Pack of 5)",
    "Pack of 5",
    350,
    "Panel posts for bench supplies.",
    "Bring 5 V and GND out through an enclosure wall.",
    [
      ["Diameter", "4 mm"],
      ["Mount", "8 mm hole"],
    ],
    "banana binding post"
  ),
  r(
    "ring-terminal-kit-100",
    "Ring Terminal Kit (100 pcs)",
    "Kit",
    350,
    "Assorted crimp ring terminals.",
    "Terminate wires for battery and chassis screws.",
    [["Contents", "6–16 AWG", 100]],
    "ring terminal"
  ),
  r(
    "butt-splice-pack-100",
    "Insulated Butt Splice Connectors (Pack of 100)",
    "Pack of 100",
    300,
    "Solder or crimp inline joins.",
    "Repair a cut wire with a sealed joint.",
    [["Range", "0.5–6 mm²"]],
    "butt splice connector"
  ),
  r(
    "spade-disconnect-pack-50",
    "Female Spade Disconnects (Pack of 50)",
    "Pack of 50",
    300,
    "Fast-on crimp terminals.",
    "Quick-release wiring on switches and relays.",
    [["Tab size", "6.3 mm"]],
    "spade connector"
  ),
  r(
    "xt60-connector-pair-pack-2",
    "XT60 Connector Pair (Pack of 2)",
    "Pack of 2",
    400,
    "Yellow battery connectors, male and female.",
    "Main leads on LiPo and Li-ion packs.",
    [["Current", "30 A"]],
    "XT60 connector"
  ),
  r(
    "dc-barrel-jack-panel-pack-5",
    "Panel-Mount DC Barrel Jack (Pack of 5)",
    "Pack of 5",
    300,
    "Threaded 5.5×2.1 mm jacks.",
    "Power input through an enclosure wall.",
    [
      ["Size", "5.5×2.1 mm"],
      ["Mount", "12 mm hole"],
    ],
    "panel mount DC jack"
  ),
  r(
    "usb-c-breakout-pack-3",
    "USB-C Breakout Board (Pack of 3)",
    "Pack of 3",
    350,
    "Bring USB-C power to a breadboard.",
    "Modern phone-charger input for builds.",
    [["Connector", "USB-C"]],
    "USB C breakout"
  ),
  r(
    "usb-a-panel-mount-pack-5",
    "Panel-Mount USB-A Socket (Pack of 5)",
    "Pack of 5",
    350,
    "A-type sockets with leads.",
    "Bring a 5 V port out of a box.",
    [
      ["Connector", "USB-A"],
      ["Leads", "4-wire"],
    ],
    "USB panel mount"
  ),
  r(
    "audio-jack-3-5-panel-pack-5",
    "3.5 mm Panel Audio Jack (Pack of 5)",
    "Pack of 5",
    300,
    "Panel sockets for headphone plugs.",
    "Audio outputs and signal patch points.",
    [
      ["Size", "3.5 mm"],
      ["Poles", "3 (TRS)"],
    ],
    "3.5mm audio jack"
  ),
  r(
    "spring-terminal-5mm-pack-10",
    "Push Spring Terminal 5 mm (Pack of 10)",
    "Pack of 10",
    350,
    "Tool-free push-in terminals.",
    "Stranded wire, no screwdriver needed.",
    [
      ["Pitch", "5 mm"],
      ["Wire", "0.2–1.5 mm²"],
    ],
    "spring terminal block"
  ),
  r(
    "wire-ferrules-pack-100",
    "Bootlace Wire Ferrules (Pack of 100)",
    "Pack of 100",
    350,
    "Assorted crimp ferrules.",
    "Neat, solid ends for screw terminals.",
    [["Range", "0.5–2.5 mm²", 100]],
    "wire ferrule"
  ),
  r(
    "cable-lug-pack-20",
    "Battery Cable Lugs M6 (Pack of 20)",
    "Pack of 20",
    350,
    "Ring lugs for battery posts and studs.",
    "Crimp onto thick supply leads.",
    [
      ["Stud", "M6"],
      ["Range", "6–10 mm²"],
    ],
    "battery cable lug"
  ),
  r(
    "screw-terminal-6p-pack-10",
    "6-Pin Screw Terminal 5.08 mm (Pack of 10)",
    "Pack of 10",
    400,
    "Six-way PCB terminals.",
    "Multi-channel driver boards.",
    [["Pitch", "5.08 mm"]],
    "screw terminal block"
  ),
  r(
    "toggle-switch-dpdt-on-off-on-pack-5",
    "DPDT Toggle Switch On-Off-On (Pack of 5)",
    "Pack of 5",
    400,
    "Three-position toggles with centre off.",
    "Manual/auto selection with a safe middle stop.",
    [
      ["Rating", "6 A 250 V AC"],
      ["Positions", "On-Off-On"],
    ],
    "toggle switch"
  ),
  r(
    "panel-pushbutton-16mm-latching-pack-5",
    "16 mm Latching Panel Push Button (Pack of 5)",
    "Pack of 5",
    350,
    "Push-on, push-off metal buttons.",
    "Mains-style power latching without a rocker.",
    [
      ["Mount", "16 mm hole"],
      ["Type", "Latching NO"],
    ],
    "push button switch"
  ),
  r(
    "audio-jack-3-5-plug-pack-10",
    "3.5 mm Audio Plug (Pack of 10)",
    "Pack of 10",
    300,
    "TRS plugs for custom leads.",
    "Patch and headphone wiring.",
    [
      ["Size", "3.5 mm"],
      ["Poles", "3 (TRS)"],
    ],
    "3.5mm audio plug"
  ),
  r(
    "iec-c14-power-inlet",
    "IEC C14 Power Inlet (Panel Mount)",
    "Each",
    500,
    "Mains kettle-lead inlet for enclosures.",
    "Mains on the input side — have the final wiring checked.",
    [["Rating", "10 A 250 V AC"]],
    "IEC power inlet"
  )
)

push(
  "sensors",
  r(
    "hc-sr04-ultrasonic-sensor",
    "HC-SR04 Ultrasonic Sensor",
    "Each",
    200,
    "Distance sensor from 2 cm to 400 cm.",
    "A common first sensor for obstacle detection and level measurement. Runs on 5 V.",
    [
      ["Range", "2 cm – 400 cm"],
      ["Voltage", "5 V"],
    ],
    "HC-SR04"
  ),
  r(
    "jsn-sr04t-waterproof-ultrasonic",
    "JSN-SR04T Waterproof Ultrasonic Sensor",
    "Each",
    800,
    "Weatherproof probe for tanks and outdoors.",
    "Measure water level without touching the liquid.",
    [
      ["Range", "25 cm – 450 cm"],
      ["Voltage", "5 V"],
    ],
    "waterproof ultrasonic sensor"
  ),
  r(
    "vl53l0x-tof-sensor",
    "VL53L0X Time-of-Flight Distance Sensor",
    "Each",
    900,
    "Laser distance sensor up to 2 m over I2C.",
    "More precise than ultrasonic at short range.",
    [
      ["Range", "up to 2 m"],
      ["Interface", "I2C"],
    ],
    "VL53L0X"
  ),
  r(
    "dht11-temp-humidity-sensor",
    "DHT11 Temperature & Humidity Sensor",
    "Each",
    150,
    "Digital temperature and humidity.",
    "Single-wire wiring for weather stations.",
    [
      ["Temperature", "0 – 50 °C"],
      ["Humidity", "20 – 80 %RH"],
    ],
    "DHT11"
  ),
  r(
    "dht22-temp-humidity-sensor",
    "DHT22 (AM2302) Temperature & Humidity Sensor",
    "Each",
    600,
    "Accurate, wide-range DHT upgrade.",
    "±0.5 °C accuracy for greenhouse and weather builds.",
    [
      ["Temperature", "−40 – 80 °C"],
      ["Humidity", "0 – 100 %RH"],
    ],
    "DHT22"
  ),
  r(
    "ds18b20-waterproof-probe",
    "DS18B20 Waterproof Temperature Probe",
    "Each",
    400,
    "Stainless 1-Wire probe for liquids and soil.",
    "Several probes share one pin; add a 4.7 kΩ pull-up.",
    [
      ["Range", "−55 – 125 °C"],
      ["Interface", "1-Wire"],
    ],
    "DS18B20"
  ),
  r(
    "bme280-sensor",
    "BME280 Temperature, Humidity & Pressure Sensor",
    "Each",
    800,
    "Three environmental readings over I2C.",
    "A compact all-in-one weather sensor.",
    [
      ["Interface", "I2C / SPI"],
      ["Voltage", "3.3 V"],
    ],
    "BME280"
  ),
  r(
    "bmp280-pressure-sensor",
    "BMP280 Pressure & Temperature Sensor",
    "Each",
    450,
    "Barometric pressure and altitude over I2C.",
    "Weather stations and altitude logging.",
    [
      ["Range", "300 – 1100 hPa"],
      ["Voltage", "3.3 V"],
    ],
    "BMP280"
  ),
  r(
    "max6675-thermocouple-kit",
    "MAX6675 K-Type Thermocouple Module",
    "Kit",
    900,
    "High-temperature sensing up to 1024 °C.",
    "Ovens, kilns and furnaces. Includes a K-type probe.",
    [
      ["Range", "0 – 1024 °C"],
      ["Interface", "SPI"],
    ],
    "thermocouple"
  ),
  r(
    "pir-motion-sensor",
    "HC-SR501 PIR Motion Sensor",
    "Each",
    250,
    "Detects movement within about 7 m.",
    "Tunable sensitivity and hold time.",
    [
      ["Range", "Up to 7 m"],
      ["Angle", "≈ 110°"],
    ],
    "HC-SR501 PIR sensor"
  ),
  r(
    "capacitive-soil-moisture-sensor",
    "Capacitive Soil Moisture Sensor",
    "Each",
    300,
    "Corrosion-resistant soil probe.",
    "Outputs an analog voltage; lasts longer than resistive probes.",
    [
      ["Output", "Analog"],
      ["Voltage", "3.3 – 5 V"],
    ],
    "soil moisture sensor"
  ),
  r(
    "ldr-light-sensor-module",
    "LDR Light Sensor Module",
    "Each",
    200,
    "LDR with comparator and threshold dial.",
    "Dusk-to-dawn switches and light trackers.",
    [["Outputs", "Analog + digital"]],
    "photoresistor module"
  ),
  r(
    "mq2-gas-sensor-module",
    "MQ-2 Gas & Smoke Sensor Module",
    "Each",
    450,
    "Detects LPG, smoke, methane and hydrogen.",
    "Needs a few minutes' warm-up.",
    [
      ["Detects", "LPG, smoke, CH₄, H₂"],
      ["Voltage", "5 V"],
    ],
    "MQ-2 gas sensor"
  ),
  r(
    "mq135-air-quality-sensor",
    "MQ-135 Air Quality Sensor Module",
    "Each",
    450,
    "Detects ammonia, benzene and CO₂-type pollutants.",
    "Indoor air-quality monitors.",
    [
      ["Outputs", "Analog + digital"],
      ["Voltage", "5 V"],
    ],
    "MQ-135 gas sensor"
  ),
  r(
    "mq7-co-sensor",
    "MQ-7 Carbon Monoxide Sensor Module",
    "Each",
    450,
    "Detects carbon monoxide.",
    "Garage and generator-room alarms.",
    [
      ["Outputs", "Analog + digital"],
      ["Voltage", "5 V"],
    ],
    "MQ-7 gas sensor"
  ),
  r(
    "flame-sensor-module",
    "IR Flame Sensor Module",
    "Each",
    200,
    "Detects flame light.",
    "Fire alarms and fire-fighting robots.",
    [
      ["Angle", "≈ 60°"],
      ["Voltage", "3.3 – 5 V"],
    ],
    "flame sensor module"
  ),
  r(
    "sound-sensor-module",
    "Sound Detection Sensor Module",
    "Each",
    200,
    "Microphone module for claps and noise triggers.",
    "Clap switches and noise alarms.",
    [["Outputs", "Analog + digital"]],
    "microphone sensor module"
  ),
  r(
    "ir-obstacle-sensor-fc51",
    "FC-51 IR Obstacle Avoidance Sensor",
    "Each",
    200,
    "Short-range infrared obstacle detector.",
    "Cheap bumper-free obstacle detection.",
    [
      ["Range", "2 – 30 cm"],
      ["Output", "Digital"],
    ],
    "infrared obstacle sensor"
  ),
  r(
    "tcrt5000-line-tracker-module",
    "TCRT5000 Line Tracking Sensor",
    "Each",
    200,
    "Reflective IR sensor for line followers.",
    "Tells black line from white floor.",
    [["Range", "1 – 25 mm"]],
    "TCRT5000"
  ),
  r(
    "mpu6050-imu-module",
    "MPU6050 Accelerometer & Gyro Module",
    "Each",
    500,
    "6-axis motion sensor over I2C.",
    "Self-balancing robots and tilt measurement.",
    [
      ["Axes", "3 accel + 3 gyro"],
      ["Interface", "I2C"],
    ],
    "MPU-6050"
  ),
  r(
    "adxl345-accelerometer",
    "ADXL345 3-Axis Accelerometer",
    "Each",
    600,
    "Digital accelerometer over I2C/SPI.",
    "Tilt, vibration and tap detection.",
    [
      ["Range", "±16 g"],
      ["Interface", "I2C / SPI"],
    ],
    "ADXL345"
  ),
  r(
    "qmc5883l-compass",
    "QMC5883L Magnetometer Compass Module",
    "Each",
    500,
    "3-axis compass over I2C.",
    "Heading for robots and navigation.",
    [["Interface", "I2C"]],
    "magnetometer"
  ),
  r(
    "rain-sensor-module",
    "Rain Detection Sensor Module",
    "Each",
    250,
    "Raindrop sensing plate.",
    "Weather stations and auto window closers.",
    [["Outputs", "Analog + digital"]],
    "rain sensor module"
  ),
  r(
    "water-level-sensor-module",
    "Water Level Sensor Module",
    "Each",
    200,
    "Analog probe that senses water depth.",
    "Not for continuous submersion.",
    [["Output", "Analog"]],
    "water level sensor"
  ),
  r(
    "yf-s201-water-flow-sensor",
    "YF-S201 Water Flow Sensor",
    "Each",
    700,
    "Hall-effect flow meter for 1–30 L/min.",
    "Measure water usage and dispensing volumes.",
    [
      ["Range", "1 – 30 L/min"],
      ["Voltage", "5 – 18 V"],
    ],
    "water flow sensor"
  ),
  r(
    "acs712-current-sensor-5a",
    "ACS712 5 A Current Sensor Module",
    "Each",
    500,
    "Hall-effect current sensor.",
    "Power monitors and overload alarms.",
    [
      ["Range", "±5 A"],
      ["Output", "185 mV/A"],
    ],
    "ACS712"
  ),
  r(
    "zmpt101b-voltage-sensor",
    "ZMPT101B AC Voltage Sensor Module",
    "Each",
    700,
    "Measure mains voltage safely through a transformer.",
    "Energy-monitor projects; mains safety applies.",
    [["Output", "Analog"]],
    "voltage sensor module"
  ),
  r(
    "hx711-load-cell-5kg-kit",
    "HX711 + 5 kg Load Cell Kit",
    "Kit",
    700,
    "Digital scale kit.",
    "Build a kitchen scale or weighing station.",
    [
      ["Capacity", "5 kg"],
      ["Includes", "Load cell + HX711"],
    ],
    "load cell"
  ),
  r(
    "ttp223-touch-sensor-pack-3",
    "TTP223 Capacitive Touch Sensor (Pack of 3)",
    "Pack of 3",
    250,
    "Touch buttons with no moving parts.",
    "Replace mechanical buttons.",
    [["Voltage", "2 – 5.5 V"]],
    "touch sensor"
  ),
  r(
    "a3144-hall-sensor-pack-5",
    "A3144 Hall Effect Sensor (Pack of 5)",
    "Pack of 5",
    200,
    "Detects a magnet's presence.",
    "Speed counters and door sensors.",
    [["Type", "Digital Hall switch"]],
    "Hall effect sensor"
  ),
  r(
    "reed-switch-pack-10",
    "Glass Reed Switch (Pack of 10)",
    "Pack of 10",
    200,
    "Magnet-activated switches.",
    "Door and window alarms.",
    [["Type", "Normally open"]],
    "reed switch"
  ),
  r(
    "sw420-vibration-sensor-pack-3",
    "SW-420 Vibration Sensor (Pack of 3)",
    "Pack of 3",
    250,
    "Detects shocks and vibration.",
    "Anti-theft and machine monitoring.",
    [["Outputs", "Digital"]],
    "vibration sensor"
  ),
  r(
    "tcs3200-colour-sensor",
    "TCS3200 Colour Sensor Module",
    "Each",
    700,
    "Detects RGB colour.",
    "Sorting machines and colour matching.",
    [
      ["Output", "Frequency"],
      ["Voltage", "2.7 – 5.5 V"],
    ],
    "colour sensor"
  ),
  r(
    "max30102-pulse-oximeter",
    "MAX30102 Pulse & SpO₂ Sensor Module",
    "Each",
    900,
    "Heart-rate and SpO₂ sensing over I2C.",
    "For fitness and demonstration projects, not medical use.",
    [["Interface", "I2C"]],
    "MAX30102"
  )
)

/* ---- Batch C: sensors ---- */
push(
  "sensors",
  r(
    "vl53l1x-tof-sensor",
    "VL53L1X Time-of-Flight Distance Sensor",
    "Each",
    1100,
    "Laser distance sensing up to 4 m over I2C.",
    "The long-range upgrade when the VL53L0X runs out of reach.",
    [
      ["Range", "up to 4 m"],
      ["Interface", "I2C"],
    ],
    "time-of-flight sensor"
  ),
  r(
    "rcwl-0516-microwave-motion",
    "RCWL-0516 Microwave Motion Sensor",
    "Each",
    300,
    "Radar motion detector that sees through thin walls.",
    "Detects movement through plastic, wood and glass — unlike PIR.",
    [
      ["Supply", "4.5 – 24 V"],
      ["Output", "Digital"],
    ],
    "microwave motion sensor"
  ),
  r(
    "inductive-proximity-m12",
    "M12 Inductive Proximity Sensor (NPN NO)",
    "Each",
    650,
    "Detects metal objects without contact.",
    "End-stops and position sensing on machines; metal targets only.",
    [
      ["Sensing distance", "4 mm"],
      ["Output", "NPN NO"],
      ["Supply", "6 – 36 V DC"],
    ],
    "proximity sensor"
  ),
  r(
    "capacitive-proximity-m18",
    "M18 Capacitive Proximity Sensor (NPN NO)",
    "Each",
    750,
    "Detects solids and liquids through a container wall.",
    "Level detection in plastic tanks; sensitivity trimmer on the body.",
    [
      ["Sensing distance", "8 mm"],
      ["Output", "NPN NO"],
      ["Supply", "6 – 36 V DC"],
    ],
    "proximity sensor"
  ),
  r(
    "sharp-gp2y0a21-ir-distance",
    "Sharp GP2Y0A21 Distance Sensor",
    "Each",
    950,
    "Analog IR distance sensor, 10 – 80 cm.",
    "Obstacle ranging that is less sensitive to surface colour than ultrasonic.",
    [
      ["Range", "10 – 80 cm"],
      ["Output", "Analog"],
      ["Supply", "4.5 – 5.5 V"],
    ],
    "infrared distance sensor"
  ),
  r(
    "lm35-temp-sensor-pack-5",
    "LM35 Analog Temperature Sensor (Pack of 5)",
    "Pack of 5",
    350,
    "10 mV/°C output with no calibration needed.",
    "Read temperature straight on an analog pin of any board.",
    [
      ["Output", "10 mV/°C"],
      ["Range", "−55 – 150 °C"],
    ],
    "LM35 temperature sensor"
  ),
  r(
    "ds18b20-to92-pack-5",
    "DS18B20 Temperature Sensor TO-92 (Pack of 5)",
    "Pack of 5",
    400,
    "Bare 1-Wire temperature chips in a transistor package.",
    "The probe sensor without the stainless sheath — build your own.",
    [
      ["Range", "−55 – 125 °C"],
      ["Interface", "1-Wire"],
    ],
    "DS18B20"
  ),
  r(
    "mpu9250-imu-module",
    "MPU9250 9-Axis IMU Module",
    "Each",
    1500,
    "Accelerometer, gyroscope and compass on one chip.",
    "Heading and motion tracking for drones and robots.",
    [
      ["Axes", "3 accel + 3 gyro + 3 mag"],
      ["Interface", "I2C / SPI"],
    ],
    "inertial measurement unit"
  ),
  r(
    "bh1750-light-sensor",
    "BH1750 Light Sensor Module (GY-302)",
    "Each",
    450,
    "Digital lux reading over I2C.",
    "Auto-brightness, greenhouse logging and weather stations.",
    [
      ["Range", "1 – 65535 lx"],
      ["Interface", "I2C"],
    ],
    "light sensor module"
  ),
  r(
    "uv-sensor-guva-s12sd",
    "GUVA-S12SD UV Sensor Module",
    "Each",
    500,
    "Ultraviolet sensing across UV-A and UV-B.",
    "Sun-exposure logging and UV-index demonstrations.",
    [
      ["Band", "UV-A + UV-B"],
      ["Output", "Analog"],
    ],
    "UV sensor"
  ),
  r(
    "max9814-mic-amp",
    "MAX9814 Microphone Amplifier with AGC",
    "Each",
    400,
    "Electret microphone preamp that keeps levels even.",
    "Sound-level and voice capture without clipping.",
    [
      ["Gain", "40 / 50 / 60 dB"],
      ["Supply", "2.7 – 5.5 V"],
    ],
    "microphone amplifier module"
  ),
  r(
    "inmp441-i2s-mic",
    "INMP441 I2S Digital Microphone",
    "Each",
    500,
    "Digital MEMS microphone on the I2S bus.",
    "Clean audio for ESP32 voice and sound-level projects.",
    [
      ["Interface", "I2S"],
      ["Supply", "1.8 – 3.3 V"],
    ],
    "MEMS microphone"
  ),
  r(
    "float-switch-vertical",
    "Vertical Float Switch (10 A)",
    "Each",
    300,
    "Magnetic float switch for tanks.",
    "Switch a pump or alarm at a set water level.",
    [
      ["Contact", "SPST, 10 A"],
      ["Style", "Vertical stem"],
    ],
    "float switch"
  ),
  r(
    "yf-n20-water-flow-sensor",
    "YF-N20 Water Flow Sensor (½ inch)",
    "Each",
    550,
    "Hall-effect flow meter for small pipes.",
    "Dispensers and irrigation volumes; pair with the YF-S201 for larger lines.",
    [
      ["Range", "1 – 30 L/min"],
      ["Voltage", "5 – 12 V"],
    ],
    "water flow sensor"
  ),
  r(
    "mhz19b-co2-sensor",
    "MH-Z19B CO₂ Sensor",
    "Each",
    2400,
    "NDIR carbon dioxide sensor with UART and PWM output.",
    "Indoor air-quality logging. Not a life-safety detector.",
    [
      ["Range", "400 – 5000 ppm"],
      ["Interface", "UART / PWM"],
    ],
    "carbon dioxide sensor"
  ),
  r(
    "ina219-current-sensor",
    "INA219 Current Sensor Module",
    "Each",
    550,
    "High-side current and voltage sensing over I2C.",
    "Measure supply current up to 3.2 A without cutting the wire.",
    [
      ["Range", "±3.2 A"],
      ["Interface", "I2C"],
    ],
    "current sensor module"
  ),
  r(
    "acs712-30a-current-sensor",
    "ACS712 30 A Current Sensor Module",
    "Each",
    600,
    "Hall-effect current sensor for larger loads.",
    "Motor and heater current monitoring with an analog input.",
    [
      ["Range", "±30 A"],
      ["Output", "66 mV/A"],
    ],
    "current sensor module"
  ),
  r(
    "sct013-100a-current-clamp",
    "SCT-013-000 Non-Invasive Current Clamp (100 A)",
    "Each",
    700,
    "Clip-on current transformer with a safe voltage output.",
    "Energy monitoring without cutting wires — clamp around ONE conductor only, never live and neutral together.",
    [
      ["Range", "0 – 100 A"],
      ["Output", "1 V at 100 A"],
    ],
    "current transformer"
  ),
  r(
    "photo-interrupter-sensor",
    "Slot Photoelectric Sensor (Photo-Interrupter)",
    "Each",
    200,
    "Through-beam slot sensor for discs and shutters.",
    "Count encoder wheels, detect paper feed and end positions.",
    [
      ["Type", "Through-beam"],
      ["Output", "Phototransistor"],
    ],
    "photo interrupter"
  ),
  r(
    "flex-sensor-2-2inch",
    "Flex Sensor 2.2 inch",
    "Each",
    600,
    "Resistance changes as the strip bends.",
    "Glove controls, bend measurement and robotic joints.",
    [
      ["Length", "2.2 in"],
      ["Type", "Analog"],
    ],
    "flex sensor"
  ),
  r(
    "force-sensitive-resistor-pack-3",
    "Force Sensitive Resistor (Pack of 3)",
    "Pack of 3",
    650,
    "Thin-film sensors that measure push force.",
    "Pressure pads, grip sensing and touch buttons.",
    [
      ["Diameter", "0.5 in"],
      ["Type", "Analog"],
    ],
    "force sensitive resistor"
  ),
  r(
    "am312-pir-sensor",
    "AM312 Mini PIR Motion Sensor",
    "Each",
    350,
    "Tiny digital PIR that draws almost no current.",
    "Battery-powered motion triggers.",
    [
      ["Supply", "2.7 – 12 V"],
      ["Output", "Digital"],
    ],
    "PIR sensor"
  ),
  r(
    "ss49e-hall-sensor",
    "SS49E Linear Hall Effect Sensor",
    "Each",
    200,
    "Analog voltage that follows magnetic field strength.",
    "Position, current and speed sensing with a magnet.",
    [
      ["Output", "Analog"],
      ["Type", "Linear Hall effect"],
    ],
    "Hall effect sensor"
  ),
  r(
    "load-cell-50kg",
    "50 kg Load Cell Bar",
    "Each",
    400,
    "Strain-gauge bar for scales.",
    "Pair with the HX711 module for bench and floor scales.",
    [
      ["Capacity", "50 kg"],
      ["Interface", "Strain gauge (with HX711)"],
    ],
    "load cell"
  ),
  r(
    "bno055-orientation-sensor",
    "BNO055 9-Axis Absolute Orientation Sensor",
    "Each",
    2200,
    "Fused accelerometer, gyro and compass with onboard processing.",
    "Read roll, pitch and yaw directly — no sensor-fusion code needed.",
    [
      ["Axes", "9"],
      ["Interface", "I2C"],
    ],
    "inertial measurement unit"
  ),
  r(
    "hmc5883l-compass",
    "HMC5883L Magnetometer Compass",
    "Each",
    450,
    "3-axis compass over I2C.",
    "Heading for drones, rovers and map projects.",
    [
      ["Interface", "I2C"],
      ["Axes", "3"],
    ],
    "magnetometer"
  ),
  r(
    "us-100-ultrasonic-sensor",
    "US-100 Ultrasonic Sensor",
    "Each",
    350,
    "HC-SR04-style ranging with an onboard temperature reading.",
    "Distance with serial output and temperature compensation.",
    [
      ["Range", "2 – 400 cm"],
      ["Interface", "UART / trigger-echo"],
    ],
    "ultrasonic sensor"
  ),
  r(
    "sht31-humidity-sensor",
    "SHT31 Temperature & Humidity Sensor",
    "Each",
    800,
    "Accurate digital humidity over I2C.",
    "More stable than DHT sensors for greenhouse and cold-chain logging.",
    [
      ["Accuracy", "±2 %RH"],
      ["Interface", "I2C"],
    ],
    "humidity sensor"
  ),
  r(
    "mq3-alcohol-sensor",
    "MQ-3 Alcohol Sensor Module",
    "Each",
    450,
    "Detects alcohol vapour in the air.",
    "Breathalyser demonstrations — not calibrated for enforcement.",
    [
      ["Detects", "Alcohol vapour"],
      ["Supply", "5 V"],
    ],
    "gas sensor"
  ),
  r(
    "piezo-element-27mm-pack-5",
    "Piezo Element 27 mm (Pack of 5)",
    "Pack of 5",
    250,
    "Brass piezo discs with soldered leads.",
    "Knock sensing, simple tones and vibration projects.",
    [
      ["Diameter", "27 mm"],
      ["Type", "Passive disc"],
    ],
    "piezoelectric disc"
  ),
  r(
    "mlx90614-ir-temp-sensor",
    "MLX90614 Infrared Temperature Sensor",
    "Each",
    1700,
    "Non-contact object temperature over I2C.",
    "Measure surface temperature at a distance; not a medical thermometer.",
    [
      ["Object range", "−70 – 380 °C"],
      ["Interface", "I2C"],
    ],
    "infrared thermometer sensor"
  ),
  r(
    "k-type-thermocouple-probe",
    "K-Type Thermocouple Probe (1 m)",
    "Each",
    350,
    "Bare K-type probe for MAX6675 modules.",
    "Oven, grill and liquid temperatures with the module you already have.",
    [
      ["Type", "K-type"],
      ["Length", "1 m"],
    ],
    "thermocouple"
  ),
  r(
    "pzem-004t-energy-meter",
    "PZEM-004T V3.0 AC Energy Meter",
    "Each",
    1800,
    "Measures AC voltage, current, power and energy over UART.",
    "Appliance energy monitoring. Mains wiring must stay inside an enclosure.",
    [
      ["Measure", "AC V, A, W, kWh"],
      ["Interface", "UART (TTL)"],
    ],
    "electricity meter"
  ),
  r(
    "ph-meter-sensor-kit",
    "Analog pH Meter Sensor Kit",
    "Each",
    2200,
    "pH probe with an amplifier board for liquids.",
    "Hydroponics and water testing; calibrate with buffer solutions and rinse the probe after use.",
    [
      ["Range", "0 – 14 pH"],
      ["Output", "Analog"],
    ],
    "pH meter"
  ),
  r(
    "ld2410-radar-sensor",
    "LD2410 Human Presence Radar Sensor",
    "Each",
    950,
    "24 GHz mmWave sensor that detects people who are sitting still.",
    "Know when a room is occupied even without motion; configurable over UART.",
    [
      ["Band", "24 GHz"],
      ["Interface", "UART"],
    ],
    "motion sensor"
  ),
  r(
    "soil-moisture-resistive-kit",
    "Soil Moisture Sensor Kit — Resistive (YL-69)",
    "Each",
    250,
    "Two-probe resistive moisture sensor with a comparator.",
    "Cheap and immediate; probes corrode over time — the capacitive version lasts longer.",
    [
      ["Output", "Analog + digital"],
      ["Voltage", "3.3 – 5 V"],
    ],
    "soil moisture sensor"
  ),
  r(
    "amg8833-thermal-array",
    "AMG8833 8×8 Thermal Sensor (Grid-EYE)",
    "Each",
    2600,
    "8×8 infrared array for a low-resolution thermal image.",
    "Heat maps and presence detection without a lens.",
    [
      ["Resolution", "8 × 8"],
      ["Interface", "I2C"],
    ],
    "infrared sensor"
  ),
  r(
    "water-pressure-transducer",
    "Water Pressure Transducer Sensor",
    "Each",
    800,
    "Measures liquid pressure inside a pipe.",
    "Pump and irrigation monitoring with an analog input.",
    [
      ["Range", "0 – 1.0 MPa"],
      ["Output", "Analog"],
    ],
    "pressure sensor"
  ),
  r(
    "ad8232-heart-rate-sensor",
    "AD8232 Heart Rate Sensor Module",
    "Each",
    1600,
    "ECG front-end that outputs a clean waveform.",
    "Bio-signal demonstrations — for education only, not medical use.",
    [
      ["Interface", "Analog"],
      ["Electrodes", "3.5 mm jack"],
    ],
    "electrocardiography"
  ),
  r(
    "ecg-electrode-pads-pack-20",
    "ECG Electrode Pads (Pack of 20)",
    "Pack of 20",
    300,
    "Disposable snap electrodes with conductive gel.",
    "Replacement pads for the AD8232 and similar modules.",
    [["Type", "Disposable snap"]],
    "electrode pad"
  ),
  r(
    "line-tracking-array-4ch",
    "4-Channel Line Tracking Sensor Array",
    "Each",
    550,
    "Four reflectance sensors on one board.",
    "Line-following robots with per-channel sensitivity trimpots.",
    [
      ["Channels", "4"],
      ["Output", "Digital"],
    ],
    "infrared sensor"
  ),
  r(
    "bme680-environmental-sensor",
    "BME680 Environmental Sensor (Temp, Humidity, Pressure, Gas)",
    "Each",
    1300,
    "Four environmental readings over I2C.",
    "Air-quality estimation from the gas-resistance reading.",
    [
      ["Interface", "I2C"],
      ["Measure", "Temperature, humidity, pressure, gas"],
    ],
    "humidity sensor"
  ),
  r(
    "max31865-pt100-kit",
    "MAX31865 PT100 RTD Kit (Amp + Probe)",
    "Kit",
    1300,
    "Precision platinum-resistance measurement over SPI.",
    "High-accuracy temperature where thermocouples are too noisy.",
    [
      ["Probe", "PT100, 100 Ω"],
      ["Interface", "SPI"],
    ],
    "temperature probe"
  ),
  r(
    "apds9960-gesture-sensor",
    "APDS9960 Gesture & Colour Sensor",
    "Each",
    700,
    "Gesture, colour, ambient light and proximity in one chip.",
    "Wave-hand controls and colour picking over I2C.",
    [
      ["Functions", "Gesture, colour, light, proximity"],
      ["Interface", "I2C"],
    ],
    "proximity sensor"
  ),
  r(
    "pulse-sensor-analog",
    "Pulse Sensor (Heart Rate, Analog)",
    "Each",
    400,
    "Green-LED sensor for a fingertip.",
    "Heart-rate demos on an analog pin; not a medical device.",
    [
      ["Output", "Analog"],
      ["Supply", "3.3 – 5 V"],
    ],
    "heart rate monitor"
  ),
  r(
    "sw520d-tilt-switch-pack-5",
    "SW-520D Tilt Ball Switch (Pack of 5)",
    "Pack of 5",
    200,
    "Rolling-ball switches that close when tilted.",
    "Alarm when a device is moved or overturned.",
    [["Type", "Rolling ball, normally open"]],
    "tilt switch"
  )
)

push(
  "modules-boards",
  r(
    "uno-r3-development-board",
    "UNO R3 Development Board",
    "Each",
    850,
    "ATmega328P board programmed over USB.",
    "14 digital I/O, 6 analog inputs, 5 V logic.",
    [
      ["Microcontroller", "ATmega328P"],
      ["Digital I/O", "14"],
      ["Analog inputs", "6"],
    ],
    "Arduino Uno R3"
  ),
  r(
    "nano-v3-ch340",
    "Nano V3 Development Board (CH340)",
    "Each",
    700,
    "Breadboard-friendly ATmega328P board.",
    "Same chip as the UNO in a smaller package.",
    [
      ["Microcontroller", "ATmega328P"],
      ["USB chip", "CH340"],
    ],
    "Arduino Nano"
  ),
  r(
    "pro-mini-5v-16mhz",
    "Pro Mini 5 V 16 MHz Board",
    "Each",
    600,
    "Ultra-compact ATmega328P board.",
    "For permanent installs; needs a USB-to-TTL adapter to program.",
    [
      ["Microcontroller", "ATmega328P"],
      ["Voltage", "5 V"],
    ],
    "Arduino Pro Mini"
  ),
  r(
    "mega-2560-board",
    "Mega 2560 Development Board",
    "Each",
    1800,
    "54 I/O pins for bigger builds.",
    "More pins and memory for printers and multi-sensor systems.",
    [
      ["Digital I/O", "54"],
      ["Flash", "256 KB"],
    ],
    "Arduino Mega 2560"
  ),
  r(
    "esp32-devkit-v1",
    "ESP32 DevKit V1 (WiFi + Bluetooth)",
    "Each",
    1100,
    "Dual-core 3.3 V board with built-in WiFi and Bluetooth.",
    "The go-to board for IoT projects, programmable from the Arduino IDE.",
    [
      ["Microcontroller", "ESP32 dual-core"],
      ["Wireless", "WiFi + Bluetooth"],
      ["Logic", "3.3 V"],
    ],
    "ESP32 DevKit"
  ),
  r(
    "nodemcu-esp8266",
    "NodeMCU ESP8266 WiFi Board",
    "Each",
    800,
    "Low-cost WiFi board.",
    "Simple IoT sensors that post to the web.",
    [
      ["Microcontroller", "ESP8266"],
      ["Logic", "3.3 V"],
    ],
    "NodeMCU ESP8266"
  ),
  r(
    "wemos-d1-mini",
    "Wemos D1 Mini (ESP8266)",
    "Each",
    700,
    "Tiny ESP8266 WiFi board.",
    "Fits compact builds and shields.",
    [
      ["Microcontroller", "ESP8266"],
      ["Logic", "3.3 V"],
    ],
    "Wemos D1 Mini"
  ),
  r(
    "raspberry-pi-pico",
    "Raspberry Pi Pico (RP2040)",
    "Each",
    900,
    "Dual-core microcontroller for MicroPython or C.",
    "26 GPIO and programmable I/O.",
    [
      ["Microcontroller", "RP2040, 133 MHz"],
      ["Logic", "3.3 V"],
    ],
    "Raspberry Pi Pico"
  ),
  r(
    "uno-sensor-shield-v5",
    "UNO Sensor Shield V5",
    "Each",
    450,
    "Breaks out every pin to 3-pin sensor headers.",
    "Plug sensors and servos straight in.",
    [["Fits", "UNO R3"]],
    "Arduino sensor shield"
  ),
  r(
    "nano-expansion-shield",
    "Nano Screw-Terminal Expansion Board",
    "Each",
    450,
    "Screw terminals for all Nano pins.",
    "Secure wiring for permanent installs.",
    [["Fits", "Nano V3"]],
    "Arduino Nano shield"
  ),
  r(
    "1-channel-relay-module",
    "1-Channel 5 V Relay Module",
    "Each",
    250,
    "Switch loads from a 5 V logic pin.",
    "Screw terminals for the load, headers for VCC, GND and IN.",
    [
      ["Channels", "1"],
      ["Load", "10 A at 250 V AC"],
    ],
    "relay module"
  ),
  r(
    "relay-module-2-channel",
    "2-Channel 5 V Relay Module",
    "Each",
    400,
    "Two optoisolated relays.",
    "Control two loads from one board.",
    [
      ["Channels", "2"],
      ["Load", "10 A at 250 V AC"],
    ],
    "2 channel relay module"
  ),
  r(
    "relay-module-4-channel",
    "4-Channel 5 V Relay Module",
    "Each",
    600,
    "Four independent relays.",
    "Home-automation hardware.",
    [
      ["Channels", "4"],
      ["Load", "10 A at 250 V AC"],
    ],
    "4 channel relay module"
  ),
  r(
    "relay-module-8-channel",
    "8-Channel 5 V Relay Module",
    "Each",
    1100,
    "Eight optoisolated relays.",
    "Larger automation panels.",
    [
      ["Channels", "8"],
      ["Load", "10 A at 250 V AC"],
    ],
    "8 channel relay module"
  ),
  r(
    "l298n-motor-driver-module",
    "L298N Motor Driver Module",
    "Each",
    450,
    "Drive two DC motors or one stepper.",
    "Dual H-bridge with onboard heatsink.",
    [
      ["Channels", "2"],
      ["Current", "2 A per channel"],
    ],
    "L298N"
  ),
  r(
    "l9110s-motor-driver",
    "L9110S Dual Motor Driver",
    "Each",
    250,
    "Compact driver for small motors.",
    "Cheap driver for toy-sized robots.",
    [
      ["Channels", "2"],
      ["Current", "800 mA"],
    ],
    "motor driver module"
  ),
  r(
    "tb6612fng-motor-driver",
    "TB6612FNG Motor Driver",
    "Each",
    600,
    "Efficient dual driver, 1.2 A.",
    "Cooler and more efficient than the L298N.",
    [
      ["Channels", "2"],
      ["Current", "1.2 A"],
    ],
    "TB6612FNG"
  ),
  r(
    "a4988-stepper-driver",
    "A4988 Stepper Driver Module",
    "Each",
    400,
    "Microstepping bipolar stepper driver.",
    "NEMA 17 motors in CNC and 3D printers.",
    [
      ["Microstepping", "to 1/16"],
      ["Supply", "8 – 35 V"],
    ],
    "A4988 stepper driver"
  ),
  r(
    "drv8825-stepper-driver",
    "DRV8825 Stepper Driver Module",
    "Each",
    500,
    "1/32 microstepping driver, 2.5 A.",
    "Quieter and finer than the A4988.",
    [["Microstepping", "to 1/32"]],
    "DRV8825"
  ),
  r(
    "pca9685-servo-driver",
    "PCA9685 16-Channel Servo Driver",
    "Each",
    800,
    "16 servos over two I2C wires.",
    "For robot arms and hexapods.",
    [
      ["Channels", "16"],
      ["Interface", "I2C"],
    ],
    "PCA9685"
  ),
  r(
    "1602-i2c-lcd-module",
    "1602 I2C LCD Display Module",
    "Each",
    400,
    "16×2 display on two data wires.",
    "Readouts for meters and counters.",
    [
      ["Display", "16×2"],
      ["Interface", "I2C"],
    ],
    "LCD 1602"
  ),
  r(
    "2004-i2c-lcd-module",
    "2004 I2C LCD Display Module",
    "Each",
    700,
    "20×4 display on two data wires.",
    "More text for menus and dashboards.",
    [
      ["Display", "20×4"],
      ["Interface", "I2C"],
    ],
    "LCD 2004"
  ),
  r(
    "oled-096-i2c-module",
    '0.96" OLED Display 128×64 (I2C)',
    "Each",
    650,
    "Sharp monochrome graphics display.",
    "Text, icons and small graphs.",
    [
      ["Resolution", "128×64"],
      ["Driver", "SSD1306"],
    ],
    "SSD1306 OLED"
  ),
  r(
    "tft-18-st7735-module",
    '1.8" TFT Colour Display (ST7735)',
    "Each",
    900,
    "128×160 colour SPI display.",
    "Colour UI for small gadgets.",
    [
      ["Resolution", "128×160"],
      ["Interface", "SPI"],
    ],
    "TFT LCD display"
  ),
  r(
    "max7219-led-matrix-8x8",
    "MAX7219 8×8 LED Matrix Module",
    "Each",
    450,
    "Scrolling text on a chained matrix.",
    "Driven over SPI.",
    [
      ["Size", "8×8"],
      ["Interface", "SPI"],
    ],
    "MAX7219 LED matrix"
  ),
  r(
    "tm1637-4-digit-display",
    "TM1637 4-Digit 7-Segment Display",
    "Each",
    300,
    "Clock-style numeric display.",
    "Clocks, timers and counters.",
    [
      ["Digits", "4"],
      ["Interface", "2-wire"],
    ],
    "TM1637 display"
  ),
  r(
    "ds3231-rtc-module",
    "DS3231 Real-Time Clock Module",
    "Each",
    450,
    "Accurate battery-backed clock.",
    "Needs a CR2032 (not included).",
    [
      ["Interface", "I2C"],
      ["Accuracy", "±2 ppm"],
    ],
    "DS3231"
  ),
  r(
    "microsd-card-module",
    "MicroSD Card Module (SPI)",
    "Each",
    250,
    "Read/write SD cards.",
    "Log data to CSV files.",
    [["Interface", "SPI"]],
    "microSD card module"
  ),
  r(
    "keypad-4x4-membrane",
    "4×4 Membrane Keypad",
    "Each",
    250,
    "16-button keypad.",
    "PIN entry and menus.",
    [["Keys", "16"]],
    "membrane keypad"
  ),
  r(
    "rotary-encoder-ky040",
    "KY-040 Rotary Encoder Module",
    "Each",
    250,
    "Endless dial with push button.",
    "Menu control for displays.",
    [["Pulses", "20 per rotation"]],
    "rotary encoder"
  ),
  r(
    "joystick-module-2-axis",
    "2-Axis Joystick Module",
    "Each",
    250,
    "Analog thumb joystick with button.",
    "Robot control and games.",
    [["Axes", "2 analog"]],
    "analog joystick module"
  ),
  r(
    "ws2812b-led-strip-1m",
    "WS2812B Addressable LED Strip (1 m, 30 LEDs)",
    "Each",
    1500,
    "Individually controllable RGB LEDs.",
    "Budget about 60 mA per LED and power from a separate 5 V supply.",
    [
      ["LEDs", "30/m"],
      ["Voltage", "5 V"],
    ],
    "WS2812B LED strip"
  ),
  r(
    "ws2812b-5050-module-pack-10",
    "WS2812B 5050 RGB Breakout (Pack of 10)",
    "Pack of 10",
    600,
    "Single addressable LEDs on small boards.",
    "Chain them into custom light layouts.",
    [["Voltage", "5 V"]],
    "WS2812B"
  ),
  r(
    "ads1115-adc-module",
    "ADS1115 16-Bit ADC Module",
    "Each",
    700,
    "Precise 4-channel ADC over I2C.",
    "Better resolution than the UNO's built-in ADC.",
    [
      ["Resolution", "16-bit"],
      ["Interface", "I2C"],
    ],
    "ADS1115"
  ),
  r(
    "pcf8574-io-expander",
    "PCF8574 I2C I/O Expander",
    "Each",
    300,
    "Eight extra pins over I2C.",
    "Add inputs and outputs without extra wires.",
    [
      ["Pins", "8"],
      ["Interface", "I2C"],
    ],
    "PCF8574"
  ),
  r(
    "level-shifter-4ch-pack-2",
    "4-Channel Logic Level Shifter (Pack of 2)",
    "Pack of 2",
    300,
    "Safely connect 3.3 V and 5 V devices.",
    "Protects ESP32 pins from 5 V signals.",
    [["Channels", "4"]],
    "logic level converter"
  ),
  r(
    "dfplayer-mini-mp3",
    "DFPlayer Mini MP3 Module",
    "Each",
    500,
    "Play MP3s from a microSD card.",
    "Add voice prompts and sound effects.",
    [["Interface", "UART"]],
    "DFPlayer Mini"
  ),
  r(
    "pam8403-amp-pack-2",
    "PAM8403 3 W Stereo Amplifier (Pack of 2)",
    "Pack of 2",
    350,
    "Tiny class-D amp for small speakers.",
    "USB-powered audio output.",
    [["Power", "3 W × 2"]],
    "PAM8403"
  ),
  r(
    "r307-fingerprint-module",
    "R307 Fingerprint Sensor Module",
    "Each",
    2800,
    "Optical fingerprint reader with onboard matching.",
    "Attendance and door-lock projects.",
    [
      ["Interface", "UART"],
      ["Capacity", "≈ 1000 prints"],
    ],
    "fingerprint sensor"
  ),
  r(
    "usb-ttl-cp2102",
    "CP2102 USB-to-TTL Serial Adapter",
    "Each",
    350,
    "Program Pro Mini / ESP-01 boards.",
    "3.3 V and 5 V serial.",
    [["Chip", "CP2102"]],
    "CP2102 USB UART"
  )
)

/* ---- Batch D: boards, shields, drivers, displays, expansion ---- */
push(
  "modules-boards",
  r(
    "esp32-s3-devkitc-1",
    "ESP32-S3 DevKitC-1 Board",
    "Each",
    1800,
    "Dual-core ESP32-S3 with WiFi and Bluetooth LE.",
    "Faster than the classic ESP32 with vector instructions for edge ML.",
    [
      ["Microcontroller", "ESP32-S3 dual-core"],
      ["Wireless", "WiFi + Bluetooth LE"],
      ["Logic", "3.3 V"],
    ],
    "ESP32-S3"
  ),
  r(
    "esp32-c3-supermini",
    "ESP32-C3 SuperMini Board",
    "Each",
    600,
    "Tiny RISC-V ESP32 with WiFi and BLE.",
    "Fits breadboards and tight spaces at the lowest price point.",
    [
      ["Microcontroller", "ESP32-C3 RISC-V"],
      ["Wireless", "WiFi + Bluetooth LE"],
      ["Logic", "3.3 V"],
    ],
    "ESP32-C3"
  ),
  r(
    "arduino-micro-v3",
    "Arduino Micro V3 (ATmega32U4)",
    "Each",
    1100,
    "UNO-class board that enumerates as a keyboard or mouse.",
    "Build custom HID controllers straight from the Arduino IDE.",
    [
      ["Microcontroller", "ATmega32U4"],
      ["Logic", "5 V"],
    ],
    "Arduino Micro"
  ),
  r(
    "raspberry-pi-pico-w",
    "Raspberry Pi Pico W (WiFi)",
    "Each",
    1400,
    "Pico with 802.11n WiFi on board.",
    "MicroPython or C with wireless built in.",
    [
      ["Microcontroller", "RP2040"],
      ["Wireless", "WiFi 802.11n"],
      ["Logic", "3.3 V"],
    ],
    "Raspberry Pi Pico"
  ),
  r(
    "raspberry-pi-pico-2",
    "Raspberry Pi Pico 2 (RP2350)",
    "Each",
    1500,
    "Faster RP2350 with more RAM.",
    "Same footprint as the Pico with upgraded cores and security.",
    [
      ["Microcontroller", "RP2350"],
      ["Logic", "3.3 V"],
    ],
    "Raspberry Pi Pico"
  ),
  r(
    "stm32-blue-pill",
    "STM32F103C8T6 Blue Pill Board",
    "Each",
    700,
    "Cheap 32-bit ARM board with 64 KB flash.",
    "Faster timers and ADCs than an UNO; program over SWD or serial.",
    [
      ["Microcontroller", "STM32F103 Cortex-M3"],
      ["Flash", "64 KB"],
      ["Logic", "3.3 V"],
    ],
    "STM32 development board"
  ),
  r(
    "digispark-attiny85",
    "Digispark ATtiny85 Board",
    "Each",
    550,
    "Six I/O pins in a USB-stick size.",
    "Program over USB with the Arduino IDE; great for tiny permanent builds.",
    [
      ["Microcontroller", "ATtiny85"],
      ["I/O", "6"],
      ["Interface", "USB"],
    ],
    "ATtiny85"
  ),
  r(
    "arduino-nano-every",
    "Arduino Nano Every (ATmega4809)",
    "Each",
    1400,
    "Modern Nano with more memory than the classic.",
    "Drop-in Nano footprint with a newer MCU.",
    [
      ["Microcontroller", "ATmega4809"],
      ["Logic", "5 V"],
    ],
    "Arduino Nano"
  ),
  r(
    "xiao-esp32c3",
    "Seeed XIAO ESP32-C3 Board",
    "Each",
    800,
    "Thumb-sized WiFi board with castellated pads.",
    "Solder it flat onto a carrier board for finished products.",
    [
      ["Microcontroller", "ESP32-C3 RISC-V"],
      ["Wireless", "WiFi + Bluetooth LE"],
    ],
    "development board"
  ),
  r(
    "microbit-v2",
    "BBC micro:bit V2",
    "Each",
    1700,
    "Pocket computer with sensors, radio and LEDs.",
    "The classroom favourite — code it in MakeCode or MicroPython.",
    [
      ["Microcontroller", "nRF52833"],
      ["Sensors", "Accelerometer, compass, light, sound"],
      ["Radio", "Bluetooth LE"],
    ],
    "BBC micro:bit"
  ),
  r(
    "arduino-motor-shield",
    "Arduino Motor Shield (L298)",
    "Each",
    800,
    "Stack-on motor driver for UNO.",
    "Two DC or one stepper motor directly on the header pins.",
    [
      ["Fits", "UNO R3"],
      ["Current", "2 A peak per channel"],
    ],
    "motor shield"
  ),
  r(
    "arduino-ethernet-shield",
    "Arduino Ethernet Shield (W5100)",
    "Each",
    1100,
    "Wired LAN for UNO builds.",
    "Reliable networking where WiFi drops; also powers the board over PoE with an injector.",
    [
      ["Fits", "UNO R3"],
      ["Chip", "W5100"],
      ["Interface", "SPI"],
    ],
    "Ethernet shield"
  ),
  r(
    "arduino-proto-shield",
    "Arduino Proto Shield",
    "Each",
    350,
    "Solder your project onto a UNO-shaped board.",
    "Turn a breadboard design into a finished shield.",
    [
      ["Fits", "UNO R3"],
      ["Pitch", "2.54 mm"],
    ],
    "Arduino shield"
  ),
  r(
    "joystick-shield-uno",
    "Arduino Joystick Shield V1.0",
    "Each",
    450,
    "Thumb joystick plus four buttons on a UNO shield.",
    "Game controllers and robot remotes without wiring.",
    [
      ["Fits", "UNO R3"],
      ["Controls", "Joystick + 4 buttons"],
    ],
    "Arduino shield"
  ),
  r(
    "lcd-keypad-shield-1602",
    "1602 LCD Keypad Shield",
    "Each",
    650,
    "16×2 display with five buttons for UNO.",
    "Menus and readouts with no loose wiring.",
    [
      ["Display", "16×2"],
      ["Buttons", "5 + reset"],
    ],
    "Arduino shield"
  ),
  r(
    "stepper-shield-2x-a4988",
    "Stepper Motor Driver Shield (2× A4988)",
    "Each",
    800,
    "Two socketed stepper drivers on one UNO shield.",
    "CNC-style builds with independent axes.",
    [
      ["Fits", "UNO R3"],
      ["Drivers", "2 × A4988"],
    ],
    "stepper motor driver"
  ),
  r(
    "data-logger-shield",
    "Arduino Data Logger Shield (RTC + microSD)",
    "Each",
    750,
    "Timestamped data logging on a UNO.",
    "DS1307 clock and microSD socket in one stackable shield.",
    [
      ["Fits", "UNO R3"],
      ["Includes", "DS1307 clock + microSD"],
    ],
    "Arduino shield"
  ),
  r(
    "microbit-expansion-board",
    "micro:bit Expansion Board (Edge Connector)",
    "Each",
    600,
    "Breaks the micro:bit edge into 3-pin headers.",
    "Plug sensors and servos straight in with GVS cables.",
    [
      ["Fits", "micro:bit"],
      ["Headers", "3-pin GVS"],
    ],
    "BBC micro:bit"
  ),
  r(
    "tb6600-stepper-driver",
    "TB6600 Stepper Motor Driver",
    "Each",
    950,
    "Full/half-step driver for NEMA 17–23 motors.",
    "Dial microstepping and current on the front panel.",
    [
      ["Current", "4 A"],
      ["Supply", "9 – 42 V"],
      ["Microstepping", "to 1/32"],
    ],
    "stepper motor driver"
  ),
  r(
    "bts7960-dual-driver",
    "BTS7960 43 A Dual Motor Driver",
    "Each",
    1000,
    "High-current H-bridge pair for big DC motors.",
    "Robot arms, go-karts and winches; use a separate logic supply.",
    [
      ["Channels", "2"],
      ["Current", "43 A per channel"],
    ],
    "motor driver module"
  ),
  r(
    "cytron-md10c-driver",
    "Cytron MD10C 10 A PWM Motor Driver",
    "Each",
    750,
    "Single-channel driver with PWM and direction inputs.",
    "Simple, robust drive for one brushed DC motor.",
    [
      ["Current", "10 A"],
      ["Control", "PWM + DIR"],
    ],
    "motor driver module"
  ),
  r(
    "drv8833-dual-driver",
    "DRV8833 Dual Motor Driver Module",
    "Each",
    450,
    "Efficient dual H-bridge for small robots.",
    "Runs two TT motors from a single Li-ion cell.",
    [
      ["Channels", "2"],
      ["Current", "1.5 A per channel"],
    ],
    "motor driver module"
  ),
  r(
    "pwm-motor-controller",
    "DC Motor PWM Speed Controller Module",
    "Each",
    400,
    "Turn a potentiometer to set motor speed.",
    "Bench supply of PWM for fans, pumps and drills.",
    [
      ["Supply", "6 – 30 V DC"],
      ["Output", "PWM"],
    ],
    "PWM motor controller"
  ),
  r(
    "mosfet-driver-4ch",
    "4-Channel MOSFET Low-Side Driver",
    "Each",
    400,
    "Four protected MOSFET outputs for LED strips and fans.",
    "PWM dimming and switching from any 3.3–5 V board.",
    [
      ["Channels", "4"],
      ["Control", "3.3 – 5 V logic"],
    ],
    "MOSFET module"
  ),
  r(
    "oled-13-ssh1106",
    '1.3" OLED Display 128×64 (SSH1106)',
    "Each",
    750,
    "Larger OLED than the 0.96 inch version.",
    "Same I2C driver family, more readable text.",
    [
      ["Resolution", "128×64"],
      ["Driver", "SSH1106"],
      ["Interface", "I2C"],
    ],
    "OLED display"
  ),
  r(
    "oled-242-ssd1309",
    '2.42" OLED Display 128×64 (SSD1309)',
    "Each",
    1500,
    "Wide OLED panel for dashboards.",
    "High-contrast readouts visible from across a room.",
    [
      ["Resolution", "128×64"],
      ["Driver", "SSD1309"],
      ["Interface", "I2C"],
    ],
    "OLED display"
  ),
  r(
    "nokia5110-lcd",
    "Nokia 5110 LCD Module",
    "Each",
    450,
    "84×48 pixel LCD with a backlight.",
    "Ultra-low-power monochrome display for battery projects.",
    [
      ["Resolution", "84×48"],
      ["Interface", "SPI"],
    ],
    "LCD display"
  ),
  r(
    "max7219-4in1-matrix",
    "MAX7219 4-in-1 LED Matrix (32×8)",
    "Each",
    650,
    "Four chained 8×8 matrices for scrolling text.",
    "Cascade more modules for longer messages.",
    [
      ["Size", "32×8"],
      ["Interface", "SPI"],
      ["Cascadable", "Up to 8 modules"],
    ],
    "LED matrix"
  ),
  r(
    "max7219-4digit-7seg",
    "MAX7219 4-Digit 7-Segment Module",
    "Each",
    550,
    "Bright numeric display on three wires.",
    "Clocks and counters without a driver library fight.",
    [
      ["Digits", "4"],
      ["Interface", "SPI"],
    ],
    "seven segment display"
  ),
  r(
    "ili9341-tft-24",
    '2.4" TFT Display (ILI9341, 240×320)',
    "Each",
    1300,
    "Full-colour touchscreen over SPI.",
    "Graphical interfaces for appliance controllers.",
    [
      ["Resolution", "240×320"],
      ["Interface", "SPI"],
    ],
    "TFT LCD display"
  ),
  r(
    "st7789-tft-13",
    '1.3" IPS Display (ST7789, 240×240)',
    "Each",
    1050,
    "Square IPS panel with wide viewing angles.",
    "Sharp menus for handheld gadgets.",
    [
      ["Resolution", "240×240"],
      ["Interface", "SPI"],
    ],
    "LCD display"
  ),
  r(
    "e-paper-29",
    "2.9 inch E-Paper Display Module (SPI)",
    "Each",
    1800,
    "Bistable display that holds its image without power.",
    "Price tags, labels and low-power status screens.",
    [
      ["Resolution", "296×128"],
      ["Interface", "SPI"],
    ],
    "e-paper display"
  ),
  r(
    "st7920-12864-lcd",
    "12864 Graphic LCD (ST7920)",
    "Each",
    700,
    "Graphical LCD with onboard character set.",
    "Menus with simple graphics on a 5 V board.",
    [
      ["Resolution", "128×64"],
      ["Interface", "SPI / parallel"],
    ],
    "LCD display"
  ),
  r(
    "tm1640-8digit",
    "TM1640 8-Digit LED Module",
    "Each",
    500,
    "Eight digits on two wires.",
    "Scoreboards and multi-value readouts.",
    [
      ["Digits", "8"],
      ["Interface", "2-wire"],
    ],
    "seven segment display"
  ),
  r(
    "rgb-matrix-32x16",
    "RGB LED Matrix Panel 32×16 (HUB75)",
    "Each",
    2200,
    "Full-colour indoor LED panel.",
    "Scoreboards and animated signs; budget a 5 V supply rated for the panel.",
    [
      ["Resolution", "32×16"],
      ["Interface", "HUB75"],
      ["Supply", "5 V DC"],
    ],
    "LED display"
  ),
  r(
    "mcp23017-expander",
    "MCP23017 16-Bit I/O Expander",
    "Each",
    450,
    "Sixteen more pins over I2C.",
    "Keypads, LEDs and relays when the board runs out of GPIO.",
    [
      ["Pins", "16"],
      ["Interface", "I2C"],
    ],
    "MCP23017"
  ),
  r(
    "mcp4725-dac",
    "MCP4725 12-Bit DAC Module",
    "Each",
    350,
    "Analog output from two wires.",
    "Set reference voltages and waveform outputs from I2C.",
    [
      ["Resolution", "12-bit"],
      ["Interface", "I2C"],
    ],
    "MCP4725"
  ),
  r(
    "tca9548a-i2c-mux",
    "TCA9548A I2C Multiplexer",
    "Each",
    500,
    "Eight I2C channels on one bus.",
    "Run several identical sensors without address clashes.",
    [
      ["Channels", "8"],
      ["Interface", "I2C switch"],
    ],
    "TCA9548"
  ),
  r(
    "max485-rs485",
    "MAX485 RS-485 Module",
    "Each",
    280,
    "Long-distance differential serial link.",
    "Talk to meters and PLCs over hundreds of metres of twisted pair.",
    [
      ["Interface", "RS-485"],
      ["Chip", "MAX485"],
    ],
    "MAX485"
  ),
  r(
    "mcp2515-can",
    "MCP2515 CAN Bus Module",
    "Each",
    450,
    "CAN 2.0B interface over SPI.",
    "Talk to cars, industrial modules and other MCUs robustly.",
    [
      ["Bus", "CAN 2.0B"],
      ["Chip", "MCP2515"],
      ["Interface", "SPI"],
    ],
    "MCP2515"
  ),
  r(
    "mpr121-touch",
    "MPR121 12-Channel Touch Sensor",
    "Each",
    550,
    "Twelve capacitive touch pads over I2C.",
    "Touch panels and hidden controls with copper pads.",
    [
      ["Channels", "12"],
      ["Interface", "I2C"],
    ],
    "capacitive touch"
  ),
  r(
    "isd1820-voice",
    "ISD1820 Voice Record/Play Module",
    "Each",
    400,
    "Record a short message and play it back.",
    "Announcements and sound effects with two buttons.",
    [
      ["Record time", "up to 10 s"],
      ["Control", "Record / play"],
    ],
    "voice module"
  ),
  r(
    "keypad-3x4-membrane",
    "3×4 Membrane Keypad",
    "Each",
    220,
    "Twelve-key numeric pad with adhesive backing.",
    "PIN entry on enclosure fronts.",
    [
      ["Keys", "12"],
      ["Interface", "Matrix"],
    ],
    "membrane keypad"
  ),
  r(
    "shift-register-74hc595-module",
    "8-Bit Shift Register Module (74HC595)",
    "Each",
    250,
    "Eight outputs from three pins, ready-wired.",
    "Drive LEDs and relays without leaving the breadboard.",
    [
      ["Outputs", "8"],
      ["Interface", "SPI-like"],
    ],
    "74HC595"
  ),
  r(
    "xpt2046-touch",
    "XPT2046 Touch Screen Controller",
    "Each",
    320,
    "Four-wire resistive touch controller.",
    "Add touch to the ILI9341 panels over SPI.",
    [
      ["Interface", "SPI"],
      ["Controller", "XPT2046"],
    ],
    "touchscreen"
  ),
  r(
    "ad9833-dds",
    "AD9833 DDS Signal Generator Module",
    "Each",
    600,
    "Programmable sine, triangle and square output.",
    "Sweep test signals up to 12.5 MHz from two pins.",
    [
      ["Range", "0 – 12.5 MHz"],
      ["Interface", "SPI"],
    ],
    "signal generator"
  ),
  r(
    "cs4344-i2s-dac",
    "CS4344 I2S DAC Module",
    "Each",
    400,
    "Clean stereo audio straight from I2S.",
    "Music and prompts from an ESP32 without an analog hack.",
    [
      ["Interface", "I2S"],
      ["Output", "Stereo line"],
    ],
    "digital-to-analog converter"
  ),
  r(
    "mcp4131-digital-pot",
    "Digital Potentiometer Module (MCP4131)",
    "Each",
    380,
    "10 kΩ pot you can set from code.",
    "Calibration, gain and filter tuning without a screwdriver.",
    [
      ["Resistance", "10 kΩ"],
      ["Interface", "SPI"],
    ],
    "digital potentiometer"
  ),
  r(
    "relay-module-16-channel",
    "16-Channel 5 V Relay Module",
    "Each",
    1600,
    "Sixteen optoisolated relays on one board.",
    "Whole-building automation panels in a single stack.",
    [
      ["Channels", "16"],
      ["Load", "10 A at 250 V AC"],
    ],
    "relay module"
  ),
  r(
    "ssr-40da-module",
    "SSR-40DA Solid State Relay Module",
    "Each",
    550,
    "40 A AC switch with no moving contacts.",
    "Silent, fast switching for heaters. Mains wiring must stay inside an enclosure.",
    [
      ["Load", "40 A AC"],
      ["Control", "3 – 32 V DC"],
    ],
    "solid state relay"
  ),
  r(
    "ac-dimmer-triac-module",
    "AC Dimmer Module (Zero-Cross Triac)",
    "Each",
    650,
    "Phase-cut dimmer driven from a logic pin.",
    "Lighting control. Mains voltage present — mount it in an enclosure.",
    [
      ["Load", "up to 5 A AC"],
      ["Control", "Optoisolated logic"],
    ],
    "triac dimmer"
  ),
  r(
    "servo-tester-module",
    "Servo Tester (Manual / Auto)",
    "Each",
    350,
    "Drive a servo without a microcontroller.",
    "Check servos on the bench and centre them before assembly.",
    [
      ["Outputs", "1 servo"],
      ["Modes", "Manual, neutral, auto"],
    ],
    "servo tester"
  ),
  r(
    "ws2812b-ring-24",
    "WS2812B RGB Ring — 24 LEDs",
    "Each",
    650,
    "Circular addressable LED arrangement.",
    "Clock faces, dials and status halos.",
    [
      ["LEDs", "24"],
      ["Voltage", "5 V"],
    ],
    "WS2812B"
  ),
  r(
    "ws2812b-matrix-8x8",
    "WS2812B LED Matrix 8×8",
    "Each",
    750,
    "Sixty-four individually addressable pixels.",
    "Colour animations on a grid from one data pin.",
    [
      ["LEDs", "64"],
      ["Voltage", "5 V"],
    ],
    "addressable LED"
  ),
  r(
    "ds1307-rtc-module",
    "DS1307 Real-Time Clock Module",
    "Each",
    250,
    "The affordable I2C clock module.",
    "Timestamps and alarms with a CR2032 backup.",
    [
      ["Interface", "I2C"],
      ["Battery", "CR2032 (not included)"],
    ],
    "DS1307"
  ),
  r(
    "voltmeter-module-30v",
    "0.28 inch Digital Voltmeter Module",
    "Each",
    250,
    "Tiny red LED panel meter for DC voltage.",
    "Monitor a supply rail or battery pack at a glance.",
    [
      ["Range", "0.5 – 30 V DC"],
      ["Display", "3-digit LED"],
    ],
    "voltmeter"
  ),
  r(
    "lm3914-bargraph",
    "LM3914 LED Bar Graph Module",
    "Each",
    450,
    "Ten-dot analog bargraph display.",
    "VU meters and fuel gauges without a microcontroller.",
    [
      ["Display", "10-dot LED"],
      ["Input", "0 – 5 V analog"],
    ],
    "LED display"
  ),
  r(
    "as5600-encoder",
    "AS5600 Magnetic Rotary Encoder Module",
    "Each",
    550,
    "Contactless 12-bit angle over I2C.",
    "Add absolute position to motors and dials with a diametric magnet.",
    [
      ["Resolution", "12-bit"],
      ["Interface", "I2C"],
    ],
    "rotary encoder"
  ),
  r(
    "w1209-temp-controller",
    "W1209 Temperature Controller Module",
    "Each",
    500,
    "Thermostat with display, probe and relay.",
    "Heaters, incubators and fans with set-point control.",
    [
      ["Sensor", "NTC probe included"],
      ["Relay", "10 A"],
    ],
    "temperature controller"
  ),
  r(
    "tm1650-4digit-module",
    "TM1650 4-Digit Display with 4 Keys",
    "Each",
    500,
    "Four digits plus four buttons on two wires.",
    "Compact front panels for controllers.",
    [
      ["Digits", "4"],
      ["Keys", "4"],
    ],
    "seven segment display"
  ),
  r(
    "robot-car-shield",
    "Robot Car Shield for UNO (Motor Driver + Encoder Inputs)",
    "Each",
    700,
    "UNO-shaped drive board for two-wheeled robots.",
    "Motor driver, servo header and sensor plugs in one stack.",
    [
      ["Fits", "UNO R3"],
      ["Channels", "2 motors"],
    ],
    "robot chassis"
  )
)

push(
  "wireless-iot",
  r(
    "hc-05-bluetooth-module",
    "HC-05 Bluetooth Serial Module",
    "Each",
    850,
    "Phone control for any board.",
    "Master/slave Bluetooth serial.",
    [
      ["Range", "≈ 10 m"],
      ["Logic", "3.3 V"],
    ],
    "HC-05 Bluetooth"
  ),
  r(
    "hc-06-bluetooth-module",
    "HC-06 Bluetooth Slave Module",
    "Each",
    750,
    "Simple slave-only Bluetooth.",
    "Quick phone connections.",
    [["Range", "≈ 10 m"]],
    "HC-06 Bluetooth"
  ),
  r(
    "hm-10-ble-module",
    "HM-10 Bluetooth 4.0 BLE Module",
    "Each",
    1000,
    "Low-energy Bluetooth.",
    "Works with modern phones and iOS.",
    [["Standard", "BLE 4.0"]],
    "HM-10 BLE"
  ),
  r(
    "nrf24l01-radio-pack-2",
    "nRF24L01 2.4 GHz Radio (Pack of 2)",
    "Pack of 2",
    700,
    "A pair of board-to-board radios.",
    "Add a 10 µF capacitor on the supply.",
    [
      ["Frequency", "2.4 GHz"],
      ["Interface", "SPI"],
    ],
    "nRF24L01"
  ),
  r(
    "lora-sx1278-ra02-pack-2",
    "LoRa SX1278 Ra-02 433 MHz (Pack of 2)",
    "Pack of 2",
    2400,
    "Long-range radio, kilometres in open areas.",
    "Remote farm and tank sensors.",
    [
      ["Frequency", "433 MHz"],
      ["Interface", "SPI"],
    ],
    "LoRa module"
  ),
  r(
    "neo-6m-gps-module",
    "NEO-6M GPS Module with Antenna",
    "Each",
    1400,
    "Position, speed and time.",
    "Needs a clear sky for the first fix.",
    [["Interface", "UART"]],
    "NEO-6M GPS"
  ),
  r(
    "rfid-rc522-kit",
    "RC522 RFID Reader Kit (Card + Key Fob)",
    "Kit",
    650,
    "13.56 MHz RFID reader with card and fob.",
    "Door locks and attendance.",
    [
      ["Interface", "SPI"],
      ["Voltage", "3.3 V"],
    ],
    "RC522 RFID"
  ),
  r(
    "rfid-cards-13-56mhz-pack-10",
    "13.56 MHz RFID Cards (Pack of 10)",
    "Pack of 10",
    300,
    "MIFARE Classic 1K cards.",
    "Extra cards for enrolling users.",
    [["Type", "MIFARE Classic 1K"]],
    "MIFARE card"
  ),
  r(
    "pn532-nfc-module",
    "PN532 NFC/RFID Module",
    "Each",
    1500,
    "Reads NFC tags and phones.",
    "Tap-to-pay and NFC projects.",
    [["Interface", "I2C / SPI / UART"]],
    "PN532 NFC"
  ),
  r(
    "rf-433mhz-pair",
    "433 MHz RF Transmitter & Receiver Pair",
    "Kit",
    250,
    "Cheap one-way wireless link.",
    "Remotes and sensors.",
    [["Frequency", "433 MHz"]],
    "433 MHz RF module"
  ),
  r(
    "sim800l-gsm-module",
    "SIM800L GSM/GPRS Module",
    "Each",
    1300,
    "SMS and calls from a microcontroller.",
    "Needs a 3.4–4.4 V supply with 2 A peaks.",
    [["Band", "Quad-band 2G"]],
    "SIM800L"
  ),
  r(
    "esp01-esp8266-pack-2",
    "ESP-01 ESP8266 WiFi Module (Pack of 2)",
    "Pack of 2",
    600,
    "Tiny serial WiFi modules.",
    "Add WiFi to any board over UART.",
    [["Logic", "3.3 V"]],
    "ESP-01"
  ),
  r(
    "esp32-cam-module",
    "ESP32-CAM Module with OV2640",
    "Each",
    1500,
    "WiFi camera board.",
    "Needs a USB-to-TTL adapter.",
    [["Camera", "OV2640, 2 MP"]],
    "ESP32-CAM"
  ),
  r(
    "enc28j60-ethernet-module",
    "ENC28J60 Ethernet Module",
    "Each",
    900,
    "Wired network for Arduino.",
    "Reliable LAN where WiFi is poor.",
    [["Interface", "SPI"]],
    "ENC28J60"
  ),
  r(
    "ir-remote-receiver-kit",
    "IR Remote & Receiver Kit",
    "Kit",
    300,
    "Infrared remote with VS1838 receiver.",
    "Control projects from a handheld remote.",
    [["Carrier", "38 kHz"]],
    "infrared remote control"
  ),

  /* ---- Batch E: wireless and IoT ---- */
  r(
    "ov2640-camera-module",
    "OV2640 Camera Module (2 MP)",
    "Each",
    500,
    "2 MP DVP camera for ESP32-CAM boards.",
    "Replacement or spare camera.",
    [
      ["Sensor", "OV2640, 2 MP"],
      ["Connector", "24-pin FFC"],
    ],
    "OV2640 camera module"
  ),
  r(
    "nrf24l01-pa-lna-radio",
    "nRF24L01+PA+LNA Radio with Antenna",
    "Each",
    800,
    "Long-range 2.4 GHz radio.",
    "Antenna version reaches hundreds of metres line of sight.",
    [
      ["Frequency", "2.4 GHz"],
      ["Interface", "SPI"],
    ],
    "nRF24L01 module"
  ),
  r(
    "hc-12-serial-radio",
    "HC-12 433 MHz Serial Radio",
    "Each",
    650,
    "Wireless serial link over 433 MHz.",
    "Transparent UART replacement for long cable runs.",
    [
      ["Frequency", "433 MHz"],
      ["Interface", "UART"],
    ],
    "HC-12 wireless module"
  ),
  r(
    "rfid-125khz-reader",
    "125 kHz RFID Reader Module (EM4100)",
    "Each",
    650,
    "Low-frequency proximity reader.",
    "Door access with cards and fobs.",
    [
      ["Frequency", "125 kHz"],
      ["Interface", "UART / Wiegand"],
    ],
    "RFID reader module"
  ),
  r(
    "rfid-125khz-cards-pack-10",
    "125 kHz RFID Cards (Pack of 10)",
    "Pack of 10",
    300,
    "EM4100-style proximity cards.",
    "Enroll users on a 125 kHz reader.",
    [["Frequency", "125 kHz"]],
    "proximity card"
  ),
  r(
    "nfc-tags-ntag215-pack-10",
    "NTAG215 NFC Stickers (Pack of 10)",
    "Pack of 10",
    350,
    "Adhesive NFC tags.",
    "Tap-to-open links, Wi-Fi sharing and props.",
    [
      ["Type", "NTAG215"],
      ["Capacity", "504 bytes"],
    ],
    "NFC tag"
  ),
  r(
    "esp01-adapter-board",
    "ESP-01 Programming Adapter Board",
    "Each",
    250,
    "USB-to-serial base for ESP-01 modules.",
    "Flash and test ESP-01s without jumper wires.",
    [["Interface", "USB to UART"]],
    "ESP-01 programmer"
  ),
  r(
    "bluetooth-audio-receiver",
    "Bluetooth Audio Receiver Module",
    "Each",
    700,
    "Streams phone audio to an amplifier.",
    "Makes any speaker wireless over AUX out.",
    [
      ["Output", "3.5 mm / AUX"],
      ["Profile", "A2DP"],
    ],
    "Bluetooth audio receiver"
  ),
  r(
    "antenna-433-sma",
    "433 MHz Rubber Duck Antenna (SMA)",
    "Each",
    350,
    "Quarter-wave stick for 433 MHz links.",
    "Pairs with LoRa and RF modules that have an SMA port.",
    [
      ["Frequency", "433 MHz"],
      ["Connector", "SMA"],
    ],
    "433MHz antenna"
  ),
  r(
    "rf-relay-module-433",
    "433 MHz RF Relay Module",
    "Each",
    550,
    "Two relays driven by a 433 MHz remote.",
    "Switch low-voltage loads from a keyfob; isolate any mains wiring professionally.",
    [
      ["Channels", "2"],
      ["Frequency", "433 MHz"],
    ],
    "RF relay module"
  ),
  r(
    "esp-12f-module",
    "ESP-12F ESP8266 WiFi Module",
    "Each",
    350,
    "Solder-down WiFi module.",
    "Compact WiFi for a permanent product.",
    [
      ["Logic", "3.3 V"],
      ["Flash", "4 MB"],
    ],
    "ESP8266 module"
  ),
  r(
    "esp32-cam-base-board",
    "ESP32-CAM Development Base (USB)",
    "Each",
    450,
    "USB base board for ESP32-CAM.",
    "Upload code and stream video without wiring an adapter.",
    [["Interface", "Micro-USB"]],
    "ESP32-CAM development board"
  ),
  r(
    "rf-remote-4button-433",
    "433 MHz Remote Control, 4-Button",
    "Each",
    300,
    "Keyfob transmitter.",
    "Pairs with 433 MHz receivers and RF relay modules.",
    [
      ["Frequency", "433 MHz"],
      ["Buttons", "4"],
    ],
    "433MHz remote control"
  ),
  r(
    "rfid-keyfobs-13mhz-pack-10",
    "13.56 MHz RFID Key Fobs (Pack of 10)",
    "Pack of 10",
    400,
    "MIFARE Classic fobs.",
    "Weatherproof alternative to cards for RC522 readers.",
    [["Type", "MIFARE Classic 1K"]],
    "RFID key fob"
  ),
  r(
    "ir-remote-17key",
    "Mini IR Remote Control (17 Keys)",
    "Each",
    200,
    "Credit-card-size infrared remote.",
    "Handy second remote for VS1838 receiver kits.",
    [
      ["Carrier", "38 kHz"],
      ["Batteries", "CR2025"],
    ],
    "infrared remote control"
  ),
  r(
    "esp32-wroom-32-module",
    "ESP32-WROOM-32 WiFi Module",
    "Each",
    500,
    "Bare ESP32 module with antenna.",
    "Add WiFi and Bluetooth to a custom board.",
    [
      ["Flash", "4 MB"],
      ["Radio", "WiFi + BLE"],
    ],
    "ESP32 module"
  ),
  r(
    "rf-encoder-pt2262-kit",
    "PT2262/PT2272 RF Encoder Kit",
    "Kit",
    300,
    "Classic remote encoder and decoder chips.",
    "Build your own 433 MHz button transmitter.",
    [
      ["Voltage", "3–12 V"],
      ["Frequency", "433 MHz"],
    ],
    "PT2262 remote control"
  ),
  r(
    "bn220-gps-module",
    "BN-220 GPS Module",
    "Each",
    1500,
    "Compact GPS with GPS and GLONASS.",
    "Vehicle and drone positioning.",
    [
      ["Interface", "UART"],
      ["Constellation", "GPS + GLONASS"],
    ],
    "GPS module"
  ),
  r(
    "wireless-door-sensor-433",
    "433 MHz Wireless Door Sensor",
    "Each",
    500,
    "Magnetic contact with a transmitter.",
    "Sends open/close events to a 433 MHz receiver.",
    [
      ["Frequency", "433 MHz"],
      ["Power", "12 V A23"],
    ],
    "wireless door sensor"
  ),
  r(
    "wireless-pir-tx-433",
    "433 MHz Wireless PIR Transmitter",
    "Each",
    550,
    "Battery PIR that transmits over RF.",
    "Gate and yard alarm node without running cables.",
    [
      ["Frequency", "433 MHz"],
      ["Range", "≈ 100 m"],
    ],
    "wireless PIR sensor"
  ),
  r(
    "bluetooth-audio-transmitter",
    "Bluetooth Audio Transmitter (5.0)",
    "Each",
    750,
    "Sends TV or phone audio to Bluetooth headphones.",
    "Aux or optical in, wireless out.",
    [
      ["Profile", "A2DP"],
      ["Input", "3.5 mm"],
    ],
    "Bluetooth audio transmitter"
  ),
  r(
    "wifi-led-strip-controller",
    "WiFi LED Strip Controller",
    "Each",
    700,
    "Phone control for LED strips.",
    "Dimming and effects from an app over WiFi.",
    [
      ["Voltage", "12 V"],
      ["Current", "5 A"],
    ],
    "WiFi LED controller"
  ),
  r(
    "wireless-doorbell-kit",
    "Wireless Doorbell Kit",
    "Kit",
    550,
    "Battery push button with a plug-in chime.",
    "No door cable needed; several ring tones.",
    [["Range", "≈ 100 m"]],
    "wireless doorbell"
  ),
  r(
    "gps-active-antenna",
    "Active GPS Antenna (SMA)",
    "Each",
    400,
    "Ceramic patch antenna with LNA.",
    "Replaces a lost GPS antenna or extends it on a lead.",
    [
      ["Frequency", "1575 MHz"],
      ["Connector", "SMA"],
    ],
    "GPS antenna"
  ),
  r(
    "ov5640-camera-module",
    "OV5640 Camera Module (5 MP)",
    "Each",
    750,
    "5 MP upgrade camera for ESP32-CAM.",
    "Sharper stills than the stock OV2640.",
    [
      ["Sensor", "OV5640, 5 MP"],
      ["Connector", "24-pin FFC"],
    ],
    "OV5640 camera module"
  )
)

push(
  "prototyping",
  r(
    "830-point-breadboard",
    "830-Point Breadboard",
    "Each",
    350,
    "Full-size solderless breadboard.",
    "Two power rails on each edge.",
    [["Tie points", "830"]],
    "breadboard"
  ),
  r(
    "400-point-mini-breadboard",
    "400-Point Mini Breadboard",
    "Each",
    200,
    "Half-size breadboard.",
    "Fits a Nano and a few parts.",
    [["Tie points", "400"]],
    "mini breadboard"
  ),
  r(
    "170-point-mini-breadboard-pack-5",
    "170-Point Mini Breadboard (Pack of 5)",
    "Pack of 5",
    350,
    "Tiny breadboards for single circuits.",
    "Hand one to each student for a small sub-circuit.",
    [["Tie points", "170 each"]],
    "mini breadboard"
  ),
  r(
    "jumper-wire-set",
    "Jumper Wire Set (M-M / M-F / F-F)",
    "Set",
    250,
    "Assorted jumper wires.",
    "Colour-coded insulation.",
    [["Types", "M-M, M-F, F-F"]],
    "jumper wires"
  ),
  r(
    "jumper-wires-mm-pack-40",
    "Male-to-Male Jumper Wires 20 cm (Pack of 40)",
    "Pack of 40",
    150,
    "Board-to-board jumpers.",
    "Ribbon-style, peel apart.",
    [
      ["Type", "Male-male"],
      ["Length", "20 cm"],
    ],
    "jumper wires"
  ),
  r(
    "jumper-wires-mf-pack-40",
    "Male-to-Female Jumper Wires 20 cm (Pack of 40)",
    "Pack of 40",
    150,
    "Breadboard to modules.",
    "Socket on one end.",
    [
      ["Type", "Male-female"],
      ["Length", "20 cm"],
    ],
    "jumper wires"
  ),
  r(
    "jumper-wires-ff-pack-40",
    "Female-to-Female Jumper Wires 20 cm (Pack of 40)",
    "Pack of 40",
    150,
    "Module to module.",
    "Sockets on both ends.",
    [
      ["Type", "Female-female"],
      ["Length", "20 cm"],
    ],
    "jumper wires"
  ),
  r(
    "perfboard-4x6-pack-5",
    "Double-Sided Perfboard 4×6 cm (Pack of 5)",
    "Pack of 5",
    150,
    "Small perfboards.",
    "Single-chip or sensor circuits.",
    [
      ["Size", "4×6 cm"],
      ["Pitch", "2.54 mm"],
    ],
    "perfboard"
  ),
  r(
    "perfboard-5x7-pack-5",
    "Double-Sided Perfboard 5×7 cm (Pack of 5)",
    "Pack of 5",
    200,
    "Permanent version of a breadboard design.",
    "Plated through-holes.",
    [
      ["Size", "5×7 cm"],
      ["Pitch", "2.54 mm"],
    ],
    "perfboard"
  ),
  r(
    "perfboard-7x9-pack-5",
    "Double-Sided Perfboard 7×9 cm (Pack of 5)",
    "Pack of 5",
    250,
    "Larger perfboard.",
    "Room for a Nano, driver and connectors.",
    [["Size", "7×9 cm"]],
    "perfboard"
  ),
  r(
    "perfboard-9x15-pack-3",
    "Double-Sided Perfboard 9×15 cm (Pack of 3)",
    "Pack of 3",
    300,
    "Large perfboard.",
    "Multi-module builds.",
    [["Size", "9×15 cm"]],
    "perfboard"
  ),
  r(
    "stripboard-pack-3",
    "Stripboard 6.5×14.5 cm (Pack of 3)",
    "Pack of 3",
    300,
    "Copper-strip prototyping board.",
    "Fast layouts for linear circuits.",
    [["Size", "6.5×14.5 cm"]],
    "stripboard"
  ),
  r(
    "breadboard-power-module",
    "Breadboard Power Supply Module 3.3/5 V",
    "Each",
    250,
    "Clean rails from USB or a jack.",
    "Switchable 3.3 V/5 V.",
    [["Input", "6.5 – 12 V or USB"]],
    "breadboard power supply module"
  ),
  r(
    "dupont-crimp-connector-kit-620",
    "Dupont Connector Crimp Kit (620 pcs)",
    "Kit",
    900,
    "Make your own jumper cables.",
    "Housings and crimp pins in assorted sizes.",
    [["Contents", "Housings + pins", 620]],
    "Dupont connector"
  ),

  /* ---- Batch E: prototyping ---- */
  r(
    "solid-jumper-kit-22awg",
    "Solid Jumper Kit 22 AWG (140 pcs)",
    "Kit",
    500,
    "Pre-cut solid wires in mixed lengths.",
    "Point-to-point wiring on stripboard.",
    [
      ["Gauge", "22 AWG"],
      ["Pieces", "140"],
    ],
    "jumper wires"
  ),
  r(
    "stripboard-10x16-pack-3",
    "Stripboard 10×16 cm (Pack of 3)",
    "Pack of 3",
    400,
    "Large copper-strip boards.",
    "Full instrument builds with several ICs.",
    [["Size", "10×16 cm"]],
    "stripboard"
  ),
  r(
    "silicone-jumper-set-120",
    "Silicone Jumper Wires (120 pcs)",
    "Set",
    700,
    "Flexible silicone-lead jumpers.",
    "They flex thousands of cycles without cracking.",
    [
      ["Pieces", "120"],
      ["Type", "M-M / M-F / F-F"],
    ],
    "jumper wires"
  ),
  r(
    "breadboard-830-pack-5",
    "830-Point Breadboard (Pack of 5)",
    "Pack of 5",
    1200,
    "Class packs of full-size breadboards.",
    "One board per bench for a training session.",
    [["Tie points", "830 each"]],
    "breadboard"
  ),
  r(
    "copper-clad-double-5x7",
    "Double-Sided Copper Clad 5×7 cm",
    "Each",
    250,
    "Two-sided blank PCB.",
    "Etch your own double-sided boards.",
    [
      ["Size", "5×7 cm"],
      ["Copper", "Double-sided, 1 oz"],
    ],
    "copper clad board"
  ),
  r(
    "copper-clad-double-9x15",
    "Double-Sided Copper Clad 9×15 cm",
    "Each",
    450,
    "Large two-sided blank PCB.",
    "Etch boards with vias and ground planes.",
    [
      ["Size", "9×15 cm"],
      ["Copper", "Double-sided, 1 oz"],
    ],
    "copper clad board"
  ),
  r(
    "jumper-wires-mf-pack-40-10cm",
    "Male-to-Female Jumper Wires 10 cm (Pack of 40)",
    "Pack of 40",
    150,
    "Short breadboard-to-module jumpers.",
    "Keeps sensor wiring flat and tidy.",
    [
      ["Type", "Male-female"],
      ["Length", "10 cm"],
    ],
    "jumper wires"
  ),
  r(
    "jumper-wires-ff-pack-40-10cm",
    "Female-to-Female Jumper Wires 10 cm (Pack of 40)",
    "Pack of 40",
    150,
    "Short module-to-module jumpers.",
    "Covers IC2 between adjacent modules.",
    [
      ["Type", "Female-female"],
      ["Length", "10 cm"],
    ],
    "jumper wires"
  ),
  r(
    "dupont-crimp-pins-pack-100",
    "Dupont Crimp Pins (Pack of 100)",
    "Pack of 100",
    300,
    "Refill pins for the crimp kit.",
    "Keep making custom jumper leads.",
    [
      ["Pitch", "2.54 mm"],
      ["Type", "Female pins"],
    ],
    "Dupont crimp pin"
  ),
  r(
    "perfboard-10x16-pack-3",
    "Double-Sided Perfboard 10×16 cm (Pack of 3)",
    "Pack of 3",
    450,
    "Large plated perfboards.",
    "Multi-microcontroller permanent builds.",
    [["Size", "10×16 cm"]],
    "perfboard"
  ),
  r(
    "usb-breadboard-power-module",
    "USB Breadboard Power Module",
    "Each",
    300,
    "Powers rails straight from USB.",
    "5 V and 3.3 V rails without a wall adapter.",
    [
      ["Input", "USB 5 V"],
      ["Output", "3.3 V / 5 V"],
    ],
    "breadboard power supply module"
  ),
  r(
    "ribbon-cable-16way-1m",
    "16-Way Ribbon Cable (1 m)",
    "Each",
    300,
    "Flat grey ribbon cable.",
    "IDC ribbon harnesses between boards.",
    [
      ["Conductors", "16"],
      ["Length", "1 m"],
    ],
    "ribbon cable"
  ),
  r(
    "idc-connector-10-pack-5",
    "IDC Ribbon Connector 10-Way (Pack of 5)",
    "Pack of 5",
    300,
    "Insulation-displacement connectors.",
    "Terminate ribbon cable without stripping.",
    [
      ["Positions", "10"],
      ["Pitch", "2.54 mm"],
    ],
    "IDC connector"
  ),
  r(
    "ribbon-cable-40way-1m",
    "40-Way Ribbon Cable (1 m)",
    "Each",
    450,
    "Wide ribbon for buses and keypads.",
    "Full-width data harnesses.",
    [
      ["Conductors", "40"],
      ["Length", "1 m"],
    ],
    "ribbon cable"
  ),
  r(
    "breadboard-400-pack-3",
    "400-Point Mini Breadboard (Pack of 3)",
    "Pack of 3",
    500,
    "Three half-size breadboards.",
    "Split a build into blocks on separate boards.",
    [["Tie points", "400 each"]],
    "mini breadboard"
  ),
  r(
    "jumper-wires-ff-pack-20-30cm",
    "Female-to-Female Jumper Wires 30 cm (Pack of 20)",
    "Pack of 20",
    150,
    "Long module-to-module jumpers.",
    "Reaches across a full-size breadboard.",
    [
      ["Type", "Female-female"],
      ["Length", "30 cm"],
    ],
    "jumper wires"
  ),
  r(
    "jumper-wires-mf-pack-20-30cm",
    "Male-to-Female Jumper Wires 30 cm (Pack of 20)",
    "Pack of 20",
    150,
    "Long breadboard-to-module jumpers.",
    "Sensor on a separate mini board.",
    [
      ["Type", "Male-female"],
      ["Length", "30 cm"],
    ],
    "jumper wires"
  ),
  r(
    "copper-clad-7x9",
    "Copper Clad 7×9 cm (Single-Sided)",
    "Each",
    300,
    "Single-sided blank PCB.",
    "Etch a one-off board at home.",
    [
      ["Size", "7×9 cm"],
      ["Copper", "Single-sided, 1 oz"],
    ],
    "copper clad board"
  ),
  r(
    "idc-connector-16-pack-5",
    "IDC Ribbon Connector 16-Way (Pack of 5)",
    "Pack of 5",
    350,
    "16-way ribbon terminations.",
    "Match the 16-way ribbon cable.",
    [
      ["Positions", "16"],
      ["Pitch", "2.54 mm"],
    ],
    "IDC connector"
  ),
  r(
    "copper-clad-10x16",
    "Copper Clad 10×16 cm (Single-Sided)",
    "Each",
    450,
    "Full-size single-sided blank PCB.",
    "Panel-sized home etching.",
    [
      ["Size", "10×16 cm"],
      ["Copper", "Single-sided, 1 oz"],
    ],
    "copper clad board"
  ),
  r(
    "copper-clad-4x6",
    "Copper Clad 4×6 cm (Single-Sided)",
    "Each",
    200,
    "Small single-sided blank PCB.",
    "One tiny board from a scrap of copper.",
    [
      ["Size", "4×6 cm"],
      ["Copper", "Single-sided, 1 oz"],
    ],
    "copper clad board"
  )
)

push(
  "electrical",
  r(
    "dc-power-supply-5v-2a",
    "5 V 2 A DC Power Supply",
    "Each",
    600,
    "Regulated 5 V supply with barrel connector.",
    "For boards and servos when USB is not enough.",
    [
      ["Output", "5 V, 2 A"],
      ["Connector", "5.5×2.1 mm"],
    ],
    "DC power adapter"
  ),
  r(
    "dc-power-supply-9v-1a",
    "9 V 1 A DC Power Supply",
    "Each",
    600,
    "Standard UNO-friendly adapter.",
    "Plug into the barrel jack.",
    [["Output", "9 V, 1 A"]],
    "DC power adapter"
  ),
  r(
    "dc-power-supply-12v-2a",
    "12 V 2 A DC Power Supply",
    "Each",
    800,
    "Clean 12 V for relays, strips and motors.",
    "Headroom for most project loads.",
    [
      ["Output", "12 V, 2 A"],
      ["Input", "220–240 V AC"],
    ],
    "DC power adapter"
  ),
  r(
    "dc-power-supply-12v-5a",
    "12 V 5 A DC Power Supply",
    "Each",
    1600,
    "Higher-current 12 V supply.",
    "LED strips, pumps and bigger motors.",
    [["Output", "12 V, 5 A"]],
    "DC power adapter"
  ),
  r(
    "18650-battery-holder-2x",
    "18650 Battery Holder — 2 Cell",
    "Each",
    150,
    "Two-slot holder, 7.4 V in series.",
    "Batteries supplied separately.",
    [["Output", "7.4 V nominal"]],
    "18650 battery holder"
  ),
  r(
    "18650-battery-holder-1x-pack-2",
    "18650 Battery Holder — Single (Pack of 2)",
    "Pack of 2",
    150,
    "Single-cell holders with leads.",
    "Fits TP4056 charger builds.",
    [["Output", "3.7 V"]],
    "18650 battery holder"
  ),
  r(
    "li-ion-18650-cell",
    "18650 Li-ion Cell 3.7 V 2000 mAh",
    "Each",
    450,
    "Rechargeable cell.",
    "Charge only with a lithium-rated charger; never short or puncture.",
    [["Capacity", "≈ 2000 mAh"]],
    "18650 battery"
  ),
  r(
    "bms-3s-18650-20a",
    "3S 18650 BMS Protection Board 20 A",
    "Each",
    500,
    "Protects a 3-cell lithium pack.",
    "Over-charge, over-discharge and short-circuit protection.",
    [
      ["Cells", "3S"],
      ["Current", "20 A"],
    ],
    "battery management system"
  ),
  r(
    "battery-clip-9v-pack-10",
    "9 V Battery Clip with Leads (Pack of 10)",
    "Pack of 10",
    200,
    "Snap connectors for 9 V batteries.",
    "Power breadboard and UNO builds.",
    [["Type", "9 V snap"]],
    "9V battery clip"
  ),
  r(
    "aa-battery-holder-4x",
    "4×AA Battery Holder with Switch",
    "Each",
    120,
    "6 V holder with on/off switch.",
    "Servos, motors and chassis.",
    [["Output", "6 V"]],
    "AA battery holder"
  ),
  r(
    "cr2032-battery-pack-5",
    "CR2032 Coin Cell (Pack of 5)",
    "Pack of 5",
    300,
    "3 V lithium coin cells.",
    "Back up an RTC module.",
    [["Voltage", "3 V"]],
    "CR2032 battery"
  ),
  r(
    "tp4056-charger-pack-2",
    "TP4056 Li-ion Charger Module (Pack of 2)",
    "Pack of 2",
    250,
    "USB charger for single 18650 cells.",
    "1 A charge; pick the protected version for battery builds.",
    [["Charge current", "1 A"]],
    "TP4056"
  ),
  r(
    "lm2596-buck-converter",
    "LM2596 Adjustable Buck Converter",
    "Each",
    300,
    "Step voltage down efficiently.",
    "12 V to 5 V without linear-regulator heat.",
    [
      ["Input", "4 – 35 V"],
      ["Current", "3 A"],
    ],
    "LM2596 buck converter"
  ),
  r(
    "mt3608-boost-pack-2",
    "MT3608 Boost Converter (Pack of 2)",
    "Pack of 2",
    250,
    "Step voltage up from a single cell.",
    "3.7 V to 5 V or 9 V.",
    [
      ["Input", "2 – 24 V"],
      ["Current", "2 A"],
    ],
    "boost converter"
  ),
  r(
    "solar-panel-6v-1w",
    "6 V 1 W Mini Solar Panel",
    "Each",
    600,
    "Small panel for solar projects.",
    "Charge a small battery.",
    [["Power", "1 W"]],
    "solar panel"
  ),
  r(
    "fuse-5x20-assorted-pack-50",
    "Glass Fuse 5×20 mm Assorted (Pack of 50)",
    "Pack of 50",
    300,
    "0.5 A to 10 A fuses.",
    "Protect supply lines on every build.",
    [["Contents", "Assorted 0.5–10 A", 50]],
    "glass fuse"
  ),
  r(
    "fuse-holder-5x20-pack-5",
    "5×20 mm Fuse Holder (Pack of 5)",
    "Pack of 5",
    250,
    "Inline fuse holders.",
    "Pair with the fuse assortment.",
    [["Fits", "5×20 mm"]],
    "fuse holder"
  ),
  r(
    "lever-connector-kit-30",
    "Lever Wire Connector Kit (30 pcs)",
    "Kit",
    700,
    "Tool-free 2/3/5-way connectors.",
    "Join wires without soldering.",
    [["Contents", "2/3/5-way", 30]],
    "lever nut connector"
  ),
  r(
    "hookup-wire-kit-22awg",
    "Hookup Wire Kit 22 AWG (6 colours × 5 m)",
    "Kit",
    600,
    "Solid-core wire in six colours.",
    "Strip, solder or breadboard.",
    [
      ["Gauge", "22 AWG"],
      ["Length", "6 × 5 m"],
    ],
    "hookup wire"
  ),
  r(
    "heat-shrink-assorted-328",
    "Heat Shrink Tubing Assorted (328 pcs)",
    "Kit",
    350,
    "Assorted sizes for neat insulated joints.",
    "Everyday bench set.",
    [["Contents", "2:1 shrink", 328]],
    "heat shrink tubing"
  ),
  r(
    "usb-micro-cable-1m",
    "Micro-USB Cable 1 m",
    "Each",
    200,
    "Programs and powers ESP and Pico boards.",
    "Make sure it carries data, not just power.",
    [["Length", "1 m"]],
    "micro USB cable"
  ),
  r(
    "usb-a-b-cable-uno",
    "USB-A to USB-B Cable for UNO/Mega (1 m)",
    "Each",
    250,
    "Program UNO and Mega boards.",
    "Printer-style cable.",
    [["Length", "1 m"]],
    "USB cable"
  ),

  /* ---- Batch E: electrical ---- */
  r(
    "barrier-terminal-strip-12",
    "Barrier Terminal Strip 12-Way",
    "Each",
    350,
    "Screw barrier block for mains and supplies.",
    "Keeps adjacent connections separated; mains wiring must be checked by a qualified person.",
    [
      ["Poles", "12"],
      ["Rating", "15 A 300 V"],
    ],
    "barrier terminal block"
  ),
  r(
    "magnet-wire-0-5mm-100g",
    "Magnet Wire 0.5 mm (100 g)",
    "Each",
    400,
    "Enameled copper wire for coils.",
    "Strip the enamel at the ends with sandpaper or heat.",
    [
      ["Diameter", "0.5 mm"],
      ["Weight", "100 g"],
    ],
    "magnet wire"
  ),
  r(
    "silicone-wire-18awg-pair",
    "Silicone Wire 18 AWG Red/Black (1 m Pair)",
    "Pair",
    350,
    "Flexible high-temperature supply leads.",
    "Battery and ESC wiring that stays flexible.",
    [
      ["Gauge", "18 AWG"],
      ["Length", "2 × 1 m"],
    ],
    "silicone wire"
  ),
  r(
    "solar-charge-cn3791",
    "CN3791 Solar Charge Module",
    "Each",
    650,
    "MPPT solar charger for lithium cells.",
    "Charge a 18650 pack from a small panel.",
    [
      ["Output", "4.2 V Li-ion"],
      ["Current", "5 A"],
    ],
    "solar charge controller"
  ),
  r(
    "battery-capacity-tester",
    "Battery Capacity Tester (ZB2L3)",
    "Each",
    750,
    "Discharge test with an LCD readout.",
    "Measure real capacity of 18650 cells; never leave discharging unattended.",
    [
      ["Load", "10 W"],
      ["Voltage", "1–15 V"],
    ],
    "battery capacity tester"
  ),
  r(
    "hlk-pm01-ac-dc-module",
    "HLK-PM01 5 V 3 W AC-DC Module",
    "Each",
    900,
    "Enclosed mains-to-5 V module.",
    "Mains on the input side — mount it in an enclosure with covered terminals.",
    [
      ["Input", "100–240 V AC"],
      ["Output", "5 V, 3 W"],
    ],
    "AC-DC power supply module"
  ),
  r(
    "bms-1s-dw01-pack-5",
    "1S 18650 Protection Board (Pack of 5)",
    "Pack of 5",
    300,
    "Single-cell DW01 protection boards.",
    "Adds over-charge and short protection to a one-cell pack.",
    [
      ["Cells", "1S"],
      ["Current", "3 A"],
    ],
    "battery management system"
  ),
  r(
    "xl4015-buck-display",
    "XL4015 Buck Converter 5 A with Display",
    "Each",
    750,
    "High-current step-down with a voltmeter.",
    "Set the output on the knob and watch it live.",
    [
      ["Input", "4–38 V"],
      ["Current", "5 A"],
    ],
    "buck converter"
  )
)

push(
  "tools-workshop",
  r(
    "soldering-iron-60w",
    "60 W Soldering Iron",
    "Each",
    1500,
    "Mains iron for through-hole work.",
    "Use with a stand and ventilation.",
    [
      ["Power", "60 W"],
      ["Supply", "220–240 V"],
    ],
    "soldering iron"
  ),
  r(
    "soldering-station-adjustable-60w",
    "Adjustable-Temperature Soldering Iron 60 W",
    "Each",
    2200,
    "Dial the tip temperature from 200–450 °C.",
    "Better control for lead-free work and fine joints.",
    [
      ["Power", "60 W"],
      ["Range", "200–450 °C"],
    ],
    "soldering station"
  ),
  r(
    "soldering-iron-stand",
    "Soldering Iron Stand with Sponge",
    "Each",
    350,
    "Safe resting place for a hot iron.",
    "Includes a cleaning sponge.",
    [["Includes", "Stand + sponge"]],
    "soldering iron stand"
  ),
  r(
    "solder-wire-60-40-100g",
    "Solder Wire 60/40 Rosin Core 0.8 mm (100 g)",
    "Each",
    700,
    "Flux-core solder for electronics.",
    "Use in ventilated spaces.",
    [
      ["Alloy", "60/40"],
      ["Diameter", "0.8 mm"],
    ],
    "solder wire"
  ),
  r(
    "solder-wire-lead-free-100g",
    "Lead-Free Solder 0.8 mm (100 g)",
    "Each",
    900,
    "Sn99.3/Cu0.7 flux-core solder.",
    "Lead-free for classrooms and consumer products.",
    [["Diameter", "0.8 mm"]],
    "solder wire"
  ),
  r(
    "soldering-flux-paste",
    "Soldering Flux Paste (10 g)",
    "Each",
    250,
    "Helps solder flow.",
    "Cleaner tinning and rework.",
    [["Weight", "10 g"]],
    "soldering flux"
  ),
  r(
    "brass-tip-cleaner",
    "Brass Wool Tip Cleaner",
    "Each",
    250,
    "Cleans the tip without cooling it.",
    "Longer tip life than a wet sponge.",
    [["Type", "Brass wool"]],
    "soldering tip cleaner"
  ),
  r(
    "desoldering-pump",
    "Desoldering Pump (Solder Sucker)",
    "Each",
    350,
    "Removes solder when fixing mistakes.",
    "Heat, then press the plunger.",
    [["Type", "Spring plunger"]],
    "desoldering pump"
  ),
  r(
    "desoldering-braid-2mm",
    "Desoldering Braid 2 mm (1.5 m)",
    "Each",
    200,
    "Copper wick for solder cleanup.",
    "Clears bridges and pads.",
    [["Width", "2 mm"]],
    "desoldering braid"
  ),
  r(
    "digital-multimeter",
    "Digital Multimeter",
    "Each",
    1800,
    "Voltage, current, resistance, continuity.",
    "Backlit display and buzzer for troubleshooting.",
    [
      ["Measures", "DC/AC V, DC A, Ω"],
      ["Extras", "Continuity, diode"],
    ],
    "digital multimeter"
  ),
  r(
    "lcr-t4-component-tester",
    "LCR-T4 Transistor / Component Tester",
    "Each",
    2200,
    "Identifies and measures unknown parts.",
    "Reads transistors, diodes, capacitors and resistors.",
    [["Display", "Graphic LCD"]],
    "component tester"
  ),
  r(
    "logic-analyzer-usb-8ch",
    "USB Logic Analyzer 24 MHz 8-Channel",
    "Each",
    1800,
    "Debug I2C, SPI and UART traffic.",
    "Works with PulseView/Sigrok.",
    [
      ["Channels", "8"],
      ["Rate", "24 MHz"],
    ],
    "logic analyzer"
  ),
  r(
    "wire-stripper-tool",
    "Automatic Wire Stripper & Cutter",
    "Each",
    600,
    "Strip insulation without nicking the wire.",
    "0.2–6 mm² capacity.",
    [["Range", "0.2–6 mm²"]],
    "wire stripper"
  ),
  r(
    "flush-cutter-side-cutter",
    "Flush Cutter / Side Cutter",
    "Each",
    400,
    "Clip leads flush to the board.",
    "5 in side cutters.",
    [["Type", "Flush cut"]],
    "diagonal pliers"
  ),
  r(
    "needle-nose-pliers-5in",
    "Needle-Nose Pliers 5 in",
    "Each",
    450,
    "Bend leads and hold small parts.",
    "Fine tips for tight spaces.",
    [["Size", "5 in"]],
    "needle-nose pliers"
  ),
  r(
    "esd-tweezers-pack-4",
    "Precision Tweezers Set (Pack of 4)",
    "Pack of 4",
    300,
    "Handle small and SMD parts.",
    "Straight, curved and flat tips.",
    [["Contents", "4 tweezers", 4]],
    "tweezers"
  ),
  r(
    "helping-hands-stand",
    "Helping Hands with Magnifier",
    "Each",
    700,
    "Holds the board while you solder.",
    "Two clips and a magnifier.",
    [["Includes", "Base, 2 clips, magnifier"]],
    "helping hands soldering"
  ),
  r(
    "precision-screwdriver-set-25",
    "Precision Screwdriver Set (25 pcs)",
    "Kit",
    700,
    "Small bits for electronics.",
    "Covers most board and enclosure screws.",
    [["Contents", "25 bits + handle", 25]],
    "precision screwdriver set"
  ),
  r(
    "hot-glue-gun-20w",
    "Mini Hot Glue Gun 20 W",
    "Each",
    700,
    "Fix components and wires quickly.",
    "Great for chassis and enclosures.",
    [
      ["Power", "20 W"],
      ["Glue", "7 mm sticks"],
    ],
    "hot glue gun"
  ),
  r(
    "hot-glue-sticks-pack-10",
    "Hot Glue Sticks 7 mm (Pack of 10)",
    "Pack of 10",
    200,
    "Refills for the mini glue gun.",
    "Clear 7 mm sticks.",
    [["Diameter", "7 mm"]],
    "hot glue stick"
  ),
  r(
    "digital-caliper-150mm",
    "Digital Caliper 150 mm",
    "Each",
    1200,
    "Measure parts to 0.01 mm.",
    "Check pitch, diameter and thickness.",
    [["Range", "0–150 mm"]],
    "digital caliper"
  ),
  r(
    "safety-glasses",
    "Safety Glasses",
    "Each",
    250,
    "Protect your eyes when soldering and cutting.",
    "Wear whenever clipping leads.",
    [["Type", "Clear polycarbonate"]],
    "safety glasses"
  ),

  /* ---- Batch F: tools and workshop ---- */
  r(
    "solder-wire-0-5mm-50g",
    "Solder Wire 60/40 Rosin Core 0.5 mm (50 g)",
    "Each",
    400,
    "Fine solder for tight joints.",
    "0.5 mm wire for surface-mount and dense boards.",
    [
      ["Alloy", "60/40"],
      ["Diameter", "0.5 mm"],
    ],
    "solder wire"
  ),
  r(
    "soldering-tip-assortment-5",
    "Soldering Iron Tips (Pack of 5)",
    "Pack of 5",
    400,
    "Spare tips in different shapes.",
    "Keep a chisel and a fine conical tip on hand.",
    [
      ["Fits", "900M handles"],
      ["Shapes", "Chisel, conical, bevel"],
    ],
    "soldering iron tip"
  ),
  r(
    "mini-heat-gun-300w",
    "Mini Heat Gun 300 W",
    "Each",
    1400,
    "Hot air for shrink tubing and drying.",
    "Faster and safer than a lighter on heat shrink.",
    [
      ["Power", "300 W"],
      ["Temp", "≈ 250–450 °C"],
    ],
    "heat gun"
  ),
  r(
    "ac-clamp-meter-600a",
    "AC Clamp Meter 600 A",
    "Each",
    2200,
    "Measures AC current without breaking the circuit.",
    "Clamp a live conductor to check motor and lighting loads; qualified persons only on mains.",
    [
      ["Range", "600 A AC"],
      ["Display", "4000 counts"],
    ],
    "clamp meter"
  ),
  r(
    "usb-power-tester",
    "USB Power & Voltage Tester",
    "Each",
    650,
    "Reads voltage, current and capacity of a USB port.",
    "Check chargers and cables before trusting them with a board.",
    [
      ["Measures", "V, A, mAh"],
      ["Ports", "USB-A pass-through"],
    ],
    "USB voltage tester"
  ),
  r(
    "k-type-digital-thermometer",
    "Digital K-Type Thermometer with Probe",
    "Each",
    800,
    "Handheld temperature meter with bead probe.",
    "Soldering tip checks, fridge and water temperatures.",
    [
      ["Range", "−50 to 700 °C"],
      ["Probe", "K-type bead"],
    ],
    "digital thermometer"
  ),
  r(
    "loupe-10x",
    "Illuminated Jeweller's Loupe 10×",
    "Each",
    450,
    "10× magnifier with LED light.",
    "Inspect solder joints and read chip markings.",
    [
      ["Magnification", "10×"],
      ["Light", "LED"],
    ],
    "magnifying glass"
  ),
  r(
    "mini-electric-drill",
    "Mini Electric PCB Drill",
    "Each",
    950,
    "Handheld drill for enclosure and PCB holes.",
    "Use in a drill stand for square holes; wear eye protection.",
    [
      ["Chuck", "0.3–4 mm"],
      ["Speed", "High speed DC"],
    ],
    "mini drill"
  ),
  r(
    "pcb-drill-bits-pack-10",
    "PCB Drill Bits (Pack of 10)",
    "Pack of 10",
    400,
    "0.8–2.0 mm carbide bits.",
    "Drill plated holes without wandering.",
    [
      ["Sizes", "0.8 – 2.0 mm"],
      ["Material", "Carbide"],
    ],
    "PCB drill bit"
  ),
  r(
    "hex-key-set-9",
    "Hex Key Set (9 pcs)",
    "Kit",
    350,
    "Allen keys from 1.5 to 8 mm.",
    "Covers M3–M5 socket screws and standoffs.",
    [
      ["Sizes", "1.5 – 8 mm"],
      ["Pieces", "9"],
    ],
    "hex key set"
  ),
  r(
    "adjustable-wrench-6in",
    "Adjustable Wrench 6 in",
    "Each",
    550,
    "All-purpose jaw wrench.",
    "Fittings, nuts and general bench work.",
    [
      ["Size", "6 in"],
      ["Capacity", "20 mm"],
    ],
    "adjustable wrench"
  ),
  r(
    "crimping-tool-dupont-jst",
    "Crimping Tool for Dupont & JST",
    "Each",
    800,
    "Ratcheting crimper for 2.54 mm pins.",
    "Makes reliable jumper and JST cables.",
    [
      ["Accepts", "0.5 – 1.5 mm²"],
      ["Types", "Dupont, JST-XH"],
    ],
    "crimping tool"
  ),
  r(
    "hot-glue-gun-40w",
    "Hot Glue Gun 40 W",
    "Each",
    900,
    "Full-size glue gun for bigger builds.",
    "Faster melt than the 20 W mini for chassis work.",
    [
      ["Power", "40 W"],
      ["Glue", "11 mm sticks"],
    ],
    "hot glue gun"
  ),
  r(
    "solder-fume-extractor",
    "Solder Fume Extractor Fan",
    "Each",
    1100,
    "Draws flux smoke away from your face.",
    "Position it beside the board; replace the carbon filter regularly.",
    [
      ["Power", "USB"],
      ["Filter", "Activated carbon"],
    ],
    "fume extractor"
  ),
  r(
    "anti-static-wrist-strap",
    "Anti-Static Wrist Strap",
    "Each",
    350,
    "Earths you to the bench while handling boards.",
    "Clip the lead to a grounded point before touching ICs.",
    [
      ["Lead", "1 MΩ resistor"],
      ["Adjustable", "Yes"],
    ],
    "anti static wrist strap"
  ),
  r(
    "step-drill-bit-4-20",
    "Step Drill Bit 4–20 mm",
    "Each",
    700,
    "One bit for growing clean holes in plastic and sheet metal.",
    "Perfect for panel glands and button cut-outs.",
    [
      ["Range", "4 – 20 mm"],
      ["Steps", "6"],
    ],
    "step drill bit"
  ),
  r(
    "screwdriver-set-6",
    "Screwdriver Set (6 pcs)",
    "Kit",
    500,
    "Phillips and flat drivers for enclosure screws.",
    "Everyday sizes for project boxes.",
    [["Contents", "3 Phillips + 3 flat", 6]],
    "screwdriver set"
  ),
  r(
    "slip-joint-pliers-6in",
    "Slip-Joint Pliers 6 in",
    "Each",
    500,
    "Gripping and turning pliers.",
    "General-purpose bench pliers.",
    [["Size", "6 in"]],
    "slip joint pliers"
  ),
  r(
    "steel-ruler-300",
    "Steel Ruler 300 mm",
    "Each",
    350,
    "Stainless ruler with metric and imperial marks.",
    "Layout panel cut-outs and check dimensions.",
    [
      ["Length", "300 mm"],
      ["Material", "Stainless steel"],
    ],
    "steel ruler"
  ),
  r(
    "flux-pen-8ml",
    "Soldering Flux Pen (8 ml)",
    "Each",
    350,
    "Brush-tip flux for rework.",
    "Precise flux on pads before drag soldering.",
    [
      ["Volume", "8 ml"],
      ["Type", "No-clean"],
    ],
    "soldering flux pen"
  ),
  r(
    "thermal-paste-3g",
    "Thermal Paste 3 g",
    "Each",
    350,
    "Heat compound for regulators and drivers.",
    "Thin layer between a TO-220 and its heatsink.",
    [
      ["Weight", "3 g"],
      ["Conductivity", "Standard silicone"],
    ],
    "thermal paste"
  ),
  r(
    "file-set-4",
    "Needle File Set (4 pcs)",
    "Kit",
    450,
    "Flat, round, half-round and triangular files.",
    "Trim plastic burrs and enlarge panel holes.",
    [
      ["Shapes", "4"],
      ["Material", "Carbon steel"],
    ],
    "file set"
  ),
  r(
    "hacksaw-frame-12in",
    "Hacksaw Frame 12 in",
    "Each",
    550,
    "Cuts perfboard, acrylic and aluminium.",
    "Use fine-tooth blade on plastic to avoid cracking.",
    [["Blade", "12 in, 24 TPI"]],
    "hacksaw"
  ),
  r(
    "utility-knife",
    "Utility Knife",
    "Each",
    400,
    "Snap-blade knife for scoring and stripping.",
    "Score acrylic before snapping it.",
    [["Blades", "Refillable"]],
    "utility knife"
  ),
  r(
    "cutting-mat-a4",
    "Self-Healing Cutting Mat A4",
    "Each",
    600,
    "Protects the bench and blades.",
    "Cut heat shrink, ribbon and sheet plastic on it.",
    [
      ["Size", "A4"],
      ["Layers", "3-ply"],
    ],
    "cutting mat"
  ),
  r(
    "super-glue-5g",
    "Super Glue 5 g",
    "Each",
    350,
    "Fast bonds for plastics and small parts.",
    "Works on acrylic; hold for 30 seconds.",
    [
      ["Volume", "5 g"],
      ["Type", "Cyanoacrylate"],
    ],
    "super glue"
  ),
  r(
    "mini-grabber-clips-pack-10",
    "Mini Grabber Test Clips (Pack of 10)",
    "Pack of 10",
    450,
    "Spring hooks for probing live circuits.",
    "Clip onto header pins without hands.",
    [
      ["Lead", "10 cm"],
      ["Type", "Mini hook"],
    ],
    "test clip"
  ),
  r(
    "ic-extractor-dip",
    "DIP IC Extractor",
    "Each",
    350,
    "Pulls chips out of sockets safely.",
    "Avoids bending pins and cracking packages.",
    [["Fits", "DIP-8 to DIP-40"]],
    "IC extractor"
  )
)

push(
  "enclosures-hardware",
  r(
    "abs-project-box-100x60x25",
    "ABS Project Box 100×60×25 mm",
    "Each",
    300,
    "Small box for a Nano project.",
    "Screw-lid enclosure.",
    [["Size", "100×60×25 mm"]],
    "plastic project box"
  ),
  r(
    "abs-project-box-150x90x45",
    "ABS Project Box 150×90×45 mm",
    "Each",
    450,
    "Box for UNO builds and relay boards.",
    "Screw-lid enclosure.",
    [["Size", "150×90×45 mm"]],
    "plastic project box"
  ),
  r(
    "abs-project-box-200x120x75",
    "ABS Project Box 200×120×75 mm",
    "Each",
    800,
    "Large box for multi-module panels.",
    "Room for a Mega, relays and power supply.",
    [["Size", "200×120×75 mm"]],
    "plastic project box"
  ),
  r(
    "m3-standoff-screw-kit-120",
    "M3 Standoff & Screw Kit (120 pcs)",
    "Kit",
    500,
    "Mount boards in enclosures.",
    "Brass standoffs, screws and nuts.",
    [["Contents", "Standoffs, screws, nuts", 120]],
    "standoff spacer"
  ),
  r(
    "m3-screw-assortment-300",
    "M3 Screw & Nut Assortment (300 pcs)",
    "Kit",
    400,
    "Stock of M3 screws and nuts.",
    "Compartment box.",
    [["Contents", "Assorted M3", 300]],
    "machine screw"
  ),
  r(
    "cable-gland-pg7-pack-10",
    "Cable Gland PG7 (Pack of 10)",
    "Pack of 10",
    300,
    "Strain relief for cables entering a box.",
    "Keeps dust out and wires secure.",
    [["Size", "PG7"]],
    "cable gland"
  ),
  r(
    "rubber-feet-pack-20",
    "Self-Adhesive Rubber Feet (Pack of 20)",
    "Pack of 20",
    150,
    "Stop projects sliding on the desk.",
    "Stick to the base of an enclosure.",
    [["Type", "Adhesive"]],
    "rubber feet"
  ),
  r(
    "knob-for-pot-pack-5",
    "Potentiometer Knob (Pack of 5)",
    "Pack of 5",
    200,
    "Finish dials neatly.",
    "Fits 6 mm shafts.",
    [["Fits", "6 mm shaft"]],
    "potentiometer knob"
  ),
  r(
    "heatsink-to220-pack-5",
    "TO-220 Heatsink (Pack of 5)",
    "Pack of 5",
    250,
    "Cool regulators and MOSFETs.",
    "Bolt to a TO-220 part.",
    [["Fits", "TO-220"]],
    "heat sink"
  ),

  /* ---- Batch F: enclosures and hardware ---- */
  r(
    "abs-project-box-80x50x20",
    "ABS Project Box 80×50×20 mm",
    "Each",
    250,
    "Pocket-size box for a single board.",
    "Screw-lid enclosure for sensors and timers.",
    [["Size", "80×50×20 mm"]],
    "plastic project box"
  ),
  r(
    "waterproof-junction-box-150x110x70",
    "IP65 Waterproof Junction Box 150×110×70 mm",
    "Each",
    650,
    "Sealed outdoor box with cable glands.",
    "Weatherproof housing for irrigation and gate controllers.",
    [
      ["Size", "150×110×70 mm"],
      ["Rating", "IP65"],
    ],
    "waterproof junction box"
  ),
  r(
    "component-organizer-box-40",
    "Component Organizer Box (40 compartments)",
    "Each",
    450,
    "Divided storage for small parts.",
    "Sort resistors, screws and connectors.",
    [
      ["Compartments", "40"],
      ["Size", "280×180×40 mm"],
    ],
    "parts organizer box"
  ),
  r(
    "heatsink-assortment-pack-10",
    "Heatsink Assortment (Pack of 10)",
    "Pack of 10",
    350,
    "Mixed aluminium heatsinks for TO-220 and ICs.",
    "Keep a size for every regulator.",
    [["Contents", "TO-220 and IC sizes", 10]],
    "heat sink"
  ),
  r(
    "thermal-pad-pack-5",
    "Silicone Thermal Pads (Pack of 5)",
    "Pack of 5",
    300,
    "Soft pads that bridge a chip and a case.",
    "Better than paste when parts move.",
    [
      ["Size", "20×20 mm"],
      ["Thickness", "1 mm"],
    ],
    "thermal pad"
  ),
  r(
    "nylon-screw-m3-pack-20",
    "Nylon M3 Screw & Nut (Pack of 20)",
    "Pack of 20",
    250,
    "Insulating plastic screws.",
    "Mount PCBs where metal screws would short tracks.",
    [
      ["Thread", "M3"],
      ["Material", "Nylon"],
    ],
    "nylon screw"
  ),
  r(
    "adhesive-cable-mounts-pack-10",
    "Adhesive Cable Mounts (Pack of 10)",
    "Pack of 10",
    300,
    "Stick-down P-clips for looms.",
    "Route cables inside a box without drilling.",
    [
      ["Fits", "3–6 mm cable"],
      ["Fixing", "3M adhesive"],
    ],
    "adhesive cable clip"
  ),
  r(
    "spiral-wrap-10mm-5m",
    "Spiral Cable Wrap 10 mm (5 m)",
    "Each",
    350,
    "Bundles cables into one neat loom.",
    "Wrap a harness and peel it open to add wires later.",
    [
      ["Diameter", "10 mm"],
      ["Length", "5 m"],
    ],
    "spiral cable wrap"
  ),
  r(
    "cable-gland-pg16-pack-5",
    "Cable Gland PG16 (Pack of 5)",
    "Pack of 5",
    300,
    "Larger glands for thick mains or motor leads.",
    "Use where PG13.5 is too tight.",
    [["Size", "PG16"]],
    "cable gland"
  ),
  r(
    "wall-plug-screw-kit-m6",
    "Wall Plug & Screw Kit M6 (Pack of 20)",
    "Pack of 20",
    350,
    "Fix enclosures to masonry.",
    "Plugs and screws for mounting junction boxes.",
    [
      ["Thread", "M6"],
      ["Pieces", "20"],
    ],
    "wall plug screw"
  ),
  r(
    "die-cast-aluminium-enclosure-120x60x40",
    "Die-Cast Aluminium Enclosure 120×60×40 mm",
    "Each",
    750,
    "Metal box that shields and dissipates heat.",
    "For power electronics that need cooling.",
    [
      ["Size", "120×60×40 mm"],
      ["Material", "Aluminium"],
    ],
    "aluminium enclosure"
  ),
  r(
    "u-nuts-m3-pack-10",
    "Sheet Metal U-Nuts M3 (Pack of 10)",
    "Pack of 10",
    300,
    "Spring clips that add a thread to sheet metal.",
    "Mount boards to thin panels without tapping.",
    [
      ["Thread", "M3"],
      ["Fits", "0.5–2 mm sheet"],
    ],
    "U nut clip"
  ),
  r(
    "brass-inserts-m3-pack-20",
    "Brass Threaded Inserts M3 (Pack of 20)",
    "Pack of 20",
    350,
    "Heat-set inserts for printed and plastic cases.",
    "Press in with a soldering iron, then screw.",
    [
      ["Thread", "M3"],
      ["OD", "4.6 mm"],
    ],
    "threaded insert"
  ),
  r(
    "magnetic-catch-pack-2",
    "Magnetic Lid Catch (Pack of 2)",
    "Pack of 2",
    300,
    "Screw-on magnets for tool-free lids.",
    "Snap covers and battery doors without hinges.",
    [
      ["Pull", "≈ 1 kg each"],
      ["Fixing", "M3 screws"],
    ],
    "magnetic catch"
  ),
  r(
    "thumb-screw-m3-pack-10",
    "M3 Thumb Screw (Pack of 10)",
    "Pack of 10",
    350,
    "Knurled heads for tool-free lids.",
    "Hand-tighten covers you open often.",
    [
      ["Thread", "M3"],
      ["Head", "Plastic knurled"],
    ],
    "thumb screw"
  ),
  r(
    "p-clips-pack-10",
    "Nylon P-Clips 10 mm (Pack of 10)",
    "Pack of 10",
    300,
    "Screw-down cable loops.",
    "Strain relief where a cable enters a box.",
    [
      ["Fits", "10 mm cable"],
      ["Fixing", "M4"],
    ],
    "P clip cable"
  ),
  r(
    "acrylic-sheet-3mm-a5",
    "Acrylic Sheet 3 mm (A5)",
    "Each",
    400,
    "Clear panel stock for windows and mounts.",
    "Score with a knife and snap, or drill slowly.",
    [
      ["Size", "A5"],
      ["Thickness", "3 mm"],
    ],
    "acrylic sheet"
  ),
  r(
    "enclosure-vent-filter-60",
    "Enclosure Vent Filter 60 mm",
    "Each",
    350,
    "Dust filter for fan openings.",
    "Keeps lint out of vented boxes.",
    [
      ["Size", "60×60 mm"],
      ["Type", "Washable mesh"],
    ],
    "dust filter fan"
  ),
  r(
    "cable-grommet-pack-10",
    "Rubber Cable Grommets (Pack of 10)",
    "Pack of 10",
    300,
    "Protect cables passing through panel holes.",
    "Stops sharp edges cutting insulation.",
    [
      ["Fits", "6 – 16 mm"],
      ["Material", "Rubber"],
    ],
    "cable grommet"
  )
)

push(
  "robotics-automation",
  r(
    "mini-water-pump-5v",
    "Mini Submersible Water Pump — 5 V",
    "Each",
    500,
    "Small 5 V DC pump.",
    "Switch through a relay or MOSFET.",
    [
      ["Voltage", "5 V DC"],
      ["Style", "Submersible"],
    ],
    "submersible water pump"
  ),
  r(
    "diaphragm-pump-12v",
    "12 V Diaphragm Water Pump",
    "Each",
    1400,
    "Self-priming pump for dispensers and irrigation.",
    "Higher pressure than the mini pump.",
    [["Voltage", "12 V DC"]],
    "diaphragm pump"
  ),
  r(
    "solenoid-valve-12v",
    "12 V Solenoid Water Valve",
    "Each",
    900,
    "Electric valve for irrigation.",
    "Use a relay or MOSFET with a flyback diode.",
    [
      ["Voltage", "12 V DC"],
      ["Type", "Normally closed"],
    ],
    "solenoid valve"
  ),
  r(
    "sg90-micro-servo",
    "SG90 Micro Servo Motor",
    "Each",
    350,
    "9 g hobby servo.",
    "The standard servo for beginner robotics.",
    [
      ["Torque", "1.8 kg·cm"],
      ["Rotation", "≈ 180°"],
    ],
    "SG90 servo"
  ),
  r(
    "mg90s-metal-servo",
    "MG90S Metal-Gear Micro Servo",
    "Each",
    550,
    "Stronger micro servo.",
    "Metal gears for arms and flaps.",
    [["Torque", "2.2 kg·cm"]],
    "MG90S servo"
  ),
  r(
    "mg996r-servo",
    "MG996R High-Torque Servo",
    "Each",
    900,
    "Metal-gear servo for robot arms.",
    "Power from a separate supply.",
    [["Torque", "9.4 kg·cm"]],
    "MG996R servo"
  ),
  r(
    "fs90r-continuous-servo",
    "FS90R Continuous Rotation Servo",
    "Each",
    600,
    "Servo that spins freely.",
    "Wheels for small robots.",
    [["Rotation", "Continuous"]],
    "continuous rotation servo"
  ),
  r(
    "tt-gear-motor-wheel-pack-2",
    "TT Gear Motor with Wheel (Pack of 2)",
    "Pack of 2",
    500,
    "Yellow geared motors with wheels.",
    "The standard robot-car pair.",
    [
      ["Voltage", "3–6 V"],
      ["Contents", "2 motors + 2 wheels", 2],
    ],
    "TT gear motor"
  ),
  r(
    "n20-gear-motor-pack-2",
    "N20 Micro Gear Motor 6 V (Pack of 2)",
    "Pack of 2",
    700,
    "Tiny geared motors.",
    "Mini robots and sumo bots.",
    [["Voltage", "6 V"]],
    "N20 motor"
  ),
  r(
    "dc-motor-130-pack-2",
    "130 DC Hobby Motor (Pack of 2)",
    "Pack of 2",
    200,
    "Small DC motors for toys and fans.",
    "Drive through a transistor or L9110S.",
    [["Voltage", "3–6 V"]],
    "DC motor"
  ),
  r(
    "vibration-motor-pack-5",
    "Coin Vibration Motor (Pack of 5)",
    "Pack of 5",
    300,
    "Haptic feedback motors.",
    "Wearables and alerts.",
    [["Voltage", "3 V"]],
    "vibration motor"
  ),
  r(
    "stepper-28byj-48-uln2003",
    "28BYJ-48 Stepper Motor with ULN2003 Driver",
    "Kit",
    450,
    "Geared stepper with driver board.",
    "Slow, precise rotation.",
    [["Steps", "2048 per rev"]],
    "28BYJ-48 stepper"
  ),
  r(
    "nema17-stepper-motor",
    "NEMA 17 Stepper Motor",
    "Each",
    1800,
    "Bipolar stepper for CNC and printers.",
    "Pair with an A4988 and 12 V.",
    [
      ["Step angle", "1.8°"],
      ["Current", "1.5 A"],
    ],
    "NEMA 17"
  ),
  r(
    "robot-chassis-2wd-kit",
    "2WD Robot Car Chassis Kit",
    "Kit",
    1500,
    "Acrylic chassis with motors, wheels and caster.",
    "Add a UNO, driver and batteries.",
    [["Includes", "Chassis, 2 motors, 2 wheels, caster"]],
    "robot chassis"
  ),
  r(
    "robot-chassis-4wd-kit",
    "4WD Robot Car Chassis Kit",
    "Kit",
    2800,
    "Four-motor chassis.",
    "More traction and load capacity.",
    [["Includes", "Chassis, 4 motors, 4 wheels"]],
    "4WD robot chassis"
  ),
  r(
    "robotic-arm-4dof-kit",
    "4-DOF Acrylic Robotic Arm Kit",
    "Kit",
    3500,
    "Assemble-it-yourself arm frame.",
    "Add 4 servos and a PCA9685 for a working arm.",
    [["Degrees of freedom", "4"]],
    "robotic arm"
  ),
  r(
    "mecanum-wheel-set-60mm",
    "60 mm Mecanum Wheel Set (4 wheels)",
    "Set",
    3500,
    "Holonomic wheels for sideways motion.",
    "Omnidirectional robot platforms.",
    [["Diameter", "60 mm"]],
    "mecanum wheel"
  ),
  r(
    "ball-caster-wheel-pack-2",
    "Ball Caster Wheel (Pack of 2)",
    "Pack of 2",
    200,
    "Support wheels for two-wheel robots.",
    "Lets a 2WD chassis turn freely.",
    [["Mount", "M3"]],
    "ball caster"
  ),
  r(
    "dc-fan-5v-40mm",
    "5 V 40 mm DC Cooling Fan",
    "Each",
    350,
    "Small fan for cooling enclosures.",
    "Switch with a MOSFET for temperature control.",
    [
      ["Voltage", "5 V DC"],
      ["Size", "40 mm"],
    ],
    "computer fan"
  ),

  /* ---- Batch F: robotics and automation ---- */
  r(
    "l9110s-driver-pack-2",
    "L9110S Motor Driver (Pack of 2)",
    "Pack of 2",
    400,
    "Tiny dual H-bridge boards.",
    "Drive two small motors or one stepper from 2.5–12 V.",
    [
      ["Supply", "2.5 – 12 V"],
      ["Channels", "2"],
    ],
    "motor driver module"
  ),
  r(
    "servo-horn-set-pack-10",
    "Servo Horn Set (Pack of 10)",
    "Pack of 10",
    300,
    "Round, single-arm and bar horns.",
    "Spares when a horn strips or a build needs a different arm.",
    [
      ["Fits", "Micro and standard servos"],
      ["Pieces", "10"],
    ],
    "servo horn"
  ),
  r(
    "servo-bracket-mg996r",
    "Servo Mounting Bracket for MG996R",
    "Each",
    400,
    "U-bracket and arm for standard servos.",
    "Mounts a 906-style servo to a chassis edge.",
    [
      ["Fits", "MG996R / 996 size"],
      ["Material", "Metal"],
    ],
    "servo bracket"
  ),
  r(
    "jgb37-520-gear-motor",
    "JGB37-520 Gear Motor 12 V",
    "Each",
    850,
    "Metal-geared motor with decent torque.",
    "Wheels, small vehicles and winches.",
    [
      ["Voltage", "12 V DC"],
      ["Shaft", "6 mm D-shaft"],
    ],
    "gear motor"
  ),
  r(
    "tt-gear-motor-encoder-pack-2",
    "TT Gear Motor with Encoder (Pack of 2)",
    "Pack of 2",
    800,
    "Yellow motors with hall encoders.",
    "Closed-loop speed and distance for robot cars.",
    [
      ["Voltage", "3–6 V"],
      ["Encoder", "20 pulses/rev"],
    ],
    "TT gear motor"
  ),
  r(
    "mini-air-pump-3v",
    "Mini Air Pump 3 V",
    "Each",
    400,
    "Tiny diaphragm pump for air.",
    "Bubble sensors, small aeration and pneumatic tricks.",
    [
      ["Voltage", "3 V DC"],
      ["Type", "Diaphragm"],
    ],
    "air pump"
  ),
  r(
    "pan-tilt-bracket-sg90",
    "Pan-Tilt Bracket with SG90 Servos",
    "Kit",
    900,
    "Two-axis bracket and micro servos.",
    "Camera and sensor aiming platform.",
    [
      ["Axes", "2"],
      ["Servos", "2 × SG90"],
    ],
    "pan tilt bracket"
  ),
  r(
    "robot-wheel-65mm-pack-2",
    "Robot Wheel 65 mm (Pack of 2)",
    "Pack of 2",
    350,
    "Rubber-tyre wheels with hex hubs.",
    "Fits TT gear motors.",
    [
      ["Diameter", "65 mm"],
      ["Bore", "Hex for TT"],
    ],
    "robot wheel"
  ),
  r(
    "omni-wheel-48mm-pack-4",
    "Omni Wheel 48 mm (Pack of 4)",
    "Pack of 4",
    1400,
    "Wheels with rollers at the rim.",
    "Build mecanum or holonomic bases.",
    [
      ["Diameter", "48 mm"],
      ["Pieces", "4"],
    ],
    "omni wheel"
  ),
  r(
    "tt-motor-mount-pack-4",
    "TT Gear Motor Mount (Pack of 4)",
    "Pack of 4",
    350,
    "Clamps for yellow TT motors.",
    "Bolt motors to a chassis without cable ties.",
    [
      ["Fits", "TT gear motor"],
      ["Fixing", "M3"],
    ],
    "motor mount bracket"
  ),
  r(
    "robot-tank-tracks-pack-2",
    "Robot Tank Tracks (Pack of 2)",
    "Pack of 2",
    1200,
    "Rubber tracks for tracked robots.",
    "Grip on loose ground where wheels slip.",
    [
      ["Fits", "TT motors"],
      ["Length", "≈ 125 mm each"],
    ],
    "robot tank track"
  ),
  r(
    "tank-chassis-kit",
    "Tank Robot Chassis Kit with Tracks",
    "Kit",
    3200,
    "Tracked base with gear motors and wheels.",
    "All-terrain platform for an obstacle robot.",
    [["Includes", "Chassis, 2 motors, tracks, wheels"]],
    "tank robot chassis"
  ),
  r(
    "line-tracking-array-8ch",
    "8-Channel Line Tracking Sensor Array",
    "Each",
    850,
    "Eight reflectance sensors on one bar.",
    "Follows crossings and junctions better than a single sensor.",
    [
      ["Channels", "8"],
      ["Interface", "Digital"],
    ],
    "line tracking sensor"
  ),
  r(
    "push-pull-solenoid-12v",
    "Push-Pull Solenoid 12 V",
    "Each",
    850,
    "Linear actuator that pulls and pushes.",
    "Latches, ejectors and small pneumatic-style actions.",
    [
      ["Voltage", "12 V DC"],
      ["Stroke", "15 mm"],
    ],
    "push pull solenoid"
  ),
  r(
    "hc-sr04-mount-bracket",
    "HC-SR04 Mounting Bracket",
    "Each",
    250,
    "Plastic tilt mount for the ultrasonic sensor.",
    "Aim the sensor without glue.",
    [
      ["Fits", "HC-SR04"],
      ["Fixing", "M3"],
    ],
    "sensor bracket"
  ),
  r(
    "robot-gripper-claw-kit",
    "Servo Gripper Claw Kit",
    "Kit",
    900,
    "Parallel jaw gripper driven by a servo.",
    "Add to a robot arm for pick-and-place.",
    [
      ["Servo", "SG90 or MG90S"],
      ["Jaws", "2"],
    ],
    "robot gripper"
  ),
  r(
    "line-follower-robot-kit",
    "Line Follower Robot Kit",
    "Kit",
    3800,
    "Chassis, board, driver and line sensors.",
    "The classic first build: follow a black line on white.",
    [["Includes", "UNO, chassis, motors, line sensor, driver"]],
    "line following robot"
  ),
  r(
    "sg90-servo-pack-4",
    "SG90 Micro Servo (Pack of 4)",
    "Pack of 4",
    1300,
    "Four micro servos for the price of three.",
    "Class sets and multi-axis builds.",
    [
      ["Torque", "1.8 kg·cm"],
      ["Pieces", "4"],
    ],
    "SG90 servo"
  ),
  r(
    "tt-gear-motor-pack-4",
    "TT Gear Motor (Pack of 4)",
    "Pack of 4",
    850,
    "Four yellow geared motors.",
    "Spares for a 4WD chassis or a second car.",
    [
      ["Voltage", "3–6 V"],
      ["Pieces", "4"],
    ],
    "TT gear motor"
  ),
  r(
    "robot-wheel-83mm-pack-2",
    "Robot Wheel 83 mm (Pack of 2)",
    "Pack of 2",
    450,
    "Larger wheels for speed and clearance.",
    "Direct-drive on 520-style gear motors.",
    [
      ["Diameter", "83 mm"],
      ["Bore", "6 mm"],
    ],
    "robot wheel"
  ),
  r(
    "robot-base-plate-round",
    "Round Robot Base Plate 150 mm",
    "Each",
    450,
    "Acrylic deck for stacking modules.",
    "Drilled grid for standoffs and sensors.",
    [
      ["Diameter", "150 mm"],
      ["Material", "Acrylic"],
    ],
    "robot base plate"
  ),
  r(
    "cycle-timer-module",
    "Cycle Timer Module (XY-LJ02)",
    "Each",
    700,
    "Programmable on/off interval switching.",
    "Pump, feed and irrigation cycles without code.",
    [
      ["Voltage", "12 – 30 V"],
      ["Range", "0.1 s – 99 h"],
    ],
    "cycle timer"
  ),
  r(
    "servo-drive-wheel",
    "Drive Wheel for Continuous Servo",
    "Each",
    350,
    "Wheel that mounts straight onto an FS90R shaft.",
    "Simplest possible rolling robot.",
    [
      ["Fits", "FS90R spline"],
      ["Diameter", "60 mm"],
    ],
    "servo wheel"
  ),
  r(
    "gear-motor-6v-double-shaft",
    "6 V Double-Shaft Gear Motor",
    "Each",
    650,
    "Small 25 mm gear motor with both shafts out.",
    "Drive one wheel and fit an encoder disc.",
    [
      ["Voltage", "6 V DC"],
      ["Shaft", "Double-sided"],
    ],
    "gear motor"
  ),
  r(
    "peristaltic-pump-12v",
    "Peristaltic Pump 12 V",
    "Each",
    1800,
    "Pump that never touches the liquid.",
    "Dosing fertiliser, soap or test fluids cleanly.",
    [
      ["Voltage", "12 V DC"],
      ["Flow", "≈ 100 ml/min"],
    ],
    "peristaltic pump"
  ),
  r(
    "esp32-robot-car-kit",
    "ESP32 WiFi Robot Car Kit",
    "Kit",
    5000,
    "ESP32 car with app or web control.",
    "Drive it from a phone over WiFi.",
    [["Includes", "ESP32, chassis, motors, driver, battery box"]],
    "WiFi robot car"
  ),
  r(
    "servo-extension-cables-pack-5",
    "Servo Extension Cables (Pack of 5)",
    "Pack of 5",
    300,
    "30 cm extensions in assorted genders.",
    "Reach distant servos without cutting wires.",
    [
      ["Length", "30 cm"],
      ["Pieces", "5"],
    ],
    "servo extension cable"
  ),
  r(
    "wheel-encoder-pack-2",
    "Wheel Encoders for TT Motors (Pack of 2)",
    "Pack of 2",
    450,
    "Photoelectric discs and boards.",
    "Add odometry to plain TT motors.",
    [
      ["Sensors", "Infrared pair"],
      ["Pieces", "2"],
    ],
    "wheel encoder"
  ),
  r(
    "electromagnetic-door-lock-12v",
    "Electromagnetic Door Lock 12 V",
    "Each",
    950,
    "50 kg fail-safe strike lock.",
    "Gate and cabinet access control; power must be present to stay locked.",
    [
      ["Holding force", "50 kg"],
      ["Voltage", "12 V DC"],
    ],
    "electromagnetic lock"
  ),
  r(
    "water-leak-sensor-cable",
    "Water Leak Sensor Cable (5 m)",
    "Each",
    600,
    "Bare-wire detection strip.",
    "Lay it along a floor to catch leaks early.",
    [
      ["Length", "5 m"],
      ["Type", "Resistive"],
    ],
    "water leak sensor"
  ),
  r(
    "timer-relay-12v",
    "12 V Multi-Function Timer Relay",
    "Each",
    650,
    "Delay-on, delay-off and cycle modes.",
    "Automate delays on pumps and alarms.",
    [
      ["Voltage", "12 V DC"],
      ["Range", "0.1 s – 6 h"],
    ],
    "timer relay"
  ),
  r(
    "shaft-couplings-pack-5",
    "Shaft Couplings 5×8 mm (Pack of 5)",
    "Pack of 5",
    350,
    "Flexible aluminium couplings.",
    "Join a motor shaft to a lead screw.",
    [
      ["Fits", "5 mm to 8 mm"],
      ["Pieces", "5"],
    ],
    "shaft coupling"
  ),
  r(
    "n20-gear-motor-encoder-pack-2",
    "N20 Gear Motor with Encoder (Pack of 2)",
    "Pack of 2",
    1300,
    "Micro motors with quadrature feedback.",
    "Precise small robots and instruments.",
    [
      ["Voltage", "6 V DC"],
      ["Encoder", "11 pulses/rev"],
    ],
    "N20 motor"
  ),
  r(
    "arduino-mounting-plate",
    "UNO Mounting Plate",
    "Each",
    400,
    "Acrylic plate pre-drilled for UNO holes.",
    "Frees the board from a breadboard base.",
    [
      ["Fits", "UNO R3"],
      ["Material", "Acrylic"],
    ],
    "Arduino mounting plate"
  ),
  r(
    "mg996r-servo-pack-2",
    "MG996R Servo (Pack of 2)",
    "Pack of 2",
    1700,
    "Two high-torque servos for arms and steering.",
    "Better value than buying singly.",
    [
      ["Torque", "9.4 kg·cm"],
      ["Pieces", "2"],
    ],
    "MG996R servo"
  ),
  r(
    "air-pump-12v-diaphragm",
    "12 V Diaphragm Air Pump",
    "Each",
    750,
    "Stronger air pump for bubblers.",
    "Fish tanks and aeration projects.",
    [
      ["Voltage", "12 V DC"],
      ["Type", "Diaphragm"],
    ],
    "air pump"
  ),
  r(
    "servo-power-supply-5v-5a",
    "5 V 5 A Servo Power Supply",
    "Each",
    1500,
    "Dedicated rail for servo banks.",
    "Feeds PCA9685 builds so the MCU rail stays clean.",
    [
      ["Output", "5 V, 5 A"],
      ["Connector", "Terminal block"],
    ],
    "servo power supply"
  ),
  r(
    "nema17-stepper-pack-2",
    "NEMA 17 Stepper Motor (Pack of 2)",
    "Pack of 2",
    3400,
    "Two matched steppers for X and Y axes.",
    "CNC and printer builds need a pair.",
    [
      ["Step angle", "1.8°"],
      ["Pieces", "2"],
    ],
    "NEMA 17"
  ),
  r(
    "rs385-dc-motor-12v",
    "RS-385 DC Motor 12 V",
    "Each",
    550,
    "Compact 12 V motor with good torque.",
    "Fans, mixers and small drives.",
    [
      ["Voltage", "12 V DC"],
      ["Shaft", "2 mm"],
    ],
    "DC motor"
  ),
  r(
    "mg90s-servo-pack-4",
    "MG90S Metal-Gear Servo (Pack of 4)",
    "Pack of 4",
    2000,
    "Four metal-gear micro servos.",
    "Servo sets for grippers and walking robots.",
    [
      ["Torque", "2.2 kg·cm"],
      ["Pieces", "4"],
    ],
    "MG90S servo"
  ),
  r(
    "sumo-robot-chassis-kit",
    "Sumo Robot Chassis Kit",
    "Kit",
    3000,
    "Low, wide chassis for robot combat practice.",
    "Bumper sensors and strong motors for pushing.",
    [["Includes", "Chassis, 2 motors, wheels, bumpers"]],
    "sumo robot chassis"
  )
)

/* ================================================================== */
/* BUILD PRODUCTS                                                      */
/* ================================================================== */

const categoryOrder = new Map(diyCategories.map((c) => [c.slug, c.sortOrder]))

function build(
  categorySlug: string,
  row: Row,
  sortOrder: number
): DiySeedProduct {
  const pack = row.unit.match(/^Pack of (\d+)/)
  const specifications: DiySeedSpec[] = [
    ...(pack
      ? [
          {
            label: "Pack size",
            material: `${pack[1]} pieces`,
            pieces: Number(pack[1]),
          },
        ]
      : []),
    ...row.specs.map(([label, material, pieces]) => ({
      label,
      material,
      ...(pieces ? { pieces } : {}),
    })),
  ]
  diyImageQueries[row.slug] = row.q ?? row.name.replace(/\s*[(—].*$/, "")
  return {
    categorySlug,
    name: row.name,
    slug: row.slug,
    shortDesc: row.short,
    description: `${row.short} ${row.use}`,
    unit: row.unit,
    price: row.price,
    specifications,
    images: [{ url: `/seed/${row.slug}.jpg`, alt: row.name }],
    isFeatured: featured.has(row.slug),
    sortOrder,
    seoTitle: `${row.name} | ODHERU Electronics`,
    seoDesc: `${row.short} Add it to your quote on WhatsApp.`,
  }
}

export const diyProducts: DiySeedProduct[] = Object.entries(rows)
  .sort(
    ([a], [b]) => (categoryOrder.get(a) ?? 99) - (categoryOrder.get(b) ?? 99)
  )
  .flatMap(([cat, list]) => list.map((row, i) => build(cat, row, i + 1)))

/* ================================================================== */
/* PROJECTS                                                            */
/* ================================================================== */

let projectOrder = 0

function project(
  slug: string,
  title: string,
  category: string,
  shortDesc: string,
  description: string,
  steps: [string, string][],
  heroProductSlug: string,
  isFeatured: boolean,
  parts: [slug: string, quantity: number, required: boolean][]
): DiySeedProject {
  projectOrder += 1
  return {
    title,
    slug,
    category,
    shortDesc,
    description,
    steps: steps.map(([t, b]) => ({ title: t, body: b })),
    images: [
      { url: `/seed/${heroProductSlug}.jpg`, alt: `${title} — main component` },
    ],
    isFeatured,
    sortOrder: projectOrder,
    seoTitle: `${title} Project | ODHERU Electronics`,
    seoDesc: `${shortDesc} Parts list and steps included.`,
    products: parts.map(([productSlug, quantity, isRequired]) => ({
      productSlug,
      quantity,
      isRequired,
    })),
  }
}

export const diyProjects: DiySeedProject[] = [
  project(
    "automatic-plant-watering-system",
    "Automatic Plant Watering System",
    "Electronics Projects",
    "Water plants only when the soil is dry, using a moisture sensor, relay and small pump.",
    "A soil probe reads how wet the pot is. When the reading crosses a dry threshold, the board switches a relay, which switches the pump. Teaches analog reading, relay driving and separating pump power from board power.",
    [
      [
        "Read the sensor",
        "Wire the probe to 5 V, ground and an analog pin. Note the reading in air and in water for your dry and wet thresholds.",
      ],
      [
        "Set thresholds",
        "Switch the relay on after a few dry readings and off once wet. The gap stops chattering.",
      ],
      [
        "Wire relay and pump",
        "Put the relay's common terminal in series with the pump's positive lead. Keep the pump on its own supply and share ground.",
      ],
      [
        "Test a full cycle",
        "Place the probe away from the pot wall, aim the outlet and run a dry-to-wet cycle before fine-tuning.",
      ],
    ],
    "capacitive-soil-moisture-sensor",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["capacitive-soil-moisture-sensor", 1, true],
      ["1-channel-relay-module", 1, true],
      ["mini-water-pump-5v", 1, true],
      ["jumper-wire-set", 1, false],
      ["dc-power-supply-12v-2a", 1, false],
    ]
  ),

  project(
    "ultrasonic-distance-meter",
    "Ultrasonic Distance Meter",
    "Electronics Projects",
    "Measure distance with an HC-SR04 and show it on a 16×2 LCD.",
    "The HC-SR04 gives a time-of-flight reading; the board converts it to centimetres and prints it on the LCD.",
    [
      [
        "Wire the sensor",
        "Connect VCC, GND, Trig to an output and Echo to an input.",
      ],
      [
        "Add the display",
        "Wire the LCD's I2C backpack and run an I2C scanner to confirm its address.",
      ],
      [
        "Time the pulse",
        "Hold Trig high for 10 µs, time Echo, multiply by the speed of sound and halve it.",
      ],
      ["Smooth the reading", "Average the last few readings to remove jumps."],
    ],
    "hc-sr04-ultrasonic-sensor",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["hc-sr04-ultrasonic-sensor", 1, true],
      ["1602-i2c-lcd-module", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "motion-activated-night-light",
    "Motion-Activated Night Light",
    "Electronics Projects",
    "Switch a light on automatically when a PIR sensor detects movement.",
    "A PIR module signals the board when something moves; the board lights an LED for a set time.",
    [
      [
        "Build the LED branch",
        "Place an LED and a 220 Ω resistor on the breadboard, driven from a digital pin.",
      ],
      [
        "Mount the PIR",
        "Wire to power, ground and an input. Let it settle for a minute after power-up.",
      ],
      [
        "Write the hold timer",
        "Switch on at motion and off a fixed interval after the last trigger using millis().",
      ],
      [
        "Test the field of view",
        "Walk through from different angles and tune the sensitivity dial.",
      ],
    ],
    "pir-motion-sensor",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["pir-motion-sensor", 1, true],
      ["led-5mm-white-pack-50", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
      ["18650-battery-holder-2x", 1, false],
    ]
  ),

  project(
    "555-timer-led-flasher",
    "555 Timer LED Flasher",
    "Beginner Projects",
    "A blinking light with no code — just a 555, resistors and a capacitor.",
    "The 555 in astable mode switches its output at a rate set by two resistors and a capacitor. The best first circuit for learning how parts work together.",
    [
      [
        "Place the 555",
        "Seat it across the breadboard gap, pin 8 to +9 V, pin 1 to ground, pin 4 to +9 V.",
      ],
      [
        "Add timing parts",
        "1 kΩ from pin 7 to +9 V, 10 kΩ between pins 7 and 6, link 6 and 2, and a 100 µF capacitor from pin 2 to ground.",
      ],
      [
        "Connect the LED",
        "From pin 3 through a 220 Ω resistor to the LED, then ground.",
      ],
      [
        "Change the speed",
        "Swap the capacitor or resistor to see how the blink rate changes.",
      ],
    ],
    "ne555-timer-pack-5",
    true,
    [
      ["ne555-timer-pack-5", 1, true],
      ["resistor-1k-pack-100", 1, true],
      ["resistor-10k-pack-100", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["electrolytic-100u-pack-20", 1, true],
      ["led-kit-5mm", 1, true],
      ["830-point-breadboard", 1, true],
      ["battery-clip-9v-pack-10", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "arduino-traffic-light",
    "Arduino Traffic Light with Pedestrian Button",
    "Beginner Projects",
    "Red, yellow and green LEDs cycle on a timer; a button requests a crossing.",
    "A first multi-LED project with a state machine and a button interrupt.",
    [
      [
        "Wire three LEDs",
        "Each LED goes through its own 220 Ω resistor to a digital pin.",
      ],
      ["Add the button", "Wire a tactile button to ground with INPUT_PULLUP."],
      [
        "Write the cycle",
        "Cycle green, yellow, red using millis(); a button press shortens the green phase.",
      ],
    ],
    "led-5mm-red-pack-50",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["led-5mm-red-pack-50", 1, true],
      ["led-5mm-yellow-pack-50", 1, true],
      ["led-5mm-green-pack-50", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["tactile-button-6x6-pack-20", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "oled-weather-station",
    "OLED Weather Station",
    "Electronics Projects",
    "Show temperature, humidity and pressure on a small OLED screen.",
    "A DHT22 reads temperature and humidity, a BMP280 reads pressure, and the OLED displays all three.",
    [
      [
        "Wire the I2C devices",
        "BMP280 and OLED share SDA and SCL at different addresses.",
      ],
      [
        "Wire the DHT22",
        "Connect its data pin with a 10 kΩ pull-up if the module lacks one.",
      ],
      [
        "Read and display",
        "Read every few seconds and draw the values on the OLED.",
      ],
    ],
    "bmp280-pressure-sensor",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["dht22-temp-humidity-sensor", 1, true],
      ["bmp280-pressure-sensor", 1, true],
      ["oled-096-i2c-module", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "temperature-controlled-fan",
    "Temperature-Controlled Fan",
    "Electronics Projects",
    "A fan that speeds up as the temperature rises.",
    "A DHT22 measures temperature and a MOSFET drives a fan with PWM, with a flyback diode for protection.",
    [
      ["Wire the sensor", "Connect the DHT22 to a digital pin."],
      [
        "Wire the MOSFET",
        "Fan negative to the MOSFET drain, source to ground, gate to a PWM pin through a resistor.",
      ],
      [
        "Map temperature to speed",
        "Scale PWM duty between a low and high temperature.",
      ],
    ],
    "dc-fan-5v-40mm",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["dht22-temp-humidity-sensor", 1, true],
      ["dc-fan-5v-40mm", 1, true],
      ["mosfet-irlz44n-pack-5", 1, true],
      ["diode-1n4007-pack-20", 1, true],
      ["resistor-10k-pack-100", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "rfid-door-lock",
    "RFID Door Lock",
    "Electronics Projects",
    "Open a latch with a servo when an authorised card is scanned.",
    "An RC522 reads each card's ID; on a match a servo opens the latch, otherwise a buzzer sounds.",
    [
      ["Wire the reader", "Connect the RC522 to SPI and 3.3 V — never 5 V."],
      [
        "Add outputs",
        "Wire the servo, an LED with a 220 Ω resistor and the buzzer.",
      ],
      [
        "Store allowed IDs",
        "Keep authorised IDs in an array and compare each scan.",
      ],
      [
        "Drive the latch",
        "On a match, open the servo, wait, close. Otherwise beep.",
      ],
    ],
    "rfid-rc522-kit",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["rfid-rc522-kit", 1, true],
      ["sg90-micro-servo", 1, true],
      ["buzzer-active-5v-pack-5", 1, true],
      ["led-5mm-green-pack-50", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["rfid-cards-13-56mhz-pack-10", 1, false],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "obstacle-avoiding-robot",
    "Obstacle-Avoiding Robot Car",
    "Robotics Projects",
    "A two-wheel robot that drives forward and turns away from obstacles.",
    "An ultrasonic sensor on a servo scans ahead. Closer than a set distance, the robot stops, looks left and right and turns to the clearer side.",
    [
      [
        "Assemble the chassis",
        "Mount the motors, wheels and caster, and fix the battery holder underneath.",
      ],
      [
        "Wire the driver",
        "Connect motors to the L298N, battery to its supply and logic pins to the UNO. Share ground.",
      ],
      [
        "Mount the scanner",
        "Fix the HC-SR04 to the servo horn and wire the servo to a PWM pin.",
      ],
      [
        "Write the avoid logic",
        "Drive forward until close, stop, scan both ways, then turn toward the larger distance.",
      ],
    ],
    "robot-chassis-2wd-kit",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["robot-chassis-2wd-kit", 1, true],
      ["l298n-motor-driver-module", 1, true],
      ["hc-sr04-ultrasonic-sensor", 1, true],
      ["sg90-micro-servo", 1, true],
      ["18650-battery-holder-2x", 1, true],
      ["li-ion-18650-cell", 2, true],
      ["slide-switch-spdt-pack-10", 1, false],
      ["jumper-wires-mf-pack-40", 1, false],
    ]
  ),

  project(
    "bluetooth-controlled-car",
    "Bluetooth Controlled Car",
    "Robotics Projects",
    "Drive a robot car from your phone.",
    "An HC-05 receives commands and the UNO turns each into motor directions through an L298N.",
    [
      ["Build the chassis", "Mount motors, wheels and the battery holder."],
      [
        "Wire Bluetooth",
        "Connect HC-05 to software-serial pins. Put a 1 kΩ / 2.2 kΩ divider on its RX line.",
      ],
      [
        "Wire the driver",
        "L298N inputs to four digital pins, motors to its outputs.",
      ],
      [
        "Parse commands",
        "Map single characters from the phone app to forward, back, left, right and stop.",
      ],
    ],
    "hc-05-bluetooth-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["hc-05-bluetooth-module", 1, true],
      ["l298n-motor-driver-module", 1, true],
      ["robot-chassis-2wd-kit", 1, true],
      ["18650-battery-holder-2x", 1, true],
      ["li-ion-18650-cell", 2, true],
      ["resistor-1k-pack-100", 1, false],
      ["resistor-2k2-pack-100", 1, false],
      ["jumper-wires-mf-pack-40", 1, false],
    ]
  ),

  project(
    "wifi-home-automation-switch",
    "WiFi Home Automation Switch",
    "IoT Projects",
    "Switch four appliances from a phone or browser using an ESP32.",
    "The ESP32 hosts a small web page; tapping a button toggles a relay. Mains wiring must be done carefully, inside an enclosure.",
    [
      [
        "Wire the relay board",
        "Power it from 5 V and connect IN1–IN4 to four ESP32 pins.",
      ],
      ["Write the web server", "One button per relay that flips its pin."],
      [
        "Wire loads safely",
        "Use screw terminals, keep mains inside the enclosure and never touch it while powered.",
      ],
      [
        "Mount in the box",
        "Fix boards with standoffs and close the lid before connecting to mains.",
      ],
    ],
    "esp32-devkit-v1",
    true,
    [
      ["esp32-devkit-v1", 1, true],
      ["relay-module-4-channel", 1, true],
      ["dc-power-supply-5v-2a", 1, true],
      ["abs-project-box-150x90x45", 1, true],
      ["screw-terminal-2p-pack-10", 1, false],
      ["standoff-m3-10mm-pack-20", 1, false],
      ["jumper-wires-ff-pack-40", 1, false],
    ]
  ),

  project(
    "digital-clock-ds3231",
    "Digital Clock with DS3231",
    "Electronics Projects",
    "A battery-backed clock on a 4-digit display with set buttons.",
    "A DS3231 keeps accurate time through power loss and a TM1637 shows hours and minutes.",
    [
      [
        "Wire the RTC",
        "Connect the DS3231 to SDA and SCL and set the time once.",
      ],
      ["Wire the display", "TM1637 CLK and DIO to two digital pins."],
      [
        "Add set buttons",
        "Two tactile buttons with INPUT_PULLUP adjust hours and minutes.",
      ],
    ],
    "ds3231-rtc-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["ds3231-rtc-module", 1, true],
      ["tm1637-4-digit-display", 1, true],
      ["tactile-button-6x6-pack-20", 1, true],
      ["cr2032-battery-pack-5", 1, false],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "fire-and-gas-alarm",
    "Fire & Gas Alarm",
    "Electronics Projects",
    "Sound an alarm when a flame or gas/smoke is detected.",
    "A flame sensor and MQ-2 watch for danger; when either trips, a buzzer sounds and a red LED lights.",
    [
      [
        "Wire the sensors",
        "Flame sensor digital output and MQ-2 analog output to the board.",
      ],
      [
        "Warm up the gas sensor",
        "Let the MQ-2 heat a few minutes and log normal readings to choose a threshold.",
      ],
      ["Wire the alarm", "Buzzer and a red LED with a 220 Ω resistor."],
      [
        "Write the logic",
        "Flame or gas over threshold sounds the buzzer and lights the LED.",
      ],
    ],
    "mq2-gas-sensor-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["flame-sensor-module", 1, true],
      ["mq2-gas-sensor-module", 1, true],
      ["buzzer-active-5v-pack-5", 1, true],
      ["led-5mm-red-pack-50", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "smart-dustbin",
    "Smart Dustbin",
    "Robotics Projects",
    "A bin lid that opens automatically when you approach.",
    "An ultrasonic sensor watches for a hand; when something is in range a servo lifts the lid, then closes it.",
    [
      ["Mount the sensor", "Fix the HC-SR04 at the front of the bin."],
      [
        "Attach the servo",
        "Mount it near the hinge with a link arm to the lid.",
      ],
      ["Write the trigger", "Under about 30 cm, open, wait, close."],
      ["Power it", "Use a 5 V supply of at least 1 A with common ground."],
    ],
    "sg90-micro-servo",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["hc-sr04-ultrasonic-sensor", 1, true],
      ["sg90-micro-servo", 1, true],
      ["dc-power-supply-5v-2a", 1, false],
      ["jumper-wires-mf-pack-40", 1, false],
      ["cable-tie-150mm-pack-100", 1, false],
    ]
  ),

  project(
    "gps-sms-tracker",
    "GPS SMS Tracker",
    "IoT Projects",
    "Text your location on request.",
    "A NEO-6M gets position and a SIM800L texts a map link when it receives an SMS. Needs a 2G-capable SIM and a supply that can deliver 2 A peaks.",
    [
      [
        "Wire the GPS",
        "NEO-6M TX/RX to software-serial pins; test outdoors for a first fix.",
      ],
      [
        "Power the GSM module",
        "Use an LM2596 set to about 4.0 V for the SIM800L, with common ground.",
      ],
      [
        "Reply to SMS",
        "On a request, read the GPS position and send a Google Maps link.",
      ],
    ],
    "neo-6m-gps-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["neo-6m-gps-module", 1, true],
      ["sim800l-gsm-module", 1, true],
      ["lm2596-buck-converter", 1, true],
      ["dc-power-supply-12v-2a", 1, false],
      ["abs-project-box-150x90x45", 1, false],
      ["jumper-wires-ff-pack-40", 1, false],
    ]
  ),

  /* ---- Batch G: projects 16–31 ---- */
  project(
    "digital-thermometer-ds18b20",
    "Digital Thermometer with DS18B20",
    "Electronics Projects",
    "Read a DS18B20 one-wire probe and show the temperature on an LCD.",
    "The DS18B20 reports temperature as digital values over a single wire, so readings stay accurate even on long leads. A 4.7 kΩ pull-up is the only extra part.",
    [
      [
        "Wire the one-wire bus",
        "Data to a digital pin with a 4.7 kΩ pull-up to 5 V; power from 5 V and ground. The TO-92 pins are GND, data, VCC from left to right flat side facing you.",
      ],
      [
        "Read the sensor",
        "Use a one-wire library to start a conversion and read the 12-bit result; divide by 16 for degrees Celsius.",
      ],
      [
        "Show it on the LCD",
        "Send the value over I2C to the 1602; run an I2C scanner first to confirm the backpack address.",
      ],
      [
        "Check accuracy",
        "Compare against ice water (0 °C) and warm tap water, and average a few readings to steady the last digit.",
      ],
    ],
    "ds18b20-to92-pack-5",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["ds18b20-to92-pack-5", 1, true],
      ["resistor-4k7-pack-100", 1, true],
      ["1602-i2c-lcd-module", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
      ["dc-power-supply-5v-2a", 1, false],
    ]
  ),

  project(
    "keypad-door-lock",
    "Keypad Door Lock",
    "Electronics Projects",
    "Type a code on a membrane keypad to open a servo latch.",
    "The keypad is scanned as a matrix of rows and columns. A correct code swings the servo to release the latch; a wrong code blinks the red LED and beeps.",
    [
      [
        "Wire the keypad",
        "Connect the eight rows and columns to digital pins and set them as inputs with pull-ups; the library handles the matrix scan.",
      ],
      [
        "Read key presses",
        "Accumulate digits into a buffer, with * to clear and # to submit the code.",
      ],
      [
        "Drive the latch",
        "On a correct code, move the servo to the open angle, light the green LED, wait three seconds and re-lock.",
      ],
      [
        "Handle wrong codes",
        "Blink the red LED, sound the buzzer and require a short lockout after three failures.",
      ],
    ],
    "keypad-3x4-membrane",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["keypad-3x4-membrane", 1, true],
      ["sg90-micro-servo", 1, true],
      ["buzzer-active-5v-pack-5", 1, true],
      ["led-5mm-red-pack-50", 1, true],
      ["led-5mm-green-pack-50", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["jumper-wire-set", 1, false],
      ["dc-power-supply-5v-2a", 1, false],
    ]
  ),

  project(
    "rain-alarm",
    "Rain Alarm",
    "Electronics Projects",
    "Sound a buzzer the moment rain lands on the sensor pad.",
    "The bare board exposes interdigitated copper traces. Rain drops bridge them, the analog reading collapses and the board triggers the alarm.",
    [
      [
        "Wire the pad",
        "VCC, GND and the analog output to A0; leave the bare board flat and exposed where rain will reach it.",
      ],
      [
        "Learn the dry value",
        "Read A0 dry and wet to pick a threshold between the two readings.",
      ],
      [
        "Trigger the alarm",
        "When the reading crosses the threshold for a few consecutive samples, switch on the buzzer and LED.",
      ],
      [
        "Mount it outdoors",
        "Angle the pad so water runs off, keep the electronics box dry and use a longer ribbon cable if needed.",
      ],
    ],
    "rain-sensor-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["rain-sensor-module", 1, true],
      ["buzzer-passive-pack-5", 1, true],
      ["led-5mm-blue-pack-50", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "gas-leak-sms-alert",
    "Gas Leak SMS Alert",
    "IoT Projects",
    "Send an SMS when the MQ-2 detects gas or smoke.",
    "The MQ-2 warms up and reports gas level on its analog pin. A SIM800L sends a text message, so the alert works even when there is no WiFi.",
    [
      [
        "Warm up the MQ-2",
        "Let the sensor heat for a few minutes and log normal room readings so you can pick a sensible threshold.",
      ],
      [
        "Power the SIM800L",
        "Feed it about 4.0 V from an LM2596 with a 1000 µF capacitor close by; its 2 A peaks will reset a weak supply.",
      ],
      [
        "Wire serial",
        "SIM800L TX/RX to software-serial pins and test with a manual AT command before connecting the sensor.",
      ],
      [
        "Send the alert",
        "When the gas reading passes the threshold, send an SMS, then rate-limit so it does not text repeatedly.",
      ],
    ],
    "mq2-gas-sensor-module",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["mq2-gas-sensor-module", 1, true],
      ["sim800l-gsm-module", 1, true],
      ["lm2596-buck-converter", 1, true],
      ["dc-power-supply-12v-2a", 1, true],
      ["led-5mm-red-pack-50", 1, false],
      ["resistor-220r-pack-100", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "line-follower-robot",
    "Line Follower Robot",
    "Robotics Projects",
    "A robot that follows a black line on the floor using an 8-sensor bar.",
    "Eight reflectance sensors read the line position. The controller steers with proportional corrections, so the car follows curves instead of zig-zagging.",
    [
      [
        "Assemble the chassis",
        "Mount motors, wheels and battery holder, and fix the sensor bar at the front about 5 mm above the floor.",
      ],
      [
        "Wire the driver and sensors",
        "Motors to the L298N with a shared battery supply, sensor bar outputs to digital pins.",
      ],
      [
        "Calibrate on the track",
        "Slide the robot over line and floor to record min and max values for each sensor.",
      ],
      [
        "Write the correction",
        "Weight the sensor positions into one error value and steer proportionally: on-line straight, off-line turn toward it.",
      ],
    ],
    "line-tracking-array-8ch",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["line-tracking-array-8ch", 1, true],
      ["l298n-motor-driver-module", 1, true],
      ["robot-chassis-2wd-kit", 1, true],
      ["18650-battery-holder-2x", 1, true],
      ["li-ion-18650-cell", 2, true],
      ["jumper-wires-mf-pack-40", 1, false],
    ]
  ),

  project(
    "robotic-arm-control",
    "Servo Robotic Arm Controller",
    "Robotics Projects",
    "Drive a 4-axis acrylic arm with a joystick through a PCA9685 driver.",
    "The PCA9685 drives four servos from one I2C address while the joystick reads grip and wrist on its two axes with a button for the claw.",
    [
      [
        "Build the arm",
        "Assemble the acrylic frame and mount four MG996R servos: base, shoulder, elbow and gripper.",
      ],
      [
        "Wire the PCA9685",
        "SDA, SCL, V+ and ground from the driver; power the servos from the 5 V 5 A supply, never from the board.",
      ],
      [
        "Read the joystick",
        "Map the two analog axes and the push button to the four servo angles with smoothing.",
      ],
      [
        "Set safe limits",
        "Limit each servo's range in software so the arm cannot fold back into itself.",
      ],
    ],
    "robotic-arm-4dof-kit",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["robotic-arm-4dof-kit", 1, true],
      ["pca9685-servo-driver", 1, true],
      ["mg996r-servo", 4, true],
      ["joystick-module-2-axis", 1, true],
      ["servo-power-supply-5v-5a", 1, true],
      ["jumper-wires-mf-pack-40", 1, false],
    ]
  ),

  project(
    "automatic-pet-feeder",
    "Automatic Pet Feeder",
    "Robotics Projects",
    "Open a servo gate on a schedule to drop food into a bowl.",
    "A DS3231 keeps the time; at each meal the servo rotates a gate in the hopper, dispensing a measured portion before closing again.",
    [
      [
        "Make the hopper",
        "Use a clean container with a slotted gate; the slot size sets the portion per opening.",
      ],
      [
        "Mount the servo",
        "Fix the SG90 to the gate with a horn arm so a quarter turn opens and closes it fully.",
      ],
      [
        "Set meal times",
        "Read the RTC each minute; when the hour and minute match, open the gate for one second, then close.",
      ],
      [
        "Add feedback",
        "Beep before each meal and keep a daily count so you can check it is feeding correctly.",
      ],
    ],
    "sg90-micro-servo",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["sg90-micro-servo", 1, true],
      ["ds3231-rtc-module", 1, true],
      ["buzzer-active-5v-pack-5", 1, true],
      ["cr2032-battery-pack-5", 1, false],
      ["dc-power-supply-5v-2a", 1, true],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "water-tank-level-monitor",
    "Water Tank Level Monitor",
    "Electronics Projects",
    "Show the tank level on an LCD and beep when it is nearly full.",
    "The probe's stacked sensors read the water height as a stepped analog value. The display maps it to bars and a buzzer warns before overflow.",
    [
      [
        "Drop in the probe",
        "Fix the sensor board at the top of the tank with the probes hanging down to just above the base.",
      ],
      [
        "Wire the board",
        "Power it from 5 V and take the analog output to A0; keep the wiring away from pumps to reduce noise.",
      ],
      [
        "Map to bars",
        "Take the dry and full readings, then draw four or five blocks on the 16×2 LCD for the level.",
      ],
      [
        "Add the alarm",
        "Sound the buzzer when the level crosses your high threshold and stop it once it drops again.",
      ],
    ],
    "water-level-sensor-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["water-level-sensor-module", 1, true],
      ["1602-i2c-lcd-module", 1, true],
      ["buzzer-active-5v-pack-5", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "ws2812b-mood-lamp",
    "WS2812B Mood Lamp",
    "Beginner Projects",
    "A colour-changing lamp from a 24-LED ring with smooth fades.",
    "Each WS2812B LED carries its own driver chip, so one data pin sets every colour. Smooth fades between palettes make an attractive first addressable-LED project.",
    [
      [
        "Wire power and data",
        "Ring 5 V and ground to a supply that can feed the LEDs; data from a digital pin through a 330 Ω resistor.",
      ],
      [
        "Send colours",
        "Set each LED with one RGB value in a strip library and show the frame.",
      ],
      [
        "Animate the fade",
        "Interpolate between palette colours over a few seconds so the transitions stay smooth.",
      ],
      [
        "Add a dimmer",
        "Use the LDR module on an analog pin to keep the lamp dim in daylight.",
      ],
    ],
    "ws2812b-ring-24",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["ws2812b-ring-24", 1, true],
      ["ldr-light-sensor-module", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
      ["dc-power-supply-5v-2a", 1, true],
    ]
  ),

  project(
    "digital-dice",
    "Digital Dice with 7-Segment Displays",
    "Beginner Projects",
    "Press a button and two dice faces appear — no microcontroller needed, just a 555 timer and counters.",
    "An NE555 clocks a pair of decade counters; each counter drives one 7-segment display and rolls stop when the button releases the clock.",
    [
      [
        "Build the clock",
        "555 in astable mode, around 10 Hz, with a push button that stops the clock while held.",
      ],
      [
        "Add the counters",
        "Two CD4017 decade counters clocked from the 555; each Q output drives one segment pattern through resistors.",
      ],
      [
        "Display the pips",
        "Wire the 7-segment digits through 220 Ω resistors and blank the display while rolling.",
      ],
      [
        "Add a roller",
        "Hold to spin, release to freeze on a random count between 1 and 6.",
      ],
    ],
    "ne555-timer-pack-5",
    false,
    [
      ["ne555-timer-pack-5", 1, true],
      ["cd4017-counter-pack-3", 1, true],
      ["seven-segment-single-pack-5", 2, true],
      ["resistor-220r-pack-100", 1, true],
      ["resistor-10k-pack-100", 1, true],
      ["electrolytic-10u-pack-20", 1, true],
      ["tactile-button-6x6-pack-20", 1, true],
      ["830-point-breadboard", 1, true],
      ["battery-clip-9v-pack-10", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "remote-gate-lock",
    "Remote-Controlled Gate Lock",
    "Robotics Projects",
    "Open a solenoid gate lock from a 433 MHz keyfob.",
    "A 433 MHz receiver decodes the keyfob and the board energises a push-pull solenoid for a few seconds. Fail-secure behaviour keeps the gate locked without power.",
    [
      [
        "Wire the receiver",
        "The receiver's data pin goes to an interrupt-capable pin; power it from 5 V with the antenna straightened out.",
      ],
      [
        "Decode the remote",
        "Learn the keyfob's code with a radio library and ignore repeats while a button is held.",
      ],
      [
        "Drive the solenoid",
        "Switch it through a relay or MOSFET with a flyback diode, and hold it open for three seconds.",
      ],
      [
        "Mount the hardware",
        "Bolt the solenoid so the tongue clears the strike, and box the electronics away from rain.",
      ],
    ],
    "electromagnetic-door-lock-12v",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["rf-433mhz-pair", 1, true],
      ["rf-remote-4button-433", 1, true],
      ["electromagnetic-door-lock-12v", 1, true],
      ["1-channel-relay-module", 1, true],
      ["diode-1n4007-pack-20", 1, false],
      ["dc-power-supply-12v-2a", 1, true],
      ["abs-project-box-80x50x20", 1, false],
    ]
  ),

  project(
    "arduino-voltmeter",
    "Arduino Voltmeter with LCD",
    "Beginner Projects",
    "Measure 0–30 V on an analog pin and display it on an LCD.",
    "A resistor divider scales the voltage below 5 V, then the board converts the reading back and prints it in volts.",
    [
      [
        "Build the divider",
        "100 kΩ in series with 10 kΩ from the test point to ground; take A0 from the junction.",
      ],
      [
        "Read and scale",
        "Convert A0 to volts, multiply by 11 (the divider ratio plus the meter's own offset) and average several samples.",
      ],
      [
        "Show the result",
        "Print the voltage on the I2C LCD with two decimal places.",
      ],
      [
        "Stay safe",
        "Never measure anything above 30 V, and do not measure mains; discharge capacitors before probing.",
      ],
    ],
    "1602-i2c-lcd-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["1602-i2c-lcd-module", 1, true],
      ["resistor-100k-pack-100", 1, true],
      ["resistor-10k-pack-100", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "portable-power-bank",
    "DIY Power Bank",
    "Electronics Projects",
    "Charge a phone from an 18650 cell with a charger board and boost converter.",
    "The TP4056 charges the cell safely from USB, the MT3608 boosts 3.7 V up to a steady 5 V, and a switch isolates the port when not in use.",
    [
      [
        "Wire the charger",
        "Battery to the TP4056's B+ and B− pads, USB input on the other side; use the protected board version.",
      ],
      [
        "Set the boost output",
        "Set the MT3608 to exactly 5.0 V with nothing connected before attaching the phone port.",
      ],
      [
        "Connect the output",
        "Boost output through the slide switch to the USB-A socket; keep the wiring short and thick.",
      ],
      [
        "Box it up",
        "Mount everything in a small project box with a vent-free layout; never puncture or short the cell.",
      ],
    ],
    "tp4056-charger-pack-2",
    true,
    [
      ["tp4056-charger-pack-2", 1, true],
      ["li-ion-18650-cell", 1, true],
      ["mt3608-boost-pack-2", 1, true],
      ["usb-a-panel-mount-pack-5", 1, true],
      ["slide-switch-spdt-pack-10", 1, true],
      ["abs-project-box-80x50x20", 1, false],
      ["wire-stripper-tool", 1, false],
    ]
  ),

  project(
    "bicycle-brake-light",
    "Bicycle Brake Light",
    "Electronics Projects",
    "A tail light that flares bright when the bike decelerates.",
    "An MPU6050 watches forward acceleration; when braking is detected the strip switches from a soft glow to full red, then returns after stopping.",
    [
      [
        "Mount everything",
        "Fix the strip across the seat post and the IMU flat on the frame with the axis pointing forward.",
      ],
      [
        "Read acceleration",
        "Poll the IMU over I2C and low-pass filter the forward axis so road bumps do not trigger it.",
      ],
      [
        "Detect braking",
        "When negative acceleration passes a threshold for a moment, set the strip to full brightness.",
      ],
      [
        "Power it",
        "Feed the strip from a 5 V supply rated for its LED count; add a barrel jack for a USB power bank on longer rides.",
      ],
    ],
    "mpu6050-imu-module",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["mpu6050-imu-module", 1, true],
      ["ws2812b-led-strip-1m", 1, true],
      ["resistor-220r-pack-100", 1, true],
      ["dc-power-supply-5v-2a", 1, true],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "ph-monitor-hydroponics",
    "pH Monitor for Hydroponics",
    "Electronics Projects",
    "Measure nutrient-solution pH and warn when it drifts out of range.",
    "The analog pH probe board outputs a voltage the board converts to pH. Alerts tell you when the solution needs adjusting, which hydroponic plants are sensitive to.",
    [
      [
        "Calibrate first",
        "Take readings in pH 4 and pH 7 buffer solutions and store the two-point slope before trusting values.",
      ],
      [
        "Read and convert",
        "Average the analog input, apply the calibration line and print pH on the OLED.",
      ],
      [
        "Set the window",
        "Warn with the buzzer when pH drifts outside 5.5–6.5 for most crops.",
      ],
      [
        "Handle the probe",
        "Rinse with distilled water, store in storage solution and never let the probe dry out.",
      ],
    ],
    "ph-meter-sensor-kit",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["ph-meter-sensor-kit", 1, true],
      ["oled-096-i2c-module", 1, true],
      ["buzzer-passive-pack-5", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "motor-tachometer",
    "Motor Tachometer",
    "Electronics Projects",
    "Measure motor speed in RPM with a slotted disc and photo-interrupter.",
    "A disc with slots spins between the interrupter's LED and detector. Each slot breaks the beam, an interrupt counts it, and the board converts pulses per second into RPM.",
    [
      [
        "Make the disc",
        "Cut a card disc with 10 evenly spaced slots and mount it on the motor shaft so it runs in the sensor slot.",
      ],
      [
        "Wire the sensor",
        "Photo-interrupter to 5 V and ground with the output on an interrupt pin; add a pull-up if the module lacks one.",
      ],
      [
        "Count pulses",
        "Count interrupts over a one-second window, then RPM = pulses × 60 ÷ slots.",
      ],
      [
        "Display and smooth",
        "Show RPM on the TM1637 and average a few windows so the reading stops jumping around.",
      ],
    ],
    "photo-interrupter-sensor",
    false,
    [
      ["uno-r3-development-board", 1, true],
      ["photo-interrupter-sensor", 1, true],
      ["tm1637-4-digit-display", 1, true],
      ["tactile-button-6x6-pack-20", 1, true],
      ["830-point-breadboard", 1, false],
      ["jumper-wire-set", 1, false],
    ]
  ),

  project(
    "flow-meter-irrigation",
    "Measured Irrigation with Flow Meter",
    "IoT Projects",
    "Water a garden bed by the litre using a flow sensor and solenoid valve.",
    "The YF-N20 sends a pulse per volume of water. The board counts pulses and closes the valve once the target volume has passed, so beds get even water without waste.",
    [
      [
        "Plumb the sensor",
        "Fit the flow sensor and valve in series on the supply line with the arrow pointing toward the bed.",
      ],
      [
        "Count the pulses",
        "Read the hall-effect pulses on an interrupt pin and multiply by the sensor's calibration factor for litres.",
      ],
      [
        "Control the valve",
        "Open the relay, count to the target volume, then close; confirm no leaks at the fittings.",
      ],
      [
        "Tune per bed",
        "Run a measured bucket test to calibrate, then set litres per bed for each watering cycle.",
      ],
    ],
    "yf-n20-water-flow-sensor",
    true,
    [
      ["uno-r3-development-board", 1, true],
      ["yf-n20-water-flow-sensor", 1, true],
      ["solenoid-valve-12v", 1, true],
      ["1-channel-relay-module", 1, true],
      ["dc-power-supply-12v-2a", 1, true],
      ["1602-i2c-lcd-module", 1, false],
      ["jumper-wires-mf-pack-40", 1, false],
      ["diode-1n4007-pack-20", 1, false],
    ]
  ),
]
