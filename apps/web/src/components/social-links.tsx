import { social } from "@/lib/social"

export function SocialLinks() {
  return (
    <div className="hero-social">
      <a className="no-underline" href={social.instagram.href} target="_blank" rel="noreferrer" aria-label={`${social.instagram.label} ${social.instagram.detail}`}>
        <InstagramIcon />
      </a>
      <a className="no-underline" href={social.facebook.href} target="_blank" rel="noreferrer" aria-label={social.facebook.label}>
        <FacebookIcon />
      </a>
      <a className="hero-social-ebay no-underline" href={social.ebay.href} target="_blank" rel="noreferrer" aria-label="eBay store">
        eBay
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
      <a className="contact-channel no-underline" href={social.facebook.href} target="_blank" rel="noreferrer">
        <FacebookIcon />
        <span>
          <span className="block font-medium">{social.facebook.label}</span>
          <span className="block text-sm opacity-70">{social.facebook.detail}</span>
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

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm8 8.2 8-5.2V7l-8 5.2L4 7v1l8 5.2z" />
    </svg>
  )
}
