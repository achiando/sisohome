import math
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 675
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "seed")
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

PALETTES = {
    "sensors":    {"top": (12, 74, 110),  "bottom": (6, 44, 70),   "accent": (34, 211, 238)},
    "modules":    {"top": (49, 46, 129),  "bottom": (30, 27, 75),  "accent": (165, 180, 252)},
    "prototyping":{"top": (6, 78, 59),    "bottom": (4, 47, 40),   "accent": (74, 222, 128)},
    "components": {"top": (120, 53, 15),  "bottom": (69, 26, 3),   "accent": (251, 191, 36)},
    "electrical": {"top": (12, 74, 110),  "bottom": (12, 52, 99),  "accent": (56, 189, 248)},
    "tools":      {"top": (136, 28, 49),  "bottom": (76, 15, 30),  "accent": (251, 113, 133)},
    "robotics":   {"top": (88, 28, 135),  "bottom": (51, 17, 88),  "accent": (232, 121, 249)},
    "projects":   {"top": (15, 23, 42),   "bottom": (30, 41, 59),  "accent": (56, 189, 248)},
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(pal):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(pal["top"], pal["bottom"], y / H))
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-W * 0.2, -H * 0.5, W * 0.7, H * 0.9], fill=46)
    white = Image.new("RGB", (W, H), (255, 255, 255))
    img = Image.composite(white, img, glow.point(lambda v: int(v * 0.4)))
    return img


def grid_overlay(img, accent):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for x in range(0, W, 48):
        d.line([(x, 0), (x, H)], fill=(*accent, 12), width=1)
    for y in range(0, H, 48):
        d.line([(0, y), (W, y)], fill=(*accent, 12), width=1)
    return Image.alpha_composite(img.convert("RGBA"), ov)


def motif_waves(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    for r in range(70, 330, 42):
        d.arc([cx - r, cy - r, cx + r, cy + r], -62, 62, fill=(*accent, 150), width=7)
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(*accent, 220))


def motif_chip(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    s = 150
    d.rounded_rectangle([cx - s, cy - s, cx + s, cy + s], radius=18, outline=(*accent, 200), width=6)
    d.rounded_rectangle([cx - s * 0.45, cy - s * 0.45, cx + s * 0.45, cy + s * 0.45], radius=8, outline=(*accent, 160), width=4)
    for i in range(-3, 4):
        off = i * 40
        d.rectangle([cx + s - 8, cy + off - 8, cx + s + 34, cy + off + 8], fill=(*accent, 170))
        d.rectangle([cx - s - 34, cy + off - 8, cx - s + 8, cy + off + 8], fill=(*accent, 170))
        d.rectangle([cx + off - 8, cy + s - 8, cx + off + 8, cy + s + 34], fill=(*accent, 170))
        d.rectangle([cx + off - 8, cy - s - 34, cx + off + 8, cy - s + 8], fill=(*accent, 170))


def motif_grid(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    w, h = 320, 220
    d.rounded_rectangle([cx - w, cy - h, cx + w, cy + h], radius=16, outline=(*accent, 190), width=5)
    for row in range(-5, 6):
        for col in range(-8, 9):
            x, y = cx + col * 36, cy + row * 36
            if abs(x - cx) < w - 24 and abs(y - cy) < h - 24:
                d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(*accent, 150))
    d.line([(cx - w + 14, cy - 70), (cx + w - 14, cy - 70)], fill=(*accent, 200), width=4)
    d.line([(cx - w + 14, cy + 70), (cx + w - 14, cy + 70)], fill=(*accent, 200), width=4)


def motif_bolt(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    pts = [(cx + 40, cy - 190), (cx - 70, cy + 10), (cx - 5, cy + 10),
           (cx - 45, cy + 195), (cx + 80, cy - 25), (cx + 10, cy - 25)]
    d.polygon(pts, fill=(*accent, 130), outline=(*accent, 230))
    d.line(pts + [pts[0]], fill=(*accent, 230), width=5)


def motif_gear(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    r = 150
    for i in range(10):
        a = i * math.pi / 5
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        d.ellipse([x - 34, y - 34, x + 34, y + 34], fill=(*accent, 130))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*accent, 110), outline=(*accent, 220), width=6)
    d.ellipse([cx - 60, cy - 60, cx + 60, cy + 60], fill=(0, 0, 0, 0), outline=(*accent, 220), width=6)


def motif_glow(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    for r, a in [(240, 40), (180, 70), (125, 110), (75, 170), (34, 240)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*accent, a))
    for i in range(14):
        ang = i * math.tau / 14
        d.line([(cx + math.cos(ang) * 255, cy + math.sin(ang) * 255),
                (cx + math.cos(ang) * 320, cy + math.sin(ang) * 320)],
               fill=(*accent, 130), width=6)


def motif_motor(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.5)
    r = 140
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*accent, 220), width=7)
    d.ellipse([cx - 46, cy - 46, cx + 46, cy + 46], fill=(*accent, 200))
    d.rectangle([cx + r, cy - 26, cx + r + 90, cy + 26], fill=(*accent, 170))
    for i in range(6):
        a = i * math.tau / 6
        d.line([(cx + math.cos(a) * 60, cy + math.sin(a) * 60),
                (cx + math.cos(a) * (r - 14), cy + math.sin(a) * (r - 14))],
               fill=(*accent, 150), width=5)


