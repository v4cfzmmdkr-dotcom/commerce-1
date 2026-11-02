import type { ReactNode } from "react"
import { siAfterpay, siAmericanexpress, siApplepay, siGooglepay, siVisa } from "simple-icons"

// Keep in step with the payment methods turned on in the Stripe Dashboard.
const methods: Array<{ name: string, background: string, mark: ReactNode }> = [
  { name: "Visa", background: "#ffffff", mark: <BrandMark path={siVisa.path} fill="#1a1f71" viewBox="0 8.1 24 7.8" /> },
  { name: "Mastercard", background: "#ffffff", mark: <MastercardMark /> },
  { name: "American Express", background: "#ffffff", mark: <BrandMark path={siAmericanexpress.path} fill="#2e77bc" /> },
  { name: "Apple Pay", background: "#ffffff", mark: <BrandMark path={siApplepay.path} fill="#000000" viewBox="0 4.3 24 15.4" /> },
  { name: "Google Pay", background: "#ffffff", mark: <BrandMark path={siGooglepay.path} fill="#4285f4" viewBox="0 7.2 24 9.6" /> },
  { name: "Link", background: "#00d66f", mark: <span className="payment-word">link</span> },
  { name: "Afterpay", background: "#b2fce4", mark: <BrandMark path={siAfterpay.path} fill="#000000" /> },
  { name: "Zip", background: "#aa8fff", mark: <span className="payment-word">zip</span> },
]

// Simple Icons draw on a 24 unit square; wide wordmarks pass a viewBox cropped to their height.
function BrandMark({ path, fill, viewBox = "0 0 24 24" }: { path: string, fill: string, viewBox?: string }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true">
      <path d={path} fill={fill} />
    </svg>
  )
}

function MastercardMark() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true">
      <circle cx="8.5" cy="8" r="6" fill="#eb001b" />
      <circle cx="15.5" cy="8" r="6" fill="#f79e1b" />
      <path d="M12 3.2a6 6 0 0 1 0 9.6 6 6 0 0 1 0-9.6z" fill="#ff5f00" />
    </svg>
  )
}

export function PaymentIcons() {
  return (
    <ul className="payment-methods" aria-label="Payment methods">
      {methods.map((method) => (
        <li key={method.name} className="payment-badge" style={{ background: method.background }} title={method.name}>
          <span className="sr-only">{method.name}</span>
          <span aria-hidden="true" className="contents">{method.mark}</span>
        </li>
      ))}
    </ul>
  )
}
