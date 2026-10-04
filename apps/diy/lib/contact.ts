function rawNumber(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ""
}

export function getPhoneDisplay(): string {
  const number = rawNumber()
  if (number.length === 12 && number.startsWith("254")) {
    return `+254 ${number.slice(3, 6)} ${number.slice(6, 9)} ${number.slice(9)}`
  }
  return number ? `+${number}` : ""
}

export function getPhoneTel(): string {
  const number = rawNumber()
  return number ? `tel:+${number}` : ""
}