def motif_dome(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.58)
    r = 170
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=(*accent, 120), outline=(*accent, 220), width=6)
    for rr in (60, 110, 155):
        d.arc([cx - rr, cy - rr, cx + rr, cy + rr], 180, 360, fill=(*accent, 170), width=4)
    for i in range(-2, 3):
        d.line([(cx + i * 60, cy), (cx + i * 44, cy - int(math.sqrt(max(r * r - (i * 60) ** 2, 1))))],
               fill=(*accent, 140), width=3)
    d.rectangle([cx - r, cy + 6, cx + r, cy + 34], fill=(*accent, 160))


def motif_drops(d, accent):
    for (dx, dy, s) in [(0, 0, 1.0), (-150, 90, 0.65), (140, 120, 0.55), (-60, -140, 0.5)]:
        cx, cy = int(W * 0.76) + dx, int(H * 0.5) + dy
        r = int(90 * s)
        d.pieslice([cx - r, cy - r, cx + r, cy + r], 0, 180, fill=(*accent, 140))
        d.polygon([(cx - r, cy), (cx, cy - int(r * 1.9)), (cx + r, cy)], fill=(*accent, 140))
        d.line([(cx - r, cy), (cx + r, cy)], fill=(*accent, 140))


def motif_rays(d, accent):
    cx, cy = int(W * 0.76), int(H * 0.44)
    for i in range(12):
        a = math.pi * 0.15 + i * math.pi * 0.7 / 11
        d.line([(cx, cy), (cx + math.cos(a) * 420, cy + math.sin(a) * 420)],
               fill=(*accent, 90), width=8)
    d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(*accent, 220))
    d.arc([cx - 130, cy - 130, cx + 130, cy + 130], int(math.pi * 0.15), int(math.pi * 0.85),
          fill=(*accent, 170), width=6)


MOTIFS = {
    "waves": motif_waves, "chip": motif_chip, "grid": motif_grid, "bolt": motif_bolt,
    "gear": motif_gear, "glow": motif_glow, "motor": motif_motor, "dome": motif_dome,
    "drops": motif_drops, "rays": motif_rays,
}


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def render(filename, label, kicker, palette_name, motif_name, variant=0):
    pal = dict(PALETTES[palette_name])
    if variant:
        pal["top"], pal["bottom"] = pal["bottom"], pal["top"]
        accent = tuple(min(255, int(c * 0.85 + 40)) for c in pal["accent"])
    else:
        accent = pal["accent"]

    img = gradient(pal)
    img = grid_overlay(img, accent)
    d = ImageDraw.Draw(img)

    MOTIFS[motif_name](d, accent)

    title_font = ImageFont.truetype(FONT_BOLD, 64)
    kicker_font = ImageFont.truetype(FONT_BOLD, 24)
    word_font = ImageFont.truetype(FONT_BOLD, 22)
    d.text((64, 56), kicker.upper(), font=kicker_font, fill=(*accent, 255))

    y = int(H * 0.34)
    for line in wrap(d, label, title_font, 620)[:3]:
        d.text((64, y), line, font=title_font, fill=(248, 250, 252, 255))
        y += 78

    d.line([(64, H - 74), (148, H - 74)], fill=(*accent, 255), width=4)
    d.text((64, H - 58), "TijwaWelders DIY", font=word_font, fill=(226, 232, 240, 255))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, filename)
    img.convert("RGB").save(path, "JPEG", quality=84, optimize=True)
    print("wrote", path)


