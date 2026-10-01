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
  q?: string,
): Row => ({ slug, name, unit, price, short, use, specs, q })

/** slug -> image search term, consumed by seed-diy.ts --images */
export const diyImageQueries: Record<string, string> = {}

const rows: Record<string, Row[]> = {}
const push = (cat: string, ...list: Row[]) => {
  rows[cat] = [...(rows[cat] ?? []), ...list]
}

const featured = new Set([
  "uno-r3-development-board", "esp32-devkit-v1", "hc-sr04-ultrasonic-sensor",
  "1-channel-relay-module", "830-point-breadboard", "digital-multimeter",
  "resistor-kit-1-4w", "led-kit-5mm", "sg90-micro-servo", "soldering-iron-60w",
  "robot-chassis-2wd-kit", "jumper-wire-set", "student-electronics-starter-kit",
  "arduino-uno-starter-kit", "esp32-iot-starter-kit", "sensor-kit-37-in-1",
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

const codeUf = (v: number) => (Number.isInteger(v) ? `${v}u` : String(v).replace(".", "u"))

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const diyCategories: DiySeedCategory[] = [
  { name: "Starter Kits & Bundles", slug: "starter-kits", sortOrder: 1,
    description: "Ready-made kits for students and beginners — everything for a first project in one box." },
  { name: "Electronics Components", slug: "electronics-components", sortOrder: 2,
    description: "Resistors, capacitors, LEDs, potentiometers, buzzers and other passive parts, sold in packs so you always have spares." },
  { name: "Semiconductors & ICs", slug: "semiconductors", sortOrder: 3,
    description: "Diodes, transistors, MOSFETs, voltage regulators, timers and logic chips for building circuits from scratch." },
  { name: "Switches & Connectors", slug: "switches-connectors", sortOrder: 4,
    description: "Push buttons, switches, pin headers, terminals, jacks and sockets for wiring projects together." },
  { name: "Sensors", slug: "sensors", sortOrder: 5,
    description: "Temperature, humidity, motion, light, gas, distance, pressure, weight and motion-tracking sensors." },
  { name: "Modules & Boards", slug: "modules-boards", sortOrder: 6,
    description: "Arduino, ESP32 and Pico boards plus relay, motor driver, display, clock and expansion modules." },
  { name: "Wireless & IoT", slug: "wireless-iot", sortOrder: 7,
    description: "Bluetooth, WiFi, RF, LoRa, GPS, RFID, NFC, GSM and camera modules for connected builds." },
  { name: "Prototyping", slug: "prototyping", sortOrder: 8,
    description: "Breadboards, jumper wires, perfboards and copper-clad boards for building before you solder." },
  { name: "Electrical & Power", slug: "electrical", sortOrder: 9,
    description: "Power supplies, batteries, chargers, converters, hookup wire, fuses and heat shrink." },
  { name: "Tools & Workshop", slug: "tools-workshop", sortOrder: 10,
    description: "Soldering, measuring and hand tools for the workbench, plus solder and flux." },
  { name: "Enclosures & Hardware", slug: "enclosures-hardware", sortOrder: 11,
    description: "Project boxes, standoffs, screws, cable ties and fixings to turn a breadboard build into a finished product." },
  { name: "Robotics & Automation", slug: "robotics-automation", sortOrder: 12,
    description: "Servos, motors, steppers, pumps, valves, fans and chassis kits for moving and automating things." },
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

push("electronics-components",
  r("resistor-kit-1-4w", "Resistor Kit — 1/4 W Assorted (600 pcs)", "Kit", 450,
    "30 common values, 20 of each, in a labelled case.",
    "Covers LED limiting, dividers, pull-ups and sensor inputs. The best first purchase for a student bench.",
    [["Contents", "30 values × 20 pcs", 600], ["Power rating", "1/4 W"], ["Tolerance", "±5%"]], "resistor"),
  ...ohms.map((o) =>
    r(`resistor-${codeOhms(o)}-pack-100`, `${fmtOhms(o)} Resistor — 1/4 W (Pack of 100)`, "Pack of 100",
      o >= 1e6 ? 120 : 100,
      `100 carbon-film ${fmtOhms(o)} resistors, 1/4 W, ±5%.`,
      `Useful for ${ohmHints[o]}. Sold in 100s so a whole class or workshop stays stocked.`,
      [["Value", fmtOhms(o)], ["Power rating", "1/4 W"], ["Tolerance", "±5%"], ["Type", "Carbon film, through-hole"]],
      "carbon film resistor"),
  ),
  ...[100, 220, 470, 1000, 4700, 10000].map((o) =>
    r(`resistor-${codeOhms(o)}-half-w-pack-50`, `${fmtOhms(o)} Resistor — 1/2 W (Pack of 50)`, "Pack of 50", 120,
      `50 carbon-film ${fmtOhms(o)} resistors rated 1/2 W.`,
      "Use where a quarter-watt part runs hot, such as LED strips and small power stages.",
      [["Value", fmtOhms(o)], ["Power rating", "1/2 W"], ["Tolerance", "±5%"]],
      "carbon film resistor"),
  ),
)

/* ---- Ceramic capacitors, 50 per pack ---- */
const ceramics: [string, string][] = [
  ["10 pF", "10p"], ["22 pF", "22p"], ["47 pF", "47p"], ["100 pF", "100p"],
  ["330 pF", "330p"], ["470 pF", "470p"],
  ["1 nF", "1n"], ["2.2 nF", "2n2"], ["4.7 nF", "4n7"], ["10 nF", "10n"],
  ["22 nF", "22n"], ["47 nF", "47n"], ["100 nF", "100n"], ["1 µF", "1u"],
]
push("electronics-components",
  r("ceramic-capacitor-kit", "Ceramic Capacitor Kit (100 pcs)", "Kit", 350,
    "Assorted ceramic capacitors from 10 pF to 100 nF.",
    "Decoupling, filtering and timing. Place a 100 nF beside each IC's power pins.",
    [["Contents", "10 values × 10 pcs", 100], ["Range", "10 pF – 100 nF"]], "ceramic capacitor"),
  ...ceramics.map(([label, code]) =>
    r(`ceramic-cap-${code}-pack-50`, `${label} Ceramic Capacitor (Pack of 50)`, "Pack of 50", 150,
      `50 ceramic disc capacitors, ${label}, 50 V.`,
      label === "22 pF" ? "The pair of 22 pF caps that go with a 16 MHz crystal." :
      label === "100 nF" ? "The standard decoupling capacitor — one per IC." : "General decoupling, filtering and timing.",
      [["Value", label], ["Voltage", "50 V"], ["Type", "Ceramic disc"]], "ceramic capacitor"),
  ),
)

/* ---- Electrolytic capacitors, 20 per pack ---- */
const electros = [0.47, 1, 3.3, 4.7, 10, 15, 22, 33, 47, 68, 100, 150, 220, 330, 470, 1000, 2200, 4700]
push("electronics-components",
  r("electrolytic-capacitor-kit", "Electrolytic Capacitor Kit (120 pcs)", "Kit", 450,
    "Assorted 1 µF to 1000 µF electrolytic capacitors.",
    "Smoothing, audio coupling and 555 timing. The striped lead is negative.",
    [["Contents", "10 values × 12 pcs", 120], ["Range", "1 µF – 1000 µF"]], "electrolytic capacitor"),
  ...electros.map((v) =>
    r(`electrolytic-${codeUf(v)}-pack-20`, `${v} µF Electrolytic Capacitor (Pack of 20)`, "Pack of 20",
      v >= 1000 ? 300 : v >= 220 ? 200 : 150,
      `20 radial electrolytic capacitors, ${v} µF.`,
      "Polarised — mind the stripe. Use for power smoothing, timing and coupling.",
      [["Value", `${v} µF`], ["Voltage", v >= 1000 ? "16 V" : "25 V"], ["Type", "Radial electrolytic"]],
      "electrolytic capacitor"),
  ),
)

/* ---- LEDs by colour ---- */
const ledColours: [string, string][] = [
  ["red", "Red"], ["green", "Green"], ["yellow", "Yellow"],
  ["blue", "Blue"], ["white", "White"], ["orange", "Orange"],
]
for (const size of [5, 3]) {
  push("electronics-components",
    ...ledColours.map(([c, label]) =>
      r(`led-${size}mm-${c}-pack-50`, `${label} LED ${size} mm (Pack of 50)`, "Pack of 50", size === 5 ? 200 : 180,
        `50 ${label.toLowerCase()} ${size} mm through-hole LEDs.`,
        "Always use a series resistor — 220 Ω is a safe default on 5 V.",
        [["Colour", label], ["Size", `${size} mm`], ["Leads", "Through-hole, 2.54 mm"]], `${size}mm LED`),
    ),
  )
}

/* ---- Screws, standoffs, heat shrink, cable ties ---- */
const screws: [string, number[]][] = [["M2", [4, 6, 8, 10]], ["M2.5", [6, 10, 12]], ["M3", [6, 10, 16, 20, 30]], ["M4", [10, 20]], ["M5", [10, 16, 20, 30]]]
for (const [thread, lengths] of screws) {
  push("enclosures-hardware",
    ...lengths.map((len) =>
      r(`screw-${thread.toLowerCase().replace(".", "")}x${len}-pack-50`,
        `${thread}×${len} mm Pan-Head Screw (Pack of 50)`, "Pack of 50", 150,
        `50 ${thread} × ${len} mm cross-head screws.`,
        "Zinc-plated steel for boards, enclosures and chassis.",
        [["Thread", thread], ["Length", `${len} mm`], ["Head", "Pan, Phillips"]], "machine screw"),
    ),
    r(`nut-${thread.toLowerCase().replace(".", "")}-pack-100`, `${thread} Hex Nut (Pack of 100)`, "Pack of 100", 150,
      `100 ${thread} hex nuts.`, "Pairs with the matching screws.", [["Thread", thread]], "hex nut"),
  )
}
push("enclosures-hardware",
  ...[6, 8, 10, 12, 15, 20, 25, 30, 40].map((len) =>
    r(`standoff-m3-${len}mm-pack-20`, `M3 Male-Female Standoff ${len} mm (Pack of 20)`, "Pack of 20", 250,
      `20 brass M3 standoffs, ${len} mm.`, "Lift boards off a base plate or enclosure floor.",
      [["Thread", "M3"], ["Length", `${len} mm`], ["Material", "Brass"]], "standoff spacer"),
  ),
  ...[50, 100, 150, 200, 250, 300, 370].map((len) =>
    r(`cable-tie-${len}mm-pack-100`, `Nylon Cable Ties ${len} mm (Pack of 100)`, "Pack of 100", len >= 200 ? 200 : 150,
      `100 nylon cable ties, ${len} mm.`, "Bundle wiring inside enclosures and on chassis.",
      [["Length", `${len} mm`], ["Material", "Nylon"]], "cable tie"),
  ),
)
push("electrical",
  ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((d) =>
    r(`heat-shrink-${d}mm-pack-10`, `Heat Shrink Tubing ${d} mm × 10 cm (Pack of 10)`, "Pack of 10", d >= 10 ? 150 : 120,
      `10 black heat-shrink tubes, ${d} mm, 10 cm long.`,
      "Slide over a wire before soldering, then shrink for an insulated joint.",
      [["Diameter", `${d} mm`], ["Shrink ratio", "2:1"]], "heat shrink tubing"),
  ),
  ...(["red", "black", "yellow", "green", "blue", "white"] as const).map((c) =>
    r(`hookup-wire-22awg-${c}-5m`, `Hookup Wire 22 AWG ${c[0].toUpperCase() + c.slice(1)} (5 m roll)`, "Roll", 120,
      `5 m of solid-core 22 AWG hookup wire in ${c}.`, "Breadboard and perfboard wiring; colour-code your rails.",
      [["Gauge", "22 AWG solid core"], ["Length", "5 m"]], "hookup wire"),
  ),
  ...(["red", "black", "yellow", "green", "blue", "white"] as const).map((c) =>
    r(`hookup-wire-24awg-${c}-5m`, `Hookup Wire 24 AWG ${c[0].toUpperCase() + c.slice(1)} (5 m roll)`, "Roll", 100,
      `5 m of solid-core 24 AWG hookup wire in ${c}.`,
      "Thinner than 22 AWG — fits tight breadboard rows and fine signal wiring.",
      [["Gauge", "24 AWG solid core"], ["Length", "5 m"]], "hookup wire"),
  ),
  r("silicone-wire-24awg-1m-pair", "Silicone Stranded Wire 24 AWG (Red + Black, 1 m each)", "Pair", 150,
    "Flexible stranded leads that stay soft.", "Servo extensions, battery leads and anything that moves.",
    [["Gauge", "24 AWG stranded silicone"], ["Length", "2 × 1 m"]], "silicone wire"),
  r("fuse-blade-assortment-40", "Blade Fuse Assortment ATO/ATC (40 pcs)", "Kit", 400,
    "5 A to 30 A blade fuses in a compartment case.",
    "Protect 12 V supply leads to motors, pumps and LED strips.",
    [["Contents", "5 – 30 A assorted", 40], ["Type", "ATO/ATC blade"]], "blade fuse"),
  r("fuse-holder-blade-pack-5", "Blade Fuse Holder (Pack of 5)", "Pack of 5", 250,
    "Inline holders for blade fuses.", "Add one close to the battery on every 12 V build.",
    [["Fits", "ATO/ATC"], ["Rating", "30 A"]], "fuse holder"),
  r("usb-c-cable-1m", "USB-C Data Cable 1 m", "Each", 300,
    "Power and program modern USB-C boards.", "Make sure the cable carries data, not just power.",
    [["Length", "1 m"], ["Type", "USB 2.0"]], "USB-C cable"),
  r("solar-panel-6v-3w", "6 V 3 W Mini Solar Panel", "Each", 1200,
    "Sized for small battery-charging builds.",
    "Daylight power for sensors; use a charge controller when charging batteries.",
    [["Power", "3 W"], ["Output", "6 V"]], "solar panel"),
  r("aa-alkaline-pack-4", "AA Alkaline Battery (Pack of 4)", "Pack of 4", 300,
    "Fresh AA cells for portable projects.", "Runs sensor nodes and small motors; recycle when flat.",
    [["Voltage", "1.5 V"], ["Type", "Alkaline"]], "AA battery"),
  r("aaa-alkaline-pack-4", "AAA Alkaline Battery (Pack of 4)", "Pack of 4", 250,
    "Fresh AAA cells for compact builds.", "Fits the smaller 2× and 4×AAA holders.",
    [["Voltage", "1.5 V"], ["Type", "Alkaline"]], "AAA battery"),
  r("9v-battery-pack-2", "9 V PP3 Alkaline Battery (Pack of 2)", "Pack of 2", 350,
    "Snap-on 9 V batteries for UNO builds.", "Pairs with the 9 V battery clip for portable power.",
    [["Voltage", "9 V"], ["Type", "Alkaline"]], "9V battery"),
)

/* ---- Metal-film 1% resistors, film capacitors, inductors, LED extras ---- */
const metalFilm = [100, 330, 1000, 4700, 10000, 100000]
push("electronics-components",
  ...metalFilm.map((o) =>
    r(`resistor-mf-${codeOhms(o)}-pack-50`, `${fmtOhms(o)} Resistor — 1/4 W Metal Film 1% (Pack of 50)`, "Pack of 50", 150,
      `50 metal-film ${fmtOhms(o)} resistors, 1/4 W, ±1%.`,
      "Tighter tolerance than carbon film for dividers, sensor circuits and anything calibration matters.",
      [["Value", fmtOhms(o)], ["Power rating", "1/4 W"], ["Tolerance", "±1%"], ["Type", "Metal film, through-hole"]],
      "metal film resistor"),
  ),
  ...([["10 nF", "10n"], ["33 nF", "33n"], ["100 nF", "100n"], ["220 nF", "220n"], ["1 µF", "1u"], ["2.2 µF", "2u2"]] as [string, string][]).map(([label, code]) =>
    r(`film-cap-${code}-pack-20`, `${label} Film Capacitor (Pack of 20)`, "Pack of 20", 150,
      `20 polyester film capacitors, ${label}, 50 V.`,
      "Stable where ceramic capacitance drifts — timing, coupling and audio filters.",
      [["Value", label], ["Voltage", "50 V"], ["Type", "Polyester film"]], "film capacitor"),
  ),
  ...([["10 µH", "10uh"], ["47 µH", "47uh"], ["100 µH", "100uh"], ["330 µH", "330uh"], ["1 mH", "1mh"]] as [string, string][]).map(([label, code]) =>
    r(`inductor-${code}-pack-10`, `${label} Power Inductor (Pack of 10)`, "Pack of 10", 150,
      `10 axial power inductors, ${label}.`,
      "Filtering and energy storage in switching supplies and oscillator tanks.",
      [["Value", label], ["Type", "Axial, ferrite core"], ["Tolerance", "±10%"]], "power inductor"),
  ),
  ...ledColours.map(([c, label]) =>
    r(`led-10mm-${c}-pack-20`, `${label} LED 10 mm (Pack of 20)`, "Pack of 20", 220,
      `20 ${label.toLowerCase()} 10 mm through-hole LEDs.`,
      "Larger lens for indicator panels and light effects — always use a series resistor.",
      [["Colour", label], ["Size", "10 mm"], ["Leads", "Through-hole, 2.54 mm"]], "10mm LED"),
  ),
  r("ir-led-5mm-940nm-pack-10", "IR LED 5 mm 940 nm (Pack of 10)", "Pack of 10", 200,
    "Infrared emitters for remotes and light barriers.",
    "Pair with an IR receiver or phototransistor; the beam is invisible to the eye.",
    [["Wavelength", "940 nm"], ["Size", "5 mm"]], "infrared LED"),
  r("uv-led-5mm-pack-10", "UV LED 5 mm (Pack of 10)", "Pack of 10", 300,
    "Near-ultraviolet LEDs.", "Curing resin, fluorescent effects and counterfeit-note checks.",
    [["Wavelength", "≈ 400 nm"], ["Size", "5 mm"]], "ultraviolet LED"),
  r("rgb-led-common-anode-pack-5", "RGB LED 5 mm Common Anode (Pack of 5)", "Pack of 5", 200,
    "Four-pin RGB LEDs with a shared positive lead.", "Colour mixing with PWM — one resistor per channel.",
    [["Type", "Common anode"], ["Pins", "4"]], "RGB LED"),
  r("led-bicolor-rg-pack-10", "Bi-Colour Red/Green LED 3 mm (Pack of 10)", "Pack of 10", 250,
    "Two colours in one small package.", "Status indicators: red for fault, green for OK.",
    [["Colours", "Red / green"], ["Size", "3 mm"], ["Pins", "3"]], "bi-color LED"),
  r("led-holder-5mm-pack-20", "5 mm LED Holder Bezel (Pack of 20)", "Pack of 20", 150,
    "Panel bezels for 5 mm LEDs.", "Snap an LED neatly into a drilled panel.",
    [["Fits", "5 mm LED"], ["Mount", "8 mm hole"]], "LED holder"),
  r("led-holder-10mm-pack-10", "10 mm LED Holder Bezel (Pack of 10)", "Pack of 10", 150,
    "Panel bezels for 10 mm LEDs.", "Neat indicators on boxes and dashboards.",
    [["Fits", "10 mm LED"], ["Mount", "12 mm hole"]], "LED holder"),
  r("crystal-8mhz-pack-5", "8 MHz Crystal HC-49S (Pack of 5)", "Pack of 5", 150,
    "Clock crystals for 8 MHz ATmega and PIC builds.", "Use with two 22 pF load capacitors.",
    [["Frequency", "8 MHz"], ["Package", "HC-49S"]], "quartz crystal"),
  r("crystal-32768hz-pack-5", "32.768 kHz Watch Crystal (Pack of 5)", "Pack of 5", 150,
    "Tuning-fork crystals for real-time clocks.", "The standard clock source for RTC circuits.",
    [["Frequency", "32.768 kHz"], ["Load capacitance", "12.5 pF"]], "watch crystal"),
  r("potentiometer-500r-pack-5", "500 Ω Rotary Potentiometer (Pack of 5)", "Pack of 5", 250,
    "Low-value linear pots for LED dimming.", "Fine brightness control with little heat.",
    [["Value", "500 Ω"], ["Taper", "Linear (B)"]], "potentiometer"),
  r("potentiometer-4k7-pack-5", "4.7 kΩ Rotary Potentiometer (Pack of 5)", "Pack of 5", 250,
    "Linear 4.7 kΩ pots.", "Sensor calibration and gain adjustment.",
    [["Value", "4.7 kΩ"], ["Taper", "Linear (B)"]], "potentiometer"),
  r("potentiometer-50k-pack-5", "50 kΩ Rotary Potentiometer (Pack of 5)", "Pack of 5", 250,
    "Linear 50 kΩ pots.", "Audio and timing controls between the common 10 k and 100 k values.",
    [["Value", "50 kΩ"], ["Taper", "Linear (B)"]], "potentiometer"),
)

push("enclosures-hardware",
  ...(["M2", "M2.5", "M3", "M4", "M5"] as const).map((thread) =>
    r(`washer-${thread.toLowerCase().replace(".", "")}-pack-100`, `${thread} Flat Washer (Pack of 100)`, "Pack of 100", 150,
      `100 ${thread} zinc flat washers.`,
      "Spread the load under screw heads so lids and standoffs do not crush.",
      [["Thread", thread], ["Material", "Zinc-plated steel"]], "flat washer"),
  ),
  ...[10, 20, 30].map((len) =>
    r(`standoff-nylon-m3-${len}mm-pack-20`, `Nylon M3 Standoff ${len} mm (Pack of 20)`, "Pack of 20", 200,
      `20 insulating nylon M3 standoffs, ${len} mm.`,
      "Electrically isolate a board from a metal base plate.",
      [["Thread", "M3"], ["Length", `${len} mm`], ["Material", "Nylon"]], "nylon standoff"),
  ),
  ...["PG9", "PG11", "PG13.5"].map((size) =>
    r(`cable-gland-${size.toLowerCase().replace(".", "")}-pack-5`, `Cable Gland ${size} (Pack of 5)`, "Pack of 5", 250,
      `5 ${size} cable glands for thicker leads.`, "Strain relief and dust sealing where PG7 is too small.",
      [["Size", size]], "cable gland"),
  ),
  r("screw-self-tapping-2x8-pack-50", "Self-Tapping Screw 2×8 mm (Pack of 50)", "Pack of 50", 150,
    "Thread-forming screws for plastic enclosures.", "Bite into plastic bosses without needing a nut.",
    [["Thread", "2×8 mm"], ["Head", "Pan, Phillips"]], "self-tapping screw"),
  r("screw-self-tapping-3x12-pack-50", "Self-Tapping Screw 3×12 mm (Pack of 50)", "Pack of 50", 200,
    "Larger thread-forming screws.", "Fix brackets and standoffs into thicker plastic walls.",
    [["Thread", "3×12 mm"], ["Head", "Pan, Phillips"]], "self-tapping screw"),
)

push("prototyping",
  r("ribbon-cable-10way-1m", "IDC Ribbon Cable 10-Way (1 m)", "Roll", 250,
    "Flat ten-conductor cable for IDC connectors.", "Clean bus wiring between boards, displays and keypads.",
    [["Conductors", "10"], ["Length", "1 m"]], "ribbon cable"),
  r("jumper-wires-mm-10cm-pack-40", "Male-to-Male Jumper Wires 10 cm (Pack of 40)", "Pack of 40", 120,
    "Short jumpers for tidy breadboards.", "Keeps low-profile wiring out of the way of the work.",
    [["Type", "Male-male"], ["Length", "10 cm"]], "jumper wires"),
  r("jumper-wires-mm-30cm-pack-20", "Male-to-Male Jumper Wires 30 cm (Pack of 20)", "Pack of 20", 120,
    "Long jumpers for spread-out builds.", "Reach from a bench supply across to the board.",
    [["Type", "Male-male"], ["Length", "30 cm"]], "jumper wires"),
  r("copper-clad-board-5x7", "Copper-Clad Board 5×7 cm (Single-Sided)", "Each", 200,
    "Blank PCB stock for etching your own layout.", "Toner-transfer or photoresist methods at home.",
    [["Size", "5×7 cm"], ["Copper", "Single-sided, 1 oz"]], "copper clad board"),
  r("copper-clad-board-9x15", "Copper-Clad Board 9×15 cm (Single-Sided)", "Each", 400,
    "Larger blank PCB stock.", "Etch several small boards from one piece.",
    [["Size", "9×15 cm"], ["Copper", "Single-sided, 1 oz"]], "copper clad board"),
)

/* ================================================================== */
/* CURATED PRODUCTS                                                    */
/* ================================================================== */

push("starter-kits",
  r("student-electronics-starter-kit", "Student Electronics Starter Kit", "Kit", 2800,
    "Breadboard, resistors, LEDs, capacitors, buttons and jumpers for first circuits.",
    "Everything for the first term of an electronics class without needing a board. Pairs with the multimeter for measuring.",
    [["Includes", "830-pt breadboard, 600 resistors, 100 LEDs, capacitor kit, 20 buttons, jumpers, 9 V clip"]], "electronics components kit"),
  r("arduino-uno-starter-kit", "UNO R3 Starter Kit (Board + Sensors + Parts)", "Kit", 4500,
    "UNO R3 board with breadboard, sensors, LEDs, servo, LCD and parts.",
    "The classic learn-to-code-hardware kit with parts for 20+ beginner projects.",
    [["Includes", "UNO R3, breadboard, LCD1602, servo, HC-SR04, LEDs, resistors, jumpers, USB cable"]], "Arduino starter kit"),
  r("esp32-iot-starter-kit", "ESP32 IoT Starter Kit", "Kit", 3500,
    "ESP32 DevKit with sensors and relay for WiFi and Bluetooth projects.",
    "Build web-controlled switches, weather stations and MQTT sensors out of the box.",
    [["Includes", "ESP32 DevKit, DHT22, relay module, OLED, breadboard, jumpers"]], "ESP32 development board"),
  r("sensor-kit-37-in-1", "37-in-1 Sensor Module Kit", "Kit", 3200,
    "37 common sensor and actuator modules in one box.",
    "A broad set for learning how each sensor type works; no soldering needed.",
    [["Contents", "37 modules", 37]], "Arduino sensor kit"),
  r("soldering-starter-kit", "Soldering Starter Kit", "Kit", 3200,
    "Iron, stand, solder, flux, pump and braid for first soldering.",
    "Everything to start soldering header pins and through-hole boards.",
    [["Includes", "60 W iron, stand, solder, flux, desoldering pump, braid"]], "soldering iron kit"),
  r("robotics-starter-kit-2wd", "2WD Robotics Starter Kit", "Kit", 5500,
    "UNO, motor driver, ultrasonic sensor, servo, chassis and batteries.",
    "Build an obstacle-avoiding or Bluetooth-driven robot car straight away.",
    [["Includes", "UNO, L298N, HC-SR04, SG90, 2WD chassis, battery holder, jumpers"]], "robot car kit"),
)

push("electronics-components",
  r("potentiometer-10k-pack-5", "10 kΩ Rotary Potentiometer (Pack of 5)", "Pack of 5", 250,
    "Linear 10 kΩ pots for volume, dimming and analog input.",
    "Wire the outer pins to 5 V and ground and read the wiper on an analog pin.",
    [["Value", "10 kΩ"], ["Taper", "Linear (B)"]], "potentiometer"),
  r("potentiometer-1k-pack-5", "1 kΩ Rotary Potentiometer (Pack of 5)", "Pack of 5", 250,
    "Linear 1 kΩ pots.", "Good for LED dimming and bias adjustment.", [["Value", "1 kΩ"], ["Taper", "Linear (B)"]], "potentiometer"),
  r("potentiometer-100k-pack-5", "100 kΩ Rotary Potentiometer (Pack of 5)", "Pack of 5", 250,
    "Linear 100 kΩ pots.", "Higher-impedance controls and timing adjustments.", [["Value", "100 kΩ"], ["Taper", "Linear (B)"]], "potentiometer"),
  r("trimmer-pot-3296-kit", "3296 Multi-Turn Trimmer Kit (50 pcs)", "Kit", 500,
    "Precise preset trimmers from 100 Ω to 1 MΩ.",
    "Set thresholds and calibrate sensor circuits with fine adjustment.",
    [["Contents", "10 values × 5 pcs", 50], ["Turns", "25"]], "trimmer potentiometer"),
  r("ldr-photoresistor-pack-10", "LDR Photoresistor GL5528 (Pack of 10)", "Pack of 10", 200,
    "Light-dependent resistors for light sensing.", "Pair with a 10 kΩ resistor as a divider and read it on an analog pin.",
    [["Model", "GL5528"], ["Light resistance", "10 – 20 kΩ"]], "photoresistor"),
  r("ntc-thermistor-10k-pack-5", "NTC Thermistor 10 kΩ (Pack of 5)", "Pack of 5", 200,
    "Simple analog temperature sensing element.", "Use in a divider with a 10 kΩ resistor; convert with the beta equation.",
    [["Value", "10 kΩ at 25 °C"], ["Beta", "3950"]], "NTC thermistor"),
  r("led-kit-5mm", "LED Kit — 5 mm Assorted (100 pcs)", "Kit", 350,
    "100 × 5 mm LEDs in five colours.", "Plugs straight into a breadboard; add a 220 Ω resistor per LED.",
    [["Contents", "5 colours × 20 pcs", 100], ["Size", "5 mm"]], "5mm LED"),
  r("led-kit-3mm", "LED Kit — 3 mm Assorted (100 pcs)", "Kit", 300,
    "Compact 3 mm LEDs in five colours.", "For dense boards and model builds.", [["Contents", "5 colours × 20 pcs", 100], ["Size", "3 mm"]], "3mm LED"),
  r("rgb-led-common-cathode-pack-5", "RGB LED 5 mm Common Cathode (Pack of 5)", "Pack of 5", 200,
    "Four-pin RGB LEDs for colour mixing with PWM.", "Drive each colour pin through its own resistor.",
    [["Type", "Common cathode"], ["Pins", "4"]], "RGB LED"),
  r("seven-segment-single-pack-5", "7-Segment Display 0.56\" Single Digit (Pack of 5)", "Pack of 5", 250,
    "Red single-digit displays for counters and timers.", "Drive directly with resistors or through a 74HC595.",
    [["Type", "Common cathode"], ["Size", "0.56 in"]], "seven segment display"),
  r("buzzer-active-5v-pack-5", "Active Buzzer 5 V (Pack of 5)", "Pack of 5", 250,
    "Self-oscillating buzzers — apply 5 V and they beep.", "Alarms, timers and key-press feedback.",
    [["Voltage", "3.3 – 5 V"], ["Type", "Active"]], "piezo buzzer"),
  r("buzzer-passive-pack-5", "Passive Buzzer Module (Pack of 5)", "Pack of 5", 250,
    "Play tones and tunes with PWM.", "Needs a square wave, so it can play melodies.", [["Type", "Passive"]], "piezo buzzer"),
  r("crystal-16mhz-pack-5", "16 MHz Crystal HC-49S (Pack of 5)", "Pack of 5", 150,
    "Clock crystals for standalone ATmega builds.", "Use with two 22 pF capacitors.", [["Frequency", "16 MHz"]], "quartz crystal"),
  r("speaker-8ohm-0-5w-pack-2", "8 Ω 0.5 W Mini Speaker (Pack of 2)", "Pack of 2", 250,
    "Small speakers for tones and simple audio.", "Drive from an amplifier module or a transistor.", [["Impedance", "8 Ω"], ["Power", "0.5 W"]], "loudspeaker"),
)

push("semiconductors",
  r("diode-1n4007-pack-20", "1N4007 Rectifier Diode (Pack of 20)", "Pack of 20", 150,
    "1 A, 1000 V general-purpose rectifier diodes.", "Flyback diodes across relay coils and motors; reverse-polarity protection.",
    [["Current", "1 A"], ["Reverse voltage", "1000 V"], ["Package", "DO-41"]], "1N4007 diode"),
  r("diode-1n4148-pack-50", "1N4148 Signal Diode (Pack of 50)", "Pack of 50", 150,
    "Fast small-signal switching diodes.", "Logic steering and clamping.", [["Current", "200 mA"], ["Package", "DO-35"]], "1N4148 diode"),
  r("diode-1n5819-pack-20", "1N5819 Schottky Diode (Pack of 20)", "Pack of 20", 200,
    "Low-drop 1 A Schottky diodes.", "Efficient protection and rectification in low-voltage supplies.", [["Current", "1 A"], ["Voltage", "40 V"]], "Schottky diode"),
  r("zener-diode-kit", "Zener Diode Kit 1 W (50 pcs)", "Kit", 300,
    "Assorted 1 W zeners from 3.3 V to 15 V.", "Clamp or reference a voltage.", [["Contents", "Assorted 3.3 – 15 V", 50]], "zener diode"),
  r("bridge-rectifier-w10-pack-5", "W10 Bridge Rectifier (Pack of 5)", "Pack of 5", 200,
    "1.5 A bridge rectifier in a DIP package.", "Turn AC from a transformer into DC.", [["Current", "1.5 A"], ["Voltage", "1000 V"]], "bridge rectifier"),
  r("transistor-2n2222a-pack-10", "2N2222A NPN Transistor (Pack of 10)", "Pack of 10", 150,
    "General-purpose NPN for loads to 800 mA.", "Switch LEDs, small relays and buzzers through a 1 kΩ base resistor.",
    [["Type", "NPN"], ["Collector current", "800 mA"], ["Package", "TO-92"]], "2N2222 transistor"),
  r("transistor-bc547-pack-10", "BC547 NPN Transistor (Pack of 10)", "Pack of 10", 100,
    "Small-signal NPN for amplifiers and light loads.", "A staple of student circuits.", [["Type", "NPN"], ["Collector current", "100 mA"]], "BC547 transistor"),
  r("transistor-bc557-pack-10", "BC557 PNP Transistor (Pack of 10)", "Pack of 10", 100,
    "PNP complement to the BC547.", "Push-pull stages and high-side switching.", [["Type", "PNP"], ["Collector current", "100 mA"]], "BC557 transistor"),
  r("transistor-bc337-pack-10", "BC337 NPN Transistor (Pack of 10)", "Pack of 10", 120,
    "800 mA NPN in TO-92.", "A stronger alternative to the BC547.", [["Type", "NPN"], ["Collector current", "800 mA"]], "BC337 transistor"),
  r("transistor-2n3904-pack-10", "2N3904 NPN Transistor (Pack of 10)", "Pack of 10", 120,
    "General-purpose NPN, 200 mA.", "Switching and small amplifier stages.", [["Type", "NPN"], ["Collector current", "200 mA"]], "2N3904"),
  r("transistor-2n3906-pack-10", "2N3906 PNP Transistor (Pack of 10)", "Pack of 10", 120,
    "General-purpose PNP, 200 mA.", "Complement to the 2N3904.", [["Type", "PNP"], ["Collector current", "200 mA"]], "2N3906"),
  r("tip120-darlington-pack-5", "TIP120 Darlington Transistor (Pack of 5)", "Pack of 5", 250,
    "NPN Darlington for loads up to 5 A.", "Add a flyback diode across inductive loads.",
    [["Type", "NPN Darlington"], ["Collector current", "5 A"], ["Package", "TO-220"]], "TIP120 transistor"),
  r("mosfet-irlz44n-pack-5", "IRLZ44N Logic-Level MOSFET (Pack of 5)", "Pack of 5", 450,
    "N-channel MOSFET switchable from 5 V.", "Switch motors, LED strips and pumps with low loss.",
    [["Type", "N-channel, logic level"], ["Drain current", "47 A"], ["Package", "TO-220"]], "IRLZ44N MOSFET"),
  r("mosfet-irf540n-pack-5", "IRF540N MOSFET (Pack of 5)", "Pack of 5", 400,
    "N-channel power MOSFET, 33 A, 100 V.", "Needs about 10 V gate drive; use a driver or transistor stage.",
    [["Type", "N-channel"], ["Drain current", "33 A"], ["Package", "TO-220"]], "IRF540N MOSFET"),
  r("triac-bt136-pack-5", "BT136 Triac (Pack of 5)", "Pack of 5", 300,
    "4 A, 600 V triac for AC switching.", "Mains dimmers and switches. Use with an optoisolated driver and take care with mains.",
    [["Current", "4 A"], ["Voltage", "600 V"]], "triac"),
  r("lm7805-regulator-pack-5", "LM7805 5 V Regulator (Pack of 5)", "Pack of 5", 200,
    "Fixed 5 V regulator, up to 1.5 A.", "Add 100 nF capacitors on input and output.", [["Output", "5 V"], ["Input", "7 – 25 V"]], "7805 voltage regulator"),
  r("lm7809-regulator-pack-5", "LM7809 9 V Regulator (Pack of 5)", "Pack of 5", 200,
    "Fixed 9 V regulator.", "Steady 9 V from 12 V sources.", [["Output", "9 V"], ["Max current", "1.5 A"]], "7809 voltage regulator"),
  r("lm7812-regulator-pack-5", "LM7812 12 V Regulator (Pack of 5)", "Pack of 5", 200,
    "Fixed 12 V regulator.", "Steady 12 V from higher DC sources.", [["Output", "12 V"], ["Max current", "1.5 A"]], "7812 voltage regulator"),
  r("ams1117-3v3-pack-5", "AMS1117-3.3 Regulator (Pack of 5)", "Pack of 5", 200,
    "3.3 V low-dropout regulator, SOT-223.", "Power 3.3 V sensors from a 5 V rail.", [["Output", "3.3 V"], ["Current", "800 mA"]], "AMS1117"),
  r("lm317-regulator-pack-3", "LM317 Adjustable Regulator (Pack of 3)", "Pack of 3", 200,
    "Adjustable 1.25 – 37 V regulator.", "Set any voltage with two resistors.", [["Output", "1.25 – 37 V"], ["Max current", "1.5 A"]], "LM317 voltage regulator"),
  r("tl431-reference-pack-10", "TL431 Voltage Reference (Pack of 10)", "Pack of 10", 150,
    "Adjustable shunt reference.", "Precision references and simple regulators.", [["Reference", "2.5 V adjustable"]], "TL431"),
  r("ne555-timer-pack-5", "NE555 Timer IC DIP-8 (Pack of 5)", "Pack of 5", 200,
    "The classic timer for flashers, delays and oscillators.", "The best first IC for students.", [["Package", "DIP-8"], ["Supply", "4.5 – 15 V"]], "NE555 timer"),
  r("lm358-op-amp-pack-5", "LM358 Dual Op-Amp (Pack of 5)", "Pack of 5", 200,
    "Dual single-supply op-amp.", "Amplifiers and comparators from 5 V.", [["Channels", "2"], ["Package", "DIP-8"]], "LM358"),
  r("lm324-op-amp-pack-3", "LM324 Quad Op-Amp (Pack of 3)", "Pack of 3", 200,
    "Four op-amps in one package.", "Multi-stage filters and sensor conditioning.", [["Channels", "4"], ["Package", "DIP-14"]], "LM324"),
  r("lm393-comparator-pack-5", "LM393 Dual Comparator (Pack of 5)", "Pack of 5", 200,
    "Dual voltage comparator.", "Threshold detectors and level sensing.", [["Channels", "2"], ["Package", "DIP-8"]], "LM393"),
  r("lm386-audio-amp-pack-3", "LM386 Audio Amplifier (Pack of 3)", "Pack of 3", 250,
    "Low-voltage power amp for small speakers.", "Add audio output to your builds.", [["Power", "≈ 0.7 W"], ["Package", "DIP-8"]], "LM386"),
  r("74hc595-shift-register-pack-3", "74HC595 Shift Register (Pack of 3)", "Pack of 3", 250,
    "8 outputs from 3 pins.", "LED rows, 7-segment displays and relay banks.", [["Outputs", "8"], ["Package", "DIP-16"]], "74HC595"),
  r("74hc14-schmitt-pack-3", "74HC14 Schmitt Trigger Inverter (Pack of 3)", "Pack of 3", 200,
    "Six inverters with hysteresis.", "Debouncing and clean-up of slow signals.", [["Gates", "6"], ["Package", "DIP-14"]], "74HC14"),
  r("cd4017-counter-pack-3", "CD4017 Decade Counter (Pack of 3)", "Pack of 3", 200,
    "Ten sequential outputs from a clock.", "Chaser lights and sequencers with a 555.", [["Outputs", "10"], ["Package", "DIP-16"]], "CD4017"),
  r("uln2003a-driver-pack-3", "ULN2003A Darlington Array (Pack of 3)", "Pack of 3", 250,
    "Seven 500 mA drivers in one chip.", "Relays, solenoids and unipolar steppers.", [["Channels", "7"], ["Package", "DIP-16"]], "ULN2003"),
  r("l293d-motor-driver-pack-2", "L293D Motor Driver IC (Pack of 2)", "Pack of 2", 400,
    "Dual H-bridge in DIP-16.", "Drive two small DC motors with built-in flyback diodes.", [["Current", "600 mA per channel"], ["Package", "DIP-16"]], "L293D"),
  r("pc817-optocoupler-pack-10", "PC817 Optocoupler (Pack of 10)", "Pack of 10", 250,
    "Isolate a signal between two circuits.", "Protects a microcontroller from noisy or higher-voltage circuits.", [["Isolation", "5000 V"], ["Package", "DIP-4"]], "PC817 optocoupler"),
  r("atmega328p-pu-bootloader", "ATmega328P-PU with Bootloader", "Each", 700,
    "Bare chip pre-loaded for Arduino IDE.", "Build a standalone board with a crystal and two capacitors.", [["Package", "DIP-28"], ["Flash", "32 KB"]], "ATmega328P"),
  r("relay-srd-05vdc-pack-5", "SRD-05VDC Relay (Pack of 5)", "Pack of 5", 350,
    "Bare 5 V relays, 10 A contacts.", "Build your own relay board with a transistor and flyback diode.", [["Coil", "5 V"], ["Contacts", "10 A 250 V AC"]], "relay"),
)

push("switches-connectors",
  r("tactile-button-6x6-pack-20", "Tactile Push Button 6×6 mm (Pack of 20)", "Pack of 20", 150,
    "Four-pin momentary buttons.", "Use INPUT_PULLUP and wire the other side to ground.", [["Size", "6×6×5 mm"], ["Type", "Momentary NO"]], "tactile switch"),
  r("tactile-button-12x12-pack-10", "Tactile Push Button 12×12 mm (Pack of 10)", "Pack of 10", 200,
    "Large tactile buttons for panels.", "Easier to press on handheld builds.", [["Size", "12×12 mm"]], "tactile switch"),
  r("panel-pushbutton-16mm-pack-5", "16 mm Panel Push Button (Pack of 5)", "Pack of 5", 300,
    "Metal momentary buttons for enclosures.", "Snap into a drilled panel.", [["Mount", "16 mm hole"]], "push button switch"),
  r("slide-switch-spdt-pack-10", "SPDT Slide Switch (Pack of 10)", "Pack of 10", 200,
    "Mini slide switches for battery builds.", "Put one in the battery lead.", [["Rating", "0.5 A at 50 V DC"]], "slide switch"),
  r("toggle-switch-spdt-pack-5", "Mini Toggle Switch SPDT (Pack of 5)", "Pack of 5", 250,
    "Panel-mount toggle switches.", "Mode selection and power on/off.", [["Rating", "3 A 250 V AC"]], "toggle switch"),
  r("rocker-switch-2pin-pack-5", "Rocker Switch 2-Pin (Pack of 5)", "Pack of 5", 250,
    "Panel-mount rockers.", "Main power switch in an enclosure.", [["Rating", "6 A 250 V AC"]], "rocker switch"),
  r("dip-switch-8pos-pack-5", "8-Position DIP Switch (Pack of 5)", "Pack of 5", 250,
    "Set binary addresses and options.", "Configuration switches on boards.", [["Positions", "8"]], "DIP switch"),
  r("limit-switch-micro-pack-5", "Micro Limit Switch with Lever (Pack of 5)", "Pack of 5", 250,
    "End-stop switches for moving parts.", "CNC and printer end-stops, door sensors.", [["Rating", "5 A 250 V AC"]], "micro switch"),
  r("pin-header-male-pack-10", "Male Pin Header 40-Pin Strip (Pack of 10)", "Pack of 10", 150,
    "Breakable 2.54 mm header strips.", "Snap off the length you need and solder to modules.", [["Pitch", "2.54 mm"], ["Pins per strip", "40"]], "pin header"),
  r("pin-header-female-pack-10", "Female Pin Header 40-Pin Strip (Pack of 10)", "Pack of 10", 200,
    "Female socket strips.", "Make a plug-in socket on perfboard.", [["Pitch", "2.54 mm"], ["Pins per strip", "40"]], "female pin header"),
  r("pin-header-right-angle-pack-10", "Right-Angle Male Pin Header (Pack of 10)", "Pack of 10", 200,
    "Side-mounted headers.", "Connect boards at 90°.", [["Pitch", "2.54 mm"], ["Pins per strip", "40"]], "pin header"),
  r("screw-terminal-2p-pack-10", "2-Pin Screw Terminal 5.08 mm (Pack of 10)", "Pack of 10", 200,
    "PCB screw terminals.", "Secure supply and motor connections.", [["Pitch", "5.08 mm"], ["Rating", "10 A"]], "screw terminal block"),
  r("screw-terminal-3p-pack-10", "3-Pin Screw Terminal 5.08 mm (Pack of 10)", "Pack of 10", 250,
    "Three-way PCB terminals.", "Relay and sensor connections.", [["Pitch", "5.08 mm"]], "screw terminal block"),
  r("dc-barrel-jack-pack-5", "DC Barrel Jack 5.5×2.1 mm (Pack of 5)", "Pack of 5", 150,
    "Female barrel jacks.", "Add a power input to a build.", [["Size", "5.5×2.1 mm"]], "DC barrel jack"),
  r("dc-barrel-plug-screw-pack-5", "DC Barrel Plug with Screw Terminals (Pack of 5)", "Pack of 5", 250,
    "Male 5.5×2.1 mm plug adapters.", "Connect a battery or supply to a barrel input.", [["Size", "5.5×2.1 mm"]], "DC power plug"),
  r("ic-socket-kit-20", "DIP IC Socket Kit (20 pcs)", "Kit", 250,
    "Assorted DIP-8/14/16/28 sockets.", "Solder the socket, not the chip.", [["Contents", "DIP-8/14/16/28", 20]], "DIP IC socket"),
  r("jst-xh-connector-kit", "JST-XH 2.54 mm Connector Kit (230 pcs)", "Kit", 900,
    "Keyed connectors with headers and housings.", "Tidy, polarised plug-in wiring for sensors and batteries.", [["Contents", "2–5 pin, 230 pcs", 230]], "JST connector"),
  r("alligator-clip-leads-pack-10", "Alligator Clip Test Leads (Pack of 10)", "Pack of 10", 300,
    "Insulated clip leads for temporary connections.", "Handy for testing and demos.", [["Length", "≈ 30 cm"]], "crocodile clip"),
  r("usb-micro-breakout-pack-3", "Micro-USB Breakout Board (Pack of 3)", "Pack of 3", 200,
    "Bring USB power to a breadboard.", "Power a project from a phone charger.", [["Connector", "Micro-USB"]], "micro USB breakout"),
)

push("sensors",
  r("hc-sr04-ultrasonic-sensor", "HC-SR04 Ultrasonic Sensor", "Each", 200,
    "Distance sensor from 2 cm to 400 cm.", "A common first sensor for obstacle detection and level measurement. Runs on 5 V.",
    [["Range", "2 cm – 400 cm"], ["Voltage", "5 V"]], "HC-SR04"),
  r("jsn-sr04t-waterproof-ultrasonic", "JSN-SR04T Waterproof Ultrasonic Sensor", "Each", 800,
    "Weatherproof probe for tanks and outdoors.", "Measure water level without touching the liquid.", [["Range", "25 cm – 450 cm"], ["Voltage", "5 V"]], "waterproof ultrasonic sensor"),
  r("vl53l0x-tof-sensor", "VL53L0X Time-of-Flight Distance Sensor", "Each", 900,
    "Laser distance sensor up to 2 m over I2C.", "More precise than ultrasonic at short range.", [["Range", "up to 2 m"], ["Interface", "I2C"]], "VL53L0X"),
  r("dht11-temp-humidity-sensor", "DHT11 Temperature & Humidity Sensor", "Each", 150,
    "Digital temperature and humidity.", "Single-wire wiring for weather stations.", [["Temperature", "0 – 50 °C"], ["Humidity", "20 – 80 %RH"]], "DHT11"),
  r("dht22-temp-humidity-sensor", "DHT22 (AM2302) Temperature & Humidity Sensor", "Each", 600,
    "Accurate, wide-range DHT upgrade.", "±0.5 °C accuracy for greenhouse and weather builds.", [["Temperature", "−40 – 80 °C"], ["Humidity", "0 – 100 %RH"]], "DHT22"),
  r("ds18b20-waterproof-probe", "DS18B20 Waterproof Temperature Probe", "Each", 400,
    "Stainless 1-Wire probe for liquids and soil.", "Several probes share one pin; add a 4.7 kΩ pull-up.", [["Range", "−55 – 125 °C"], ["Interface", "1-Wire"]], "DS18B20"),
  r("bme280-sensor", "BME280 Temperature, Humidity & Pressure Sensor", "Each", 800,
    "Three environmental readings over I2C.", "A compact all-in-one weather sensor.", [["Interface", "I2C / SPI"], ["Voltage", "3.3 V"]], "BME280"),
  r("bmp280-pressure-sensor", "BMP280 Pressure & Temperature Sensor", "Each", 450,
    "Barometric pressure and altitude over I2C.", "Weather stations and altitude logging.", [["Range", "300 – 1100 hPa"], ["Voltage", "3.3 V"]], "BMP280"),
  r("max6675-thermocouple-kit", "MAX6675 K-Type Thermocouple Module", "Kit", 900,
    "High-temperature sensing up to 1024 °C.", "Ovens, kilns and furnaces. Includes a K-type probe.", [["Range", "0 – 1024 °C"], ["Interface", "SPI"]], "thermocouple"),
  r("pir-motion-sensor", "HC-SR501 PIR Motion Sensor", "Each", 250,
    "Detects movement within about 7 m.", "Tunable sensitivity and hold time.", [["Range", "Up to 7 m"], ["Angle", "≈ 110°"]], "HC-SR501 PIR sensor"),
  r("capacitive-soil-moisture-sensor", "Capacitive Soil Moisture Sensor", "Each", 300,
    "Corrosion-resistant soil probe.", "Outputs an analog voltage; lasts longer than resistive probes.", [["Output", "Analog"], ["Voltage", "3.3 – 5 V"]], "soil moisture sensor"),
  r("ldr-light-sensor-module", "LDR Light Sensor Module", "Each", 200,
    "LDR with comparator and threshold dial.", "Dusk-to-dawn switches and light trackers.", [["Outputs", "Analog + digital"]], "photoresistor module"),
  r("mq2-gas-sensor-module", "MQ-2 Gas & Smoke Sensor Module", "Each", 450,
    "Detects LPG, smoke, methane and hydrogen.", "Needs a few minutes' warm-up.", [["Detects", "LPG, smoke, CH₄, H₂"], ["Voltage", "5 V"]], "MQ-2 gas sensor"),
  r("mq135-air-quality-sensor", "MQ-135 Air Quality Sensor Module", "Each", 450,
    "Detects ammonia, benzene and CO₂-type pollutants.", "Indoor air-quality monitors.", [["Outputs", "Analog + digital"], ["Voltage", "5 V"]], "MQ-135 gas sensor"),
  r("mq7-co-sensor", "MQ-7 Carbon Monoxide Sensor Module", "Each", 450,
    "Detects carbon monoxide.", "Garage and generator-room alarms.", [["Outputs", "Analog + digital"], ["Voltage", "5 V"]], "MQ-7 gas sensor"),
  r("flame-sensor-module", "IR Flame Sensor Module", "Each", 200,
    "Detects flame light.", "Fire alarms and fire-fighting robots.", [["Angle", "≈ 60°"], ["Voltage", "3.3 – 5 V"]], "flame sensor module"),
  r("sound-sensor-module", "Sound Detection Sensor Module", "Each", 200,
    "Microphone module for claps and noise triggers.", "Clap switches and noise alarms.", [["Outputs", "Analog + digital"]], "microphone sensor module"),
  r("ir-obstacle-sensor-fc51", "FC-51 IR Obstacle Avoidance Sensor", "Each", 200,
    "Short-range infrared obstacle detector.", "Cheap bumper-free obstacle detection.", [["Range", "2 – 30 cm"], ["Output", "Digital"]], "infrared obstacle sensor"),
  r("tcrt5000-line-tracker-module", "TCRT5000 Line Tracking Sensor", "Each", 200,
    "Reflective IR sensor for line followers.", "Tells black line from white floor.", [["Range", "1 – 25 mm"]], "TCRT5000"),
  r("mpu6050-imu-module", "MPU6050 Accelerometer & Gyro Module", "Each", 500,
    "6-axis motion sensor over I2C.", "Self-balancing robots and tilt measurement.", [["Axes", "3 accel + 3 gyro"], ["Interface", "I2C"]], "MPU-6050"),
  r("adxl345-accelerometer", "ADXL345 3-Axis Accelerometer", "Each", 600,
    "Digital accelerometer over I2C/SPI.", "Tilt, vibration and tap detection.", [["Range", "±16 g"], ["Interface", "I2C / SPI"]], "ADXL345"),
  r("qmc5883l-compass", "QMC5883L Magnetometer Compass Module", "Each", 500,
    "3-axis compass over I2C.", "Heading for robots and navigation.", [["Interface", "I2C"]], "magnetometer"),
  r("rain-sensor-module", "Rain Detection Sensor Module", "Each", 250,
    "Raindrop sensing plate.", "Weather stations and auto window closers.", [["Outputs", "Analog + digital"]], "rain sensor module"),
  r("water-level-sensor-module", "Water Level Sensor Module", "Each", 200,
    "Analog probe that senses water depth.", "Not for continuous submersion.", [["Output", "Analog"]], "water level sensor"),
  r("yf-s201-water-flow-sensor", "YF-S201 Water Flow Sensor", "Each", 700,
    "Hall-effect flow meter for 1–30 L/min.", "Measure water usage and dispensing volumes.", [["Range", "1 – 30 L/min"], ["Voltage", "5 – 18 V"]], "water flow sensor"),
  r("acs712-current-sensor-5a", "ACS712 5 A Current Sensor Module", "Each", 500,
    "Hall-effect current sensor.", "Power monitors and overload alarms.", [["Range", "±5 A"], ["Output", "185 mV/A"]], "ACS712"),
  r("zmpt101b-voltage-sensor", "ZMPT101B AC Voltage Sensor Module", "Each", 700,
    "Measure mains voltage safely through a transformer.", "Energy-monitor projects; mains safety applies.", [["Output", "Analog"]], "voltage sensor module"),
  r("hx711-load-cell-5kg-kit", "HX711 + 5 kg Load Cell Kit", "Kit", 700,
    "Digital scale kit.", "Build a kitchen scale or weighing station.", [["Capacity", "5 kg"], ["Includes", "Load cell + HX711"]], "load cell"),
  r("ttp223-touch-sensor-pack-3", "TTP223 Capacitive Touch Sensor (Pack of 3)", "Pack of 3", 250,
    "Touch buttons with no moving parts.", "Replace mechanical buttons.", [["Voltage", "2 – 5.5 V"]], "touch sensor"),
  r("a3144-hall-sensor-pack-5", "A3144 Hall Effect Sensor (Pack of 5)", "Pack of 5", 200,
    "Detects a magnet's presence.", "Speed counters and door sensors.", [["Type", "Digital Hall switch"]], "Hall effect sensor"),
  r("reed-switch-pack-10", "Glass Reed Switch (Pack of 10)", "Pack of 10", 200,
    "Magnet-activated switches.", "Door and window alarms.", [["Type", "Normally open"]], "reed switch"),
  r("sw420-vibration-sensor-pack-3", "SW-420 Vibration Sensor (Pack of 3)", "Pack of 3", 250,
    "Detects shocks and vibration.", "Anti-theft and machine monitoring.", [["Outputs", "Digital"]], "vibration sensor"),
  r("tcs3200-colour-sensor", "TCS3200 Colour Sensor Module", "Each", 700,
    "Detects RGB colour.", "Sorting machines and colour matching.", [["Output", "Frequency"], ["Voltage", "2.7 – 5.5 V"]], "colour sensor"),
  r("max30102-pulse-oximeter", "MAX30102 Pulse & SpO₂ Sensor Module", "Each", 900,
    "Heart-rate and SpO₂ sensing over I2C.", "For fitness and demonstration projects, not medical use.", [["Interface", "I2C"]], "MAX30102"),
)

push("modules-boards",
  r("uno-r3-development-board", "UNO R3 Development Board", "Each", 850,
    "ATmega328P board programmed over USB.", "14 digital I/O, 6 analog inputs, 5 V logic.", [["Microcontroller", "ATmega328P"], ["Digital I/O", "14"], ["Analog inputs", "6"]], "Arduino Uno R3"),
  r("nano-v3-ch340", "Nano V3 Development Board (CH340)", "Each", 700,
    "Breadboard-friendly ATmega328P board.", "Same chip as the UNO in a smaller package.", [["Microcontroller", "ATmega328P"], ["USB chip", "CH340"]], "Arduino Nano"),
  r("pro-mini-5v-16mhz", "Pro Mini 5 V 16 MHz Board", "Each", 600,
    "Ultra-compact ATmega328P board.", "For permanent installs; needs a USB-to-TTL adapter to program.", [["Microcontroller", "ATmega328P"], ["Voltage", "5 V"]], "Arduino Pro Mini"),
  r("mega-2560-board", "Mega 2560 Development Board", "Each", 1800,
    "54 I/O pins for bigger builds.", "More pins and memory for printers and multi-sensor systems.", [["Digital I/O", "54"], ["Flash", "256 KB"]], "Arduino Mega 2560"),
  r("esp32-devkit-v1", "ESP32 DevKit V1 (WiFi + Bluetooth)", "Each", 1100,
    "Dual-core 3.3 V board with built-in WiFi and Bluetooth.", "The go-to board for IoT projects, programmable from the Arduino IDE.", [["Microcontroller", "ESP32 dual-core"], ["Wireless", "WiFi + Bluetooth"], ["Logic", "3.3 V"]], "ESP32 DevKit"),
  r("nodemcu-esp8266", "NodeMCU ESP8266 WiFi Board", "Each", 800,
    "Low-cost WiFi board.", "Simple IoT sensors that post to the web.", [["Microcontroller", "ESP8266"], ["Logic", "3.3 V"]], "NodeMCU ESP8266"),
  r("wemos-d1-mini", "Wemos D1 Mini (ESP8266)", "Each", 700,
    "Tiny ESP8266 WiFi board.", "Fits compact builds and shields.", [["Microcontroller", "ESP8266"], ["Logic", "3.3 V"]], "Wemos D1 Mini"),
  r("raspberry-pi-pico", "Raspberry Pi Pico (RP2040)", "Each", 900,
    "Dual-core microcontroller for MicroPython or C.", "26 GPIO and programmable I/O.", [["Microcontroller", "RP2040, 133 MHz"], ["Logic", "3.3 V"]], "Raspberry Pi Pico"),
  r("uno-sensor-shield-v5", "UNO Sensor Shield V5", "Each", 450,
    "Breaks out every pin to 3-pin sensor headers.", "Plug sensors and servos straight in.", [["Fits", "UNO R3"]], "Arduino sensor shield"),
  r("nano-expansion-shield", "Nano Screw-Terminal Expansion Board", "Each", 450,
    "Screw terminals for all Nano pins.", "Secure wiring for permanent installs.", [["Fits", "Nano V3"]], "Arduino Nano shield"),
  r("1-channel-relay-module", "1-Channel 5 V Relay Module", "Each", 250,
    "Switch loads from a 5 V logic pin.", "Screw terminals for the load, headers for VCC, GND and IN.", [["Channels", "1"], ["Load", "10 A at 250 V AC"]], "relay module"),
  r("relay-module-2-channel", "2-Channel 5 V Relay Module", "Each", 400,
    "Two optoisolated relays.", "Control two loads from one board.", [["Channels", "2"], ["Load", "10 A at 250 V AC"]], "2 channel relay module"),
  r("relay-module-4-channel", "4-Channel 5 V Relay Module", "Each", 600,
    "Four independent relays.", "Home-automation hardware.", [["Channels", "4"], ["Load", "10 A at 250 V AC"]], "4 channel relay module"),
  r("relay-module-8-channel", "8-Channel 5 V Relay Module", "Each", 1100,
    "Eight optoisolated relays.", "Larger automation panels.", [["Channels", "8"], ["Load", "10 A at 250 V AC"]], "8 channel relay module"),
  r("l298n-motor-driver-module", "L298N Motor Driver Module", "Each", 450,
    "Drive two DC motors or one stepper.", "Dual H-bridge with onboard heatsink.", [["Channels", "2"], ["Current", "2 A per channel"]], "L298N"),
  r("l9110s-motor-driver", "L9110S Dual Motor Driver", "Each", 250,
    "Compact driver for small motors.", "Cheap driver for toy-sized robots.", [["Channels", "2"], ["Current", "800 mA"]], "motor driver module"),
  r("tb6612fng-motor-driver", "TB6612FNG Motor Driver", "Each", 600,
    "Efficient dual driver, 1.2 A.", "Cooler and more efficient than the L298N.", [["Channels", "2"], ["Current", "1.2 A"]], "TB6612FNG"),
  r("a4988-stepper-driver", "A4988 Stepper Driver Module", "Each", 400,
    "Microstepping bipolar stepper driver.", "NEMA 17 motors in CNC and 3D printers.", [["Microstepping", "to 1/16"], ["Supply", "8 – 35 V"]], "A4988 stepper driver"),
  r("drv8825-stepper-driver", "DRV8825 Stepper Driver Module", "Each", 500,
    "1/32 microstepping driver, 2.5 A.", "Quieter and finer than the A4988.", [["Microstepping", "to 1/32"]], "DRV8825"),
  r("pca9685-servo-driver", "PCA9685 16-Channel Servo Driver", "Each", 800,
    "16 servos over two I2C wires.", "For robot arms and hexapods.", [["Channels", "16"], ["Interface", "I2C"]], "PCA9685"),
  r("1602-i2c-lcd-module", "1602 I2C LCD Display Module", "Each", 400,
    "16×2 display on two data wires.", "Readouts for meters and counters.", [["Display", "16×2"], ["Interface", "I2C"]], "LCD 1602"),
  r("2004-i2c-lcd-module", "2004 I2C LCD Display Module", "Each", 700,
    "20×4 display on two data wires.", "More text for menus and dashboards.", [["Display", "20×4"], ["Interface", "I2C"]], "LCD 2004"),
  r("oled-096-i2c-module", "0.96\" OLED Display 128×64 (I2C)", "Each", 650,
    "Sharp monochrome graphics display.", "Text, icons and small graphs.", [["Resolution", "128×64"], ["Driver", "SSD1306"]], "SSD1306 OLED"),
  r("tft-18-st7735-module", "1.8\" TFT Colour Display (ST7735)", "Each", 900,
    "128×160 colour SPI display.", "Colour UI for small gadgets.", [["Resolution", "128×160"], ["Interface", "SPI"]], "TFT LCD display"),
  r("max7219-led-matrix-8x8", "MAX7219 8×8 LED Matrix Module", "Each", 450,
    "Scrolling text on a chained matrix.", "Driven over SPI.", [["Size", "8×8"], ["Interface", "SPI"]], "MAX7219 LED matrix"),
  r("tm1637-4-digit-display", "TM1637 4-Digit 7-Segment Display", "Each", 300,
    "Clock-style numeric display.", "Clocks, timers and counters.", [["Digits", "4"], ["Interface", "2-wire"]], "TM1637 display"),
  r("ds3231-rtc-module", "DS3231 Real-Time Clock Module", "Each", 450,
    "Accurate battery-backed clock.", "Needs a CR2032 (not included).", [["Interface", "I2C"], ["Accuracy", "±2 ppm"]], "DS3231"),
  r("microsd-card-module", "MicroSD Card Module (SPI)", "Each", 250,
    "Read/write SD cards.", "Log data to CSV files.", [["Interface", "SPI"]], "microSD card module"),
  r("keypad-4x4-membrane", "4×4 Membrane Keypad", "Each", 250,
    "16-button keypad.", "PIN entry and menus.", [["Keys", "16"]], "membrane keypad"),
  r("rotary-encoder-ky040", "KY-040 Rotary Encoder Module", "Each", 250,
    "Endless dial with push button.", "Menu control for displays.", [["Pulses", "20 per rotation"]], "rotary encoder"),
  r("joystick-module-2-axis", "2-Axis Joystick Module", "Each", 250,
    "Analog thumb joystick with button.", "Robot control and games.", [["Axes", "2 analog"]], "analog joystick module"),
  r("ws2812b-led-strip-1m", "WS2812B Addressable LED Strip (1 m, 30 LEDs)", "Each", 1500,
    "Individually controllable RGB LEDs.", "Budget about 60 mA per LED and power from a separate 5 V supply.", [["LEDs", "30/m"], ["Voltage", "5 V"]], "WS2812B LED strip"),
  r("ws2812b-5050-module-pack-10", "WS2812B 5050 RGB Breakout (Pack of 10)", "Pack of 10", 600,
    "Single addressable LEDs on small boards.", "Chain them into custom light layouts.", [["Voltage", "5 V"]], "WS2812B"),
  r("ads1115-adc-module", "ADS1115 16-Bit ADC Module", "Each", 700,
    "Precise 4-channel ADC over I2C.", "Better resolution than the UNO's built-in ADC.", [["Resolution", "16-bit"], ["Interface", "I2C"]], "ADS1115"),
  r("pcf8574-io-expander", "PCF8574 I2C I/O Expander", "Each", 300,
    "Eight extra pins over I2C.", "Add inputs and outputs without extra wires.", [["Pins", "8"], ["Interface", "I2C"]], "PCF8574"),
  r("level-shifter-4ch-pack-2", "4-Channel Logic Level Shifter (Pack of 2)", "Pack of 2", 300,
    "Safely connect 3.3 V and 5 V devices.", "Protects ESP32 pins from 5 V signals.", [["Channels", "4"]], "logic level converter"),
  r("dfplayer-mini-mp3", "DFPlayer Mini MP3 Module", "Each", 500,
    "Play MP3s from a microSD card.", "Add voice prompts and sound effects.", [["Interface", "UART"]], "DFPlayer Mini"),
  r("pam8403-amp-pack-2", "PAM8403 3 W Stereo Amplifier (Pack of 2)", "Pack of 2", 350,
    "Tiny class-D amp for small speakers.", "USB-powered audio output.", [["Power", "3 W × 2"]], "PAM8403"),
  r("r307-fingerprint-module", "R307 Fingerprint Sensor Module", "Each", 2800,
    "Optical fingerprint reader with onboard matching.", "Attendance and door-lock projects.", [["Interface", "UART"], ["Capacity", "≈ 1000 prints"]], "fingerprint sensor"),
  r("usb-ttl-cp2102", "CP2102 USB-to-TTL Serial Adapter", "Each", 350,
    "Program Pro Mini / ESP-01 boards.", "3.3 V and 5 V serial.", [["Chip", "CP2102"]], "CP2102 USB UART"),
)

push("wireless-iot",
  r("hc-05-bluetooth-module", "HC-05 Bluetooth Serial Module", "Each", 850,
    "Phone control for any board.", "Master/slave Bluetooth serial.", [["Range", "≈ 10 m"], ["Logic", "3.3 V"]], "HC-05 Bluetooth"),
  r("hc-06-bluetooth-module", "HC-06 Bluetooth Slave Module", "Each", 750,
    "Simple slave-only Bluetooth.", "Quick phone connections.", [["Range", "≈ 10 m"]], "HC-06 Bluetooth"),
  r("hm-10-ble-module", "HM-10 Bluetooth 4.0 BLE Module", "Each", 1000,
    "Low-energy Bluetooth.", "Works with modern phones and iOS.", [["Standard", "BLE 4.0"]], "HM-10 BLE"),
  r("nrf24l01-radio-pack-2", "nRF24L01 2.4 GHz Radio (Pack of 2)", "Pack of 2", 700,
    "A pair of board-to-board radios.", "Add a 10 µF capacitor on the supply.", [["Frequency", "2.4 GHz"], ["Interface", "SPI"]], "nRF24L01"),
  r("lora-sx1278-ra02-pack-2", "LoRa SX1278 Ra-02 433 MHz (Pack of 2)", "Pack of 2", 2400,
    "Long-range radio, kilometres in open areas.", "Remote farm and tank sensors.", [["Frequency", "433 MHz"], ["Interface", "SPI"]], "LoRa module"),
  r("neo-6m-gps-module", "NEO-6M GPS Module with Antenna", "Each", 1400,
    "Position, speed and time.", "Needs a clear sky for the first fix.", [["Interface", "UART"]], "NEO-6M GPS"),
  r("rfid-rc522-kit", "RC522 RFID Reader Kit (Card + Key Fob)", "Kit", 650,
    "13.56 MHz RFID reader with card and fob.", "Door locks and attendance.", [["Interface", "SPI"], ["Voltage", "3.3 V"]], "RC522 RFID"),
  r("rfid-cards-13-56mhz-pack-10", "13.56 MHz RFID Cards (Pack of 10)", "Pack of 10", 300,
    "MIFARE Classic 1K cards.", "Extra cards for enrolling users.", [["Type", "MIFARE Classic 1K"]], "MIFARE card"),
  r("pn532-nfc-module", "PN532 NFC/RFID Module", "Each", 1500,
    "Reads NFC tags and phones.", "Tap-to-pay and NFC projects.", [["Interface", "I2C / SPI / UART"]], "PN532 NFC"),
  r("rf-433mhz-pair", "433 MHz RF Transmitter & Receiver Pair", "Kit", 250,
    "Cheap one-way wireless link.", "Remotes and sensors.", [["Frequency", "433 MHz"]], "433 MHz RF module"),
  r("sim800l-gsm-module", "SIM800L GSM/GPRS Module", "Each", 1300,
    "SMS and calls from a microcontroller.", "Needs a 3.4–4.4 V supply with 2 A peaks.", [["Band", "Quad-band 2G"]], "SIM800L"),
  r("esp01-esp8266-pack-2", "ESP-01 ESP8266 WiFi Module (Pack of 2)", "Pack of 2", 600,
    "Tiny serial WiFi modules.", "Add WiFi to any board over UART.", [["Logic", "3.3 V"]], "ESP-01"),
  r("esp32-cam-module", "ESP32-CAM Module with OV2640", "Each", 1500,
    "WiFi camera board.", "Needs a USB-to-TTL adapter.", [["Camera", "OV2640, 2 MP"]], "ESP32-CAM"),
  r("enc28j60-ethernet-module", "ENC28J60 Ethernet Module", "Each", 900,
    "Wired network for Arduino.", "Reliable LAN where WiFi is poor.", [["Interface", "SPI"]], "ENC28J60"),
  r("ir-remote-receiver-kit", "IR Remote & Receiver Kit", "Kit", 300,
    "Infrared remote with VS1838 receiver.", "Control projects from a handheld remote.", [["Carrier", "38 kHz"]], "infrared remote control"),
)

push("prototyping",
  r("830-point-breadboard", "830-Point Breadboard", "Each", 350,
    "Full-size solderless breadboard.", "Two power rails on each edge.", [["Tie points", "830"]], "breadboard"),
  r("400-point-mini-breadboard", "400-Point Mini Breadboard", "Each", 200,
    "Half-size breadboard.", "Fits a Nano and a few parts.", [["Tie points", "400"]], "mini breadboard"),
  r("170-point-mini-breadboard-pack-5", "170-Point Mini Breadboard (Pack of 5)", "Pack of 5", 350,
    "Tiny breadboards for single circuits.", "Hand one to each student for a small sub-circuit.", [["Tie points", "170 each"]], "mini breadboard"),
  r("jumper-wire-set", "Jumper Wire Set (M-M / M-F / F-F)", "Set", 250,
    "Assorted jumper wires.", "Colour-coded insulation.", [["Types", "M-M, M-F, F-F"]], "jumper wires"),
  r("jumper-wires-mm-pack-40", "Male-to-Male Jumper Wires 20 cm (Pack of 40)", "Pack of 40", 150,
    "Board-to-board jumpers.", "Ribbon-style, peel apart.", [["Type", "Male-male"], ["Length", "20 cm"]], "jumper wires"),
  r("jumper-wires-mf-pack-40", "Male-to-Female Jumper Wires 20 cm (Pack of 40)", "Pack of 40", 150,
    "Breadboard to modules.", "Socket on one end.", [["Type", "Male-female"], ["Length", "20 cm"]], "jumper wires"),
  r("jumper-wires-ff-pack-40", "Female-to-Female Jumper Wires 20 cm (Pack of 40)", "Pack of 40", 150,
    "Module to module.", "Sockets on both ends.", [["Type", "Female-female"], ["Length", "20 cm"]], "jumper wires"),
  r("perfboard-4x6-pack-5", "Double-Sided Perfboard 4×6 cm (Pack of 5)", "Pack of 5", 150,
    "Small perfboards.", "Single-chip or sensor circuits.", [["Size", "4×6 cm"], ["Pitch", "2.54 mm"]], "perfboard"),
  r("perfboard-5x7-pack-5", "Double-Sided Perfboard 5×7 cm (Pack of 5)", "Pack of 5", 200,
    "Permanent version of a breadboard design.", "Plated through-holes.", [["Size", "5×7 cm"], ["Pitch", "2.54 mm"]], "perfboard"),
  r("perfboard-7x9-pack-5", "Double-Sided Perfboard 7×9 cm (Pack of 5)", "Pack of 5", 250,
    "Larger perfboard.", "Room for a Nano, driver and connectors.", [["Size", "7×9 cm"]], "perfboard"),
  r("perfboard-9x15-pack-3", "Double-Sided Perfboard 9×15 cm (Pack of 3)", "Pack of 3", 300,
    "Large perfboard.", "Multi-module builds.", [["Size", "9×15 cm"]], "perfboard"),
  r("stripboard-pack-3", "Stripboard 6.5×14.5 cm (Pack of 3)", "Pack of 3", 300,
    "Copper-strip prototyping board.", "Fast layouts for linear circuits.", [["Size", "6.5×14.5 cm"]], "stripboard"),
  r("breadboard-power-module", "Breadboard Power Supply Module 3.3/5 V", "Each", 250,
    "Clean rails from USB or a jack.", "Switchable 3.3 V/5 V.", [["Input", "6.5 – 12 V or USB"]], "breadboard power supply module"),
  r("dupont-crimp-connector-kit-620", "Dupont Connector Crimp Kit (620 pcs)", "Kit", 900,
    "Make your own jumper cables.", "Housings and crimp pins in assorted sizes.", [["Contents", "Housings + pins", 620]], "Dupont connector"),
)

push("electrical",
  r("dc-power-supply-5v-2a", "5 V 2 A DC Power Supply", "Each", 600,
    "Regulated 5 V supply with barrel connector.", "For boards and servos when USB is not enough.", [["Output", "5 V, 2 A"], ["Connector", "5.5×2.1 mm"]], "DC power adapter"),
  r("dc-power-supply-9v-1a", "9 V 1 A DC Power Supply", "Each", 600,
    "Standard UNO-friendly adapter.", "Plug into the barrel jack.", [["Output", "9 V, 1 A"]], "DC power adapter"),
  r("dc-power-supply-12v-2a", "12 V 2 A DC Power Supply", "Each", 800,
    "Clean 12 V for relays, strips and motors.", "Headroom for most project loads.", [["Output", "12 V, 2 A"], ["Input", "220–240 V AC"]], "DC power adapter"),
  r("dc-power-supply-12v-5a", "12 V 5 A DC Power Supply", "Each", 1600,
    "Higher-current 12 V supply.", "LED strips, pumps and bigger motors.", [["Output", "12 V, 5 A"]], "DC power adapter"),
  r("18650-battery-holder-2x", "18650 Battery Holder — 2 Cell", "Each", 150,
    "Two-slot holder, 7.4 V in series.", "Batteries supplied separately.", [["Output", "7.4 V nominal"]], "18650 battery holder"),
  r("18650-battery-holder-1x-pack-2", "18650 Battery Holder — Single (Pack of 2)", "Pack of 2", 150,
    "Single-cell holders with leads.", "Fits TP4056 charger builds.", [["Output", "3.7 V"]], "18650 battery holder"),
  r("li-ion-18650-cell", "18650 Li-ion Cell 3.7 V 2000 mAh", "Each", 450,
    "Rechargeable cell.", "Charge only with a lithium-rated charger; never short or puncture.", [["Capacity", "≈ 2000 mAh"]], "18650 battery"),
  r("bms-3s-18650-20a", "3S 18650 BMS Protection Board 20 A", "Each", 500,
    "Protects a 3-cell lithium pack.", "Over-charge, over-discharge and short-circuit protection.", [["Cells", "3S"], ["Current", "20 A"]], "battery management system"),
  r("battery-clip-9v-pack-10", "9 V Battery Clip with Leads (Pack of 10)", "Pack of 10", 200,
    "Snap connectors for 9 V batteries.", "Power breadboard and UNO builds.", [["Type", "9 V snap"]], "9V battery clip"),
  r("aa-battery-holder-4x", "4×AA Battery Holder with Switch", "Each", 120,
    "6 V holder with on/off switch.", "Servos, motors and chassis.", [["Output", "6 V"]], "AA battery holder"),
  r("cr2032-battery-pack-5", "CR2032 Coin Cell (Pack of 5)", "Pack of 5", 300,
    "3 V lithium coin cells.", "Back up an RTC module.", [["Voltage", "3 V"]], "CR2032 battery"),
  r("tp4056-charger-pack-2", "TP4056 Li-ion Charger Module (Pack of 2)", "Pack of 2", 250,
    "USB charger for single 18650 cells.", "1 A charge; pick the protected version for battery builds.", [["Charge current", "1 A"]], "TP4056"),
  r("lm2596-buck-converter", "LM2596 Adjustable Buck Converter", "Each", 300,
    "Step voltage down efficiently.", "12 V to 5 V without linear-regulator heat.", [["Input", "4 – 35 V"], ["Current", "3 A"]], "LM2596 buck converter"),
  r("mt3608-boost-pack-2", "MT3608 Boost Converter (Pack of 2)", "Pack of 2", 250,
    "Step voltage up from a single cell.", "3.7 V to 5 V or 9 V.", [["Input", "2 – 24 V"], ["Current", "2 A"]], "boost converter"),
  r("solar-panel-6v-1w", "6 V 1 W Mini Solar Panel", "Each", 600,
    "Small panel for solar projects.", "Charge a small battery.", [["Power", "1 W"]], "solar panel"),
  r("fuse-5x20-assorted-pack-50", "Glass Fuse 5×20 mm Assorted (Pack of 50)", "Pack of 50", 300,
    "0.5 A to 10 A fuses.", "Protect supply lines on every build.", [["Contents", "Assorted 0.5–10 A", 50]], "glass fuse"),
  r("fuse-holder-5x20-pack-5", "5×20 mm Fuse Holder (Pack of 5)", "Pack of 5", 250,
    "Inline fuse holders.", "Pair with the fuse assortment.", [["Fits", "5×20 mm"]], "fuse holder"),
  r("lever-connector-kit-30", "Lever Wire Connector Kit (30 pcs)", "Kit", 700,
    "Tool-free 2/3/5-way connectors.", "Join wires without soldering.", [["Contents", "2/3/5-way", 30]], "lever nut connector"),
  r("hookup-wire-kit-22awg", "Hookup Wire Kit 22 AWG (6 colours × 5 m)", "Kit", 600,
    "Solid-core wire in six colours.", "Strip, solder or breadboard.", [["Gauge", "22 AWG"], ["Length", "6 × 5 m"]], "hookup wire"),
  r("heat-shrink-assorted-328", "Heat Shrink Tubing Assorted (328 pcs)", "Kit", 350,
    "Assorted sizes for neat insulated joints.", "Everyday bench set.", [["Contents", "2:1 shrink", 328]], "heat shrink tubing"),
  r("usb-micro-cable-1m", "Micro-USB Cable 1 m", "Each", 200,
    "Programs and powers ESP and Pico boards.", "Make sure it carries data, not just power.", [["Length", "1 m"]], "micro USB cable"),
  r("usb-a-b-cable-uno", "USB-A to USB-B Cable for UNO/Mega (1 m)", "Each", 250,
    "Program UNO and Mega boards.", "Printer-style cable.", [["Length", "1 m"]], "USB cable"),
)

push("tools-workshop",
  r("soldering-iron-60w", "60 W Soldering Iron", "Each", 1500,
    "Mains iron for through-hole work.", "Use with a stand and ventilation.", [["Power", "60 W"], ["Supply", "220–240 V"]], "soldering iron"),
  r("soldering-station-adjustable-60w", "Adjustable-Temperature Soldering Iron 60 W", "Each", 2200,
    "Dial the tip temperature from 200–450 °C.", "Better control for lead-free work and fine joints.", [["Power", "60 W"], ["Range", "200–450 °C"]], "soldering station"),
  r("soldering-iron-stand", "Soldering Iron Stand with Sponge", "Each", 350,
    "Safe resting place for a hot iron.", "Includes a cleaning sponge.", [["Includes", "Stand + sponge"]], "soldering iron stand"),
  r("solder-wire-60-40-100g", "Solder Wire 60/40 Rosin Core 0.8 mm (100 g)", "Each", 700,
    "Flux-core solder for electronics.", "Use in ventilated spaces.", [["Alloy", "60/40"], ["Diameter", "0.8 mm"]], "solder wire"),
  r("solder-wire-lead-free-100g", "Lead-Free Solder 0.8 mm (100 g)", "Each", 900,
    "Sn99.3/Cu0.7 flux-core solder.", "Lead-free for classrooms and consumer products.", [["Diameter", "0.8 mm"]], "solder wire"),
  r("soldering-flux-paste", "Soldering Flux Paste (10 g)", "Each", 250,
    "Helps solder flow.", "Cleaner tinning and rework.", [["Weight", "10 g"]], "soldering flux"),
  r("brass-tip-cleaner", "Brass Wool Tip Cleaner", "Each", 250,
    "Cleans the tip without cooling it.", "Longer tip life than a wet sponge.", [["Type", "Brass wool"]], "soldering tip cleaner"),
  r("desoldering-pump", "Desoldering Pump (Solder Sucker)", "Each", 350,
    "Removes solder when fixing mistakes.", "Heat, then press the plunger.", [["Type", "Spring plunger"]], "desoldering pump"),
  r("desoldering-braid-2mm", "Desoldering Braid 2 mm (1.5 m)", "Each", 200,
    "Copper wick for solder cleanup.", "Clears bridges and pads.", [["Width", "2 mm"]], "desoldering braid"),
  r("digital-multimeter", "Digital Multimeter", "Each", 1800,
    "Voltage, current, resistance, continuity.", "Backlit display and buzzer for troubleshooting.", [["Measures", "DC/AC V, DC A, Ω"], ["Extras", "Continuity, diode"]], "digital multimeter"),
  r("lcr-t4-component-tester", "LCR-T4 Transistor / Component Tester", "Each", 2200,
    "Identifies and measures unknown parts.", "Reads transistors, diodes, capacitors and resistors.", [["Display", "Graphic LCD"]], "component tester"),
  r("logic-analyzer-usb-8ch", "USB Logic Analyzer 24 MHz 8-Channel", "Each", 1800,
    "Debug I2C, SPI and UART traffic.", "Works with PulseView/Sigrok.", [["Channels", "8"], ["Rate", "24 MHz"]], "logic analyzer"),
  r("wire-stripper-tool", "Automatic Wire Stripper & Cutter", "Each", 600,
    "Strip insulation without nicking the wire.", "0.2–6 mm² capacity.", [["Range", "0.2–6 mm²"]], "wire stripper"),
  r("flush-cutter-side-cutter", "Flush Cutter / Side Cutter", "Each", 400,
    "Clip leads flush to the board.", "5 in side cutters.", [["Type", "Flush cut"]], "diagonal pliers"),
  r("needle-nose-pliers-5in", "Needle-Nose Pliers 5 in", "Each", 450,
    "Bend leads and hold small parts.", "Fine tips for tight spaces.", [["Size", "5 in"]], "needle-nose pliers"),
  r("esd-tweezers-pack-4", "Precision Tweezers Set (Pack of 4)", "Pack of 4", 300,
    "Handle small and SMD parts.", "Straight, curved and flat tips.", [["Contents", "4 tweezers", 4]], "tweezers"),
  r("helping-hands-stand", "Helping Hands with Magnifier", "Each", 700,
    "Holds the board while you solder.", "Two clips and a magnifier.", [["Includes", "Base, 2 clips, magnifier"]], "helping hands soldering"),
  r("precision-screwdriver-set-25", "Precision Screwdriver Set (25 pcs)", "Kit", 700,
    "Small bits for electronics.", "Covers most board and enclosure screws.", [["Contents", "25 bits + handle", 25]], "precision screwdriver set"),
  r("hot-glue-gun-20w", "Mini Hot Glue Gun 20 W", "Each", 700,
    "Fix components and wires quickly.", "Great for chassis and enclosures.", [["Power", "20 W"], ["Glue", "7 mm sticks"]], "hot glue gun"),
  r("hot-glue-sticks-pack-10", "Hot Glue Sticks 7 mm (Pack of 10)", "Pack of 10", 200,
    "Refills for the mini glue gun.", "Clear 7 mm sticks.", [["Diameter", "7 mm"]], "hot glue stick"),
  r("digital-caliper-150mm", "Digital Caliper 150 mm", "Each", 1200,
    "Measure parts to 0.01 mm.", "Check pitch, diameter and thickness.", [["Range", "0–150 mm"]], "digital caliper"),
  r("safety-glasses", "Safety Glasses", "Each", 250,
    "Protect your eyes when soldering and cutting.", "Wear whenever clipping leads.", [["Type", "Clear polycarbonate"]], "safety glasses"),
)

push("enclosures-hardware",
  r("abs-project-box-100x60x25", "ABS Project Box 100×60×25 mm", "Each", 300,
    "Small box for a Nano project.", "Screw-lid enclosure.", [["Size", "100×60×25 mm"]], "plastic project box"),
  r("abs-project-box-150x90x45", "ABS Project Box 150×90×45 mm", "Each", 450,
    "Box for UNO builds and relay boards.", "Screw-lid enclosure.", [["Size", "150×90×45 mm"]], "plastic project box"),
  r("abs-project-box-200x120x75", "ABS Project Box 200×120×75 mm", "Each", 800,
    "Large box for multi-module panels.", "Room for a Mega, relays and power supply.", [["Size", "200×120×75 mm"]], "plastic project box"),
  r("m3-standoff-screw-kit-120", "M3 Standoff & Screw Kit (120 pcs)", "Kit", 500,
    "Mount boards in enclosures.", "Brass standoffs, screws and nuts.", [["Contents", "Standoffs, screws, nuts", 120]], "standoff spacer"),
  r("m3-screw-assortment-300", "M3 Screw & Nut Assortment (300 pcs)", "Kit", 400,
    "Stock of M3 screws and nuts.", "Compartment box.", [["Contents", "Assorted M3", 300]], "machine screw"),
  r("cable-gland-pg7-pack-10", "Cable Gland PG7 (Pack of 10)", "Pack of 10", 300,
    "Strain relief for cables entering a box.", "Keeps dust out and wires secure.", [["Size", "PG7"]], "cable gland"),
  r("rubber-feet-pack-20", "Self-Adhesive Rubber Feet (Pack of 20)", "Pack of 20", 150,
    "Stop projects sliding on the desk.", "Stick to the base of an enclosure.", [["Type", "Adhesive"]], "rubber feet"),
  r("knob-for-pot-pack-5", "Potentiometer Knob (Pack of 5)", "Pack of 5", 200,
    "Finish dials neatly.", "Fits 6 mm shafts.", [["Fits", "6 mm shaft"]], "potentiometer knob"),
  r("heatsink-to220-pack-5", "TO-220 Heatsink (Pack of 5)", "Pack of 5", 250,
    "Cool regulators and MOSFETs.", "Bolt to a TO-220 part.", [["Fits", "TO-220"]], "heat sink"),
)

push("robotics-automation",
  r("mini-water-pump-5v", "Mini Submersible Water Pump — 5 V", "Each", 500,
    "Small 5 V DC pump.", "Switch through a relay or MOSFET.", [["Voltage", "5 V DC"], ["Style", "Submersible"]], "submersible water pump"),
  r("diaphragm-pump-12v", "12 V Diaphragm Water Pump", "Each", 1400,
    "Self-priming pump for dispensers and irrigation.", "Higher pressure than the mini pump.", [["Voltage", "12 V DC"]], "diaphragm pump"),
  r("solenoid-valve-12v", "12 V Solenoid Water Valve", "Each", 900,
    "Electric valve for irrigation.", "Use a relay or MOSFET with a flyback diode.", [["Voltage", "12 V DC"], ["Type", "Normally closed"]], "solenoid valve"),
  r("sg90-micro-servo", "SG90 Micro Servo Motor", "Each", 350,
    "9 g hobby servo.", "The standard servo for beginner robotics.", [["Torque", "1.8 kg·cm"], ["Rotation", "≈ 180°"]], "SG90 servo"),
  r("mg90s-metal-servo", "MG90S Metal-Gear Micro Servo", "Each", 550,
    "Stronger micro servo.", "Metal gears for arms and flaps.", [["Torque", "2.2 kg·cm"]], "MG90S servo"),
  r("mg996r-servo", "MG996R High-Torque Servo", "Each", 900,
    "Metal-gear servo for robot arms.", "Power from a separate supply.", [["Torque", "9.4 kg·cm"]], "MG996R servo"),
  r("fs90r-continuous-servo", "FS90R Continuous Rotation Servo", "Each", 600,
    "Servo that spins freely.", "Wheels for small robots.", [["Rotation", "Continuous"]], "continuous rotation servo"),
  r("tt-gear-motor-wheel-pack-2", "TT Gear Motor with Wheel (Pack of 2)", "Pack of 2", 500,
    "Yellow geared motors with wheels.", "The standard robot-car pair.", [["Voltage", "3–6 V"], ["Contents", "2 motors + 2 wheels", 2]], "TT gear motor"),
  r("n20-gear-motor-pack-2", "N20 Micro Gear Motor 6 V (Pack of 2)", "Pack of 2", 700,
    "Tiny geared motors.", "Mini robots and sumo bots.", [["Voltage", "6 V"]], "N20 motor"),
  r("dc-motor-130-pack-2", "130 DC Hobby Motor (Pack of 2)", "Pack of 2", 200,
    "Small DC motors for toys and fans.", "Drive through a transistor or L9110S.", [["Voltage", "3–6 V"]], "DC motor"),
  r("vibration-motor-pack-5", "Coin Vibration Motor (Pack of 5)", "Pack of 5", 300,
    "Haptic feedback motors.", "Wearables and alerts.", [["Voltage", "3 V"]], "vibration motor"),
  r("stepper-28byj-48-uln2003", "28BYJ-48 Stepper Motor with ULN2003 Driver", "Kit", 450,
    "Geared stepper with driver board.", "Slow, precise rotation.", [["Steps", "2048 per rev"]], "28BYJ-48 stepper"),
  r("nema17-stepper-motor", "NEMA 17 Stepper Motor", "Each", 1800,
    "Bipolar stepper for CNC and printers.", "Pair with an A4988 and 12 V.", [["Step angle", "1.8°"], ["Current", "1.5 A"]], "NEMA 17"),
  r("robot-chassis-2wd-kit", "2WD Robot Car Chassis Kit", "Kit", 1500,
    "Acrylic chassis with motors, wheels and caster.", "Add a UNO, driver and batteries.", [["Includes", "Chassis, 2 motors, 2 wheels, caster"]], "robot chassis"),
  r("robot-chassis-4wd-kit", "4WD Robot Car Chassis Kit", "Kit", 2800,
    "Four-motor chassis.", "More traction and load capacity.", [["Includes", "Chassis, 4 motors, 4 wheels"]], "4WD robot chassis"),
  r("robotic-arm-4dof-kit", "4-DOF Acrylic Robotic Arm Kit", "Kit", 3500,
    "Assemble-it-yourself arm frame.", "Add 4 servos and a PCA9685 for a working arm.", [["Degrees of freedom", "4"]], "robotic arm"),
  r("mecanum-wheel-set-60mm", "60 mm Mecanum Wheel Set (4 wheels)", "Set", 3500,
    "Holonomic wheels for sideways motion.", "Omnidirectional robot platforms.", [["Diameter", "60 mm"]], "mecanum wheel"),
  r("ball-caster-wheel-pack-2", "Ball Caster Wheel (Pack of 2)", "Pack of 2", 200,
    "Support wheels for two-wheel robots.", "Lets a 2WD chassis turn freely.", [["Mount", "M3"]], "ball caster"),
  r("dc-fan-5v-40mm", "5 V 40 mm DC Cooling Fan", "Each", 350,
    "Small fan for cooling enclosures.", "Switch with a MOSFET for temperature control.", [["Voltage", "5 V DC"], ["Size", "40 mm"]], "computer fan"),
)

/* ================================================================== */
/* BUILD PRODUCTS                                                      */
/* ================================================================== */

const categoryOrder = new Map(diyCategories.map((c) => [c.slug, c.sortOrder]))

function build(categorySlug: string, row: Row, sortOrder: number): DiySeedProduct {
  const pack = row.unit.match(/^Pack of (\d+)/)
  const specifications: DiySeedSpec[] = [
    ...(pack
      ? [{ label: "Pack size", material: `${pack[1]} pieces`, pieces: Number(pack[1]) }]
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
    seoTitle: `${row.name} | TijwaWelders DIY`,
    seoDesc: `${row.short} Add it to your quote on WhatsApp.`,
  }
}

export const diyProducts: DiySeedProduct[] = Object.entries(rows)
  .sort(([a], [b]) => (categoryOrder.get(a) ?? 99) - (categoryOrder.get(b) ?? 99))
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
  parts: [slug: string, quantity: number, required: boolean][],
): DiySeedProject {
  projectOrder += 1
  return {
    title,
    slug,
    category,
    shortDesc,
    description,
    steps: steps.map(([t, b]) => ({ title: t, body: b })),
    images: [{ url: `/seed/${heroProductSlug}.jpg`, alt: `${title} — main component` }],
    isFeatured,
    sortOrder: projectOrder,
    seoTitle: `${title} Project | TijwaWelders DIY`,
    seoDesc: `${shortDesc} Parts list and steps included.`,
    products: parts.map(([productSlug, quantity, isRequired]) => ({ productSlug, quantity, isRequired })),
  }
}

export const diyProjects: DiySeedProject[] = [
  project("automatic-plant-watering-system", "Automatic Plant Watering System", "Electronics Projects",
    "Water plants only when the soil is dry, using a moisture sensor, relay and small pump.",
    "A soil probe reads how wet the pot is. When the reading crosses a dry threshold, the board switches a relay, which switches the pump. Teaches analog reading, relay driving and separating pump power from board power.",
    [
      ["Read the sensor", "Wire the probe to 5 V, ground and an analog pin. Note the reading in air and in water for your dry and wet thresholds."],
      ["Set thresholds", "Switch the relay on after a few dry readings and off once wet. The gap stops chattering."],
      ["Wire relay and pump", "Put the relay's common terminal in series with the pump's positive lead. Keep the pump on its own supply and share ground."],
      ["Test a full cycle", "Place the probe away from the pot wall, aim the outlet and run a dry-to-wet cycle before fine-tuning."],
    ],
    "capacitive-soil-moisture-sensor", true,
    [["uno-r3-development-board", 1, true], ["capacitive-soil-moisture-sensor", 1, true], ["1-channel-relay-module", 1, true],
     ["mini-water-pump-5v", 1, true], ["jumper-wire-set", 1, false], ["dc-power-supply-12v-2a", 1, false]]),

  project("ultrasonic-distance-meter", "Ultrasonic Distance Meter", "Electronics Projects",
    "Measure distance with an HC-SR04 and show it on a 16×2 LCD.",
    "The HC-SR04 gives a time-of-flight reading; the board converts it to centimetres and prints it on the LCD.",
    [
      ["Wire the sensor", "Connect VCC, GND, Trig to an output and Echo to an input."],
      ["Add the display", "Wire the LCD's I2C backpack and run an I2C scanner to confirm its address."],
      ["Time the pulse", "Hold Trig high for 10 µs, time Echo, multiply by the speed of sound and halve it."],
      ["Smooth the reading", "Average the last few readings to remove jumps."],
    ],
    "hc-sr04-ultrasonic-sensor", true,
    [["uno-r3-development-board", 1, true], ["hc-sr04-ultrasonic-sensor", 1, true], ["1602-i2c-lcd-module", 1, true],
     ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("motion-activated-night-light", "Motion-Activated Night Light", "Electronics Projects",
    "Switch a light on automatically when a PIR sensor detects movement.",
    "A PIR module signals the board when something moves; the board lights an LED for a set time.",
    [
      ["Build the LED branch", "Place an LED and a 220 Ω resistor on the breadboard, driven from a digital pin."],
      ["Mount the PIR", "Wire to power, ground and an input. Let it settle for a minute after power-up."],
      ["Write the hold timer", "Switch on at motion and off a fixed interval after the last trigger using millis()."],
      ["Test the field of view", "Walk through from different angles and tune the sensitivity dial."],
    ],
    "pir-motion-sensor", false,
    [["uno-r3-development-board", 1, true], ["pir-motion-sensor", 1, true], ["led-5mm-white-pack-50", 1, true],
     ["resistor-220r-pack-100", 1, true], ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false],
     ["18650-battery-holder-2x", 1, false]]),

  project("555-timer-led-flasher", "555 Timer LED Flasher", "Beginner Projects",
    "A blinking light with no code — just a 555, resistors and a capacitor.",
    "The 555 in astable mode switches its output at a rate set by two resistors and a capacitor. The best first circuit for learning how parts work together.",
    [
      ["Place the 555", "Seat it across the breadboard gap, pin 8 to +9 V, pin 1 to ground, pin 4 to +9 V."],
      ["Add timing parts", "1 kΩ from pin 7 to +9 V, 10 kΩ between pins 7 and 6, link 6 and 2, and a 100 µF capacitor from pin 2 to ground."],
      ["Connect the LED", "From pin 3 through a 220 Ω resistor to the LED, then ground."],
      ["Change the speed", "Swap the capacitor or resistor to see how the blink rate changes."],
    ],
    "ne555-timer-pack-5", true,
    [["ne555-timer-pack-5", 1, true], ["resistor-1k-pack-100", 1, true], ["resistor-10k-pack-100", 1, true],
     ["resistor-220r-pack-100", 1, true], ["electrolytic-100u-pack-20", 1, true], ["led-kit-5mm", 1, true],
     ["830-point-breadboard", 1, true], ["battery-clip-9v-pack-10", 1, false], ["jumper-wire-set", 1, false]]),

  project("arduino-traffic-light", "Arduino Traffic Light with Pedestrian Button", "Beginner Projects",
    "Red, yellow and green LEDs cycle on a timer; a button requests a crossing.",
    "A first multi-LED project with a state machine and a button interrupt.",
    [
      ["Wire three LEDs", "Each LED goes through its own 220 Ω resistor to a digital pin."],
      ["Add the button", "Wire a tactile button to ground with INPUT_PULLUP."],
      ["Write the cycle", "Cycle green, yellow, red using millis(); a button press shortens the green phase."],
    ],
    "led-5mm-red-pack-50", false,
    [["uno-r3-development-board", 1, true], ["led-5mm-red-pack-50", 1, true], ["led-5mm-yellow-pack-50", 1, true],
     ["led-5mm-green-pack-50", 1, true], ["resistor-220r-pack-100", 1, true], ["tactile-button-6x6-pack-20", 1, true],
     ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("oled-weather-station", "OLED Weather Station", "Electronics Projects",
    "Show temperature, humidity and pressure on a small OLED screen.",
    "A DHT22 reads temperature and humidity, a BMP280 reads pressure, and the OLED displays all three.",
    [
      ["Wire the I2C devices", "BMP280 and OLED share SDA and SCL at different addresses."],
      ["Wire the DHT22", "Connect its data pin with a 10 kΩ pull-up if the module lacks one."],
      ["Read and display", "Read every few seconds and draw the values on the OLED."],
    ],
    "bmp280-pressure-sensor", false,
    [["uno-r3-development-board", 1, true], ["dht22-temp-humidity-sensor", 1, true], ["bmp280-pressure-sensor", 1, true],
     ["oled-096-i2c-module", 1, true], ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("temperature-controlled-fan", "Temperature-Controlled Fan", "Electronics Projects",
    "A fan that speeds up as the temperature rises.",
    "A DHT22 measures temperature and a MOSFET drives a fan with PWM, with a flyback diode for protection.",
    [
      ["Wire the sensor", "Connect the DHT22 to a digital pin."],
      ["Wire the MOSFET", "Fan negative to the MOSFET drain, source to ground, gate to a PWM pin through a resistor."],
      ["Map temperature to speed", "Scale PWM duty between a low and high temperature."],
    ],
    "dc-fan-5v-40mm", false,
    [["uno-r3-development-board", 1, true], ["dht22-temp-humidity-sensor", 1, true], ["dc-fan-5v-40mm", 1, true],
     ["mosfet-irlz44n-pack-5", 1, true], ["diode-1n4007-pack-20", 1, true], ["resistor-10k-pack-100", 1, true],
     ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("rfid-door-lock", "RFID Door Lock", "Electronics Projects",
    "Open a latch with a servo when an authorised card is scanned.",
    "An RC522 reads each card's ID; on a match a servo opens the latch, otherwise a buzzer sounds.",
    [
      ["Wire the reader", "Connect the RC522 to SPI and 3.3 V — never 5 V."],
      ["Add outputs", "Wire the servo, an LED with a 220 Ω resistor and the buzzer."],
      ["Store allowed IDs", "Keep authorised IDs in an array and compare each scan."],
      ["Drive the latch", "On a match, open the servo, wait, close. Otherwise beep."],
    ],
    "rfid-rc522-kit", true,
    [["uno-r3-development-board", 1, true], ["rfid-rc522-kit", 1, true], ["sg90-micro-servo", 1, true],
     ["buzzer-active-5v-pack-5", 1, true], ["led-5mm-green-pack-50", 1, true], ["resistor-220r-pack-100", 1, true],
     ["rfid-cards-13-56mhz-pack-10", 1, false], ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("obstacle-avoiding-robot", "Obstacle-Avoiding Robot Car", "Robotics Projects",
    "A two-wheel robot that drives forward and turns away from obstacles.",
    "An ultrasonic sensor on a servo scans ahead. Closer than a set distance, the robot stops, looks left and right and turns to the clearer side.",
    [
      ["Assemble the chassis", "Mount the motors, wheels and caster, and fix the battery holder underneath."],
      ["Wire the driver", "Connect motors to the L298N, battery to its supply and logic pins to the UNO. Share ground."],
      ["Mount the scanner", "Fix the HC-SR04 to the servo horn and wire the servo to a PWM pin."],
      ["Write the avoid logic", "Drive forward until close, stop, scan both ways, then turn toward the larger distance."],
    ],
    "robot-chassis-2wd-kit", true,
    [["uno-r3-development-board", 1, true], ["robot-chassis-2wd-kit", 1, true], ["l298n-motor-driver-module", 1, true],
     ["hc-sr04-ultrasonic-sensor", 1, true], ["sg90-micro-servo", 1, true], ["18650-battery-holder-2x", 1, true],
     ["li-ion-18650-cell", 2, true], ["slide-switch-spdt-pack-10", 1, false], ["jumper-wires-mf-pack-40", 1, false]]),

  project("bluetooth-controlled-car", "Bluetooth Controlled Car", "Robotics Projects",
    "Drive a robot car from your phone.",
    "An HC-05 receives commands and the UNO turns each into motor directions through an L298N.",
    [
      ["Build the chassis", "Mount motors, wheels and the battery holder."],
      ["Wire Bluetooth", "Connect HC-05 to software-serial pins. Put a 1 kΩ / 2.2 kΩ divider on its RX line."],
      ["Wire the driver", "L298N inputs to four digital pins, motors to its outputs."],
      ["Parse commands", "Map single characters from the phone app to forward, back, left, right and stop."],
    ],
    "hc-05-bluetooth-module", false,
    [["uno-r3-development-board", 1, true], ["hc-05-bluetooth-module", 1, true], ["l298n-motor-driver-module", 1, true],
     ["robot-chassis-2wd-kit", 1, true], ["18650-battery-holder-2x", 1, true], ["li-ion-18650-cell", 2, true],
     ["resistor-1k-pack-100", 1, false], ["resistor-2k2-pack-100", 1, false], ["jumper-wires-mf-pack-40", 1, false]]),

  project("wifi-home-automation-switch", "WiFi Home Automation Switch", "IoT Projects",
    "Switch four appliances from a phone or browser using an ESP32.",
    "The ESP32 hosts a small web page; tapping a button toggles a relay. Mains wiring must be done carefully, inside an enclosure.",
    [
      ["Wire the relay board", "Power it from 5 V and connect IN1–IN4 to four ESP32 pins."],
      ["Write the web server", "One button per relay that flips its pin."],
      ["Wire loads safely", "Use screw terminals, keep mains inside the enclosure and never touch it while powered."],
      ["Mount in the box", "Fix boards with standoffs and close the lid before connecting to mains."],
    ],
    "esp32-devkit-v1", true,
    [["esp32-devkit-v1", 1, true], ["relay-module-4-channel", 1, true], ["dc-power-supply-5v-2a", 1, true],
     ["abs-project-box-150x90x45", 1, true], ["screw-terminal-2p-pack-10", 1, false],
     ["standoff-m3-10mm-pack-20", 1, false], ["jumper-wires-ff-pack-40", 1, false]]),

  project("digital-clock-ds3231", "Digital Clock with DS3231", "Electronics Projects",
    "A battery-backed clock on a 4-digit display with set buttons.",
    "A DS3231 keeps accurate time through power loss and a TM1637 shows hours and minutes.",
    [
      ["Wire the RTC", "Connect the DS3231 to SDA and SCL and set the time once."],
      ["Wire the display", "TM1637 CLK and DIO to two digital pins."],
      ["Add set buttons", "Two tactile buttons with INPUT_PULLUP adjust hours and minutes."],
    ],
    "ds3231-rtc-module", false,
    [["uno-r3-development-board", 1, true], ["ds3231-rtc-module", 1, true], ["tm1637-4-digit-display", 1, true],
     ["tactile-button-6x6-pack-20", 1, true], ["cr2032-battery-pack-5", 1, false],
     ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("fire-and-gas-alarm", "Fire & Gas Alarm", "Electronics Projects",
    "Sound an alarm when a flame or gas/smoke is detected.",
    "A flame sensor and MQ-2 watch for danger; when either trips, a buzzer sounds and a red LED lights.",
    [
      ["Wire the sensors", "Flame sensor digital output and MQ-2 analog output to the board."],
      ["Warm up the gas sensor", "Let the MQ-2 heat a few minutes and log normal readings to choose a threshold."],
      ["Wire the alarm", "Buzzer and a red LED with a 220 Ω resistor."],
      ["Write the logic", "Flame or gas over threshold sounds the buzzer and lights the LED."],
    ],
    "mq2-gas-sensor-module", false,
    [["uno-r3-development-board", 1, true], ["flame-sensor-module", 1, true], ["mq2-gas-sensor-module", 1, true],
     ["buzzer-active-5v-pack-5", 1, true], ["led-5mm-red-pack-50", 1, true], ["resistor-220r-pack-100", 1, true],
     ["830-point-breadboard", 1, false], ["jumper-wire-set", 1, false]]),

  project("smart-dustbin", "Smart Dustbin", "Robotics Projects",
    "A bin lid that opens automatically when you approach.",
    "An ultrasonic sensor watches for a hand; when something is in range a servo lifts the lid, then closes it.",
    [
      ["Mount the sensor", "Fix the HC-SR04 at the front of the bin."],
      ["Attach the servo", "Mount it near the hinge with a link arm to the lid."],
      ["Write the trigger", "Under about 30 cm, open, wait, close."],
      ["Power it", "Use a 5 V supply of at least 1 A with common ground."],
    ],
    "sg90-micro-servo", false,
    [["uno-r3-development-board", 1, true], ["hc-sr04-ultrasonic-sensor", 1, true], ["sg90-micro-servo", 1, true],
     ["dc-power-supply-5v-2a", 1, false], ["jumper-wires-mf-pack-40", 1, false], ["cable-tie-150mm-pack-100", 1, false]]),

  project("gps-sms-tracker", "GPS SMS Tracker", "IoT Projects",
    "Text your location on request.",
    "A NEO-6M gets position and a SIM800L texts a map link when it receives an SMS. Needs a 2G-capable SIM and a supply that can deliver 2 A peaks.",
    [
      ["Wire the GPS", "NEO-6M TX/RX to software-serial pins; test outdoors for a first fix."],
      ["Power the GSM module", "Use an LM2596 set to about 4.0 V for the SIM800L, with common ground."],
      ["Reply to SMS", "On a request, read the GPS position and send a Google Maps link."],
    ],
    "neo-6m-gps-module", false,
    [["uno-r3-development-board", 1, true], ["neo-6m-gps-module", 1, true], ["sim800l-gsm-module", 1, true],
     ["lm2596-buck-converter", 1, true], ["dc-power-supply-12v-2a", 1, false], ["abs-project-box-150x90x45", 1, false],
     ["jumper-wires-ff-pack-40", 1, false]]),
]