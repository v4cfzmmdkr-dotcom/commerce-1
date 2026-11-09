import { social } from "@/lib/social"

export function SocialLinks({ placement = "hero" }: { placement?: "hero" | "footer" }) {
  return (
    <div className="hero-social">
      {placement === "footer" ? (
        <>
          <a className="no-underline" href={social.instagram.href} target="_blank" rel="noreferrer" aria-label={`${social.instagram.label} ${social.instagram.detail}`}>
            <InstagramIcon />
          </a>
          <a className="no-underline" href={social.facebook.href} target="_blank" rel="noreferrer" aria-label={social.facebook.label}>
            <FacebookIcon />
          </a>
        </>
      ) : null}
      <a
        className="hero-social-stat glass no-underline"
        href={social.ebay.href}
        target="_blank"
        rel="noreferrer"
        aria-label={`eBay store, ${social.ebay.sales.toLocaleString("en-AU")} sold, ${social.ebay.positive} positive feedback`}
      >
        <span className="hero-social-mark">eBay</span>
        <span className="hero-social-stat-copy">
          <span>{social.ebay.sales.toLocaleString("en-AU")} sold</span>
          <span>{social.ebay.positive} positive</span>
        </span>
      </a>
      <a
        className="hero-social-stat glass no-underline"
        href={social.google.href}
        target="_blank"
        rel="noreferrer"
        aria-label={social.google.reviews > 0 && social.google.rating != null
          ? `${social.google.detail}, rated ${social.google.rating} out of 5 from ${social.google.reviews.toLocaleString("en-AU")} reviews`
          : `${social.google.detail}, no reviews yet`}
      >
        <GoogleIcon />
        <span className="hero-social-stat-copy">
          <Stars value={social.google.reviews > 0 ? social.google.rating : null} />
          <span>
            {social.google.reviews > 0
              ? `${social.google.reviews.toLocaleString("en-AU")} ${social.google.reviews === 1 ? "review" : "reviews"}`
              : "No reviews"}
          </span>
        </span>
      </a>
    </div>
  )
}

export function ContactChannels() {
  return (
    <div className="contact-channels">
      <a className="contact-channel no-underline" href={social.instagram.href} target="_blank" rel="noreferrer">
        <InstagramIcon />
        <span>
          <span className="block font-medium">{social.instagram.label}</span>
          <span className="block text-sm opacity-70">{social.instagram.detail}</span>
        </span>
      </a>
      <a className="contact-channel no-underline" href={social.email.href}>
        <EmailIcon />
        <span>
          <span className="block font-medium">{social.email.label}</span>
          <span className="block text-sm opacity-70">{social.email.detail}</span>
        </span>
      </a>
    </div>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm8 1.7H8A3.3 3.3 0 0 0 4.7 8v8A3.3 3.3 0 0 0 8 19.3h8A3.3 3.3 0 0 0 19.3 16V8A3.3 3.3 0 0 0 16 4.7zM12 7.4A4.6 4.6 0 1 1 7.4 12 4.6 4.6 0 0 1 12 7.4zm0 1.7A2.9 2.9 0 1 0 14.9 12 2.9 2.9 0 0 0 12 9.1zm5.15-3.35a1.15 1.15 0 1 1-1.15 1.15 1.15 1.15 0 0 1 1.15-1.15z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.2 8.5H16.5V5.2h-2.3c-2.6 0-4.4 1.7-4.4 4.3V12H7.5v3.2h2.3V21h3.2v-5.8h2.5l.6-3.2h-3.1v-2.2c0-.9.5-1.3 1.2-1.3z" />
    </svg>
  )
}

const starPath = "m10 1.6 2.1 4.7 5.1.6-3.8 3.5 1 5-4.4-2.5L5.6 15.4l1-5L2.8 6.9l5.1-.6z"

function Stars({ value }: { value: number | null }) {
  return (
    <span className="hero-social-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = value == null ? 0 : Math.max(0, Math.min(1, value - index))
        return (
          <svg key={index} viewBox="0 0 20 20">
            <path className="hero-social-star-empty" d={starPath} />
            <path className="hero-social-star-fill" d={starPath} style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }} />
          </svg>
        )
      })}
    </span>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.35zM12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22zM6.41 13.91A6 6 0 0 1 6.1 12c0-.66.11-1.31.31-1.91v-2.6H3.07a10 10 0 0 0 0 9.02l3.34-2.6zM12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.6C7.2 7.73 9.4 5.97 12 5.97z" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm8 8.2 8-5.2V7l-8 5.2L4 7v1l8 5.2z" />
    </svg>
  )
}