ITEMS = [
    ("hc-sr04-ultrasonic-sensor.jpg", "HC-SR04 Ultrasonic Sensor", "Sensors", "sensors", "waves", 0),
    ("hc-sr04-ultrasonic-sensor-2.jpg", "HC-SR04 Detail", "Sensors", "sensors", "chip", 1),
    ("dht11-temp-humidity-sensor.jpg", "DHT11 Temperature & Humidity Sensor", "Sensors", "sensors", "chip", 0),
    ("pir-motion-sensor.jpg", "HC-SR501 PIR Motion Sensor", "Sensors", "sensors", "dome", 0),
    ("capacitive-soil-moisture-sensor.jpg", "Capacitive Soil Moisture Sensor", "Sensors", "sensors", "drops", 0),
    ("uno-r3-development-board.jpg", "UNO R3 Development Board", "Modules & Boards", "modules", "chip", 0),
    ("uno-r3-development-board-2.jpg", "UNO R3 Board Detail", "Modules & Boards", "modules", "grid", 1),
    ("1-channel-relay-module.jpg", "1-Channel 5V Relay Module", "Modules & Boards", "modules", "bolt", 0),
    ("l298n-motor-driver-module.jpg", "L298N Motor Driver Module", "Modules & Boards", "modules", "motor", 0),
    ("1602-i2c-lcd-module.jpg", "1602 I2C LCD Display Module", "Modules & Boards", "modules", "grid", 0),
    ("830-point-breadboard.jpg", "830-Point Breadboard", "Prototyping", "prototyping", "grid", 0),
    ("830-point-breadboard-2.jpg", "Breadboard Close-Up", "Prototyping", "prototyping", "chip", 1),
    ("jumper-wire-set.jpg", "Jumper Wire Set - 65 Pieces", "Prototyping", "prototyping", "grid", 1),
    ("resistor-kit-1-4w.jpg", "Resistor Kit - 1/4 W Assorted", "Electronics Components", "components", "glow", 0),
    ("led-kit-5mm.jpg", "LED Kit - 5 mm Assorted", "Electronics Components", "components", "glow", 1),
    ("dc-power-supply-12v-2a.jpg", "12V 2A DC Power Supply", "Electrical", "electrical", "bolt", 0),
    ("18650-battery-holder-2x.jpg", "18650 Battery Holder - 2 Cell", "Electrical", "electrical", "bolt", 1),
    ("soldering-iron-60w.jpg", "60 W Soldering Iron", "Tools & Workshop", "tools", "gear", 0),
    ("digital-multimeter.jpg", "Digital Multimeter", "Tools & Workshop", "tools", "gear", 1),
    ("mini-water-pump-5v.jpg", "Mini Submersible Water Pump - 5 V", "Robotics & Automation", "robotics", "motor", 0),
    ("project-automatic-plant-watering.jpg", "Automatic Plant Watering System", "Project", "projects", "drops", 0),
    ("project-ultrasonic-distance-meter.jpg", "Ultrasonic Distance Meter", "Project", "projects", "waves", 0),
    ("project-motion-night-light.jpg", "Motion-Activated Night Light", "Project", "projects", "rays", 0),
]

if __name__ == "__main__":
    for item in ITEMS:
        render(*item)
