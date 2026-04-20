import Link from 'next/link'
import { Facebook, Instagram, Mail, MapPin, TimerReset } from 'lucide-react'
import { STOREFRONT_CONTACT_DETAILS, STOREFRONT_FOOTER_GROUPS } from '@/lib/storefront-content'
import { SITE_NAME } from '@/lib/site'

export function StorefrontFooter() {
  return (
    <footer
      id="contact"
      className="border-t border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,240,190,0.38))]"
    >
      <div className="w-full px-3 py-3 sm:px-4 lg:px-6">
        <section className="w-full rounded-[1rem] bg-[#26181a] px-4 py-3 text-white shadow-[0_10px_28px_rgba(60,25,25,0.14)]">
          <div className="grid gap-4 lg:grid-cols-[220px_1fr_270px] lg:items-start">
            <div className="space-y-0.5">
              <p className="font-serif text-[1.9rem] leading-none">{SITE_NAME}</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                Perfume House
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {STOREFRONT_FOOTER_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                    {group.title}
                  </h3>

                  <ul className="mt-2 space-y-1.5">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-[12px] text-white/72 transition hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-2.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Contact
              </h3>

              <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-white/74">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{STOREFRONT_CONTACT_DETAILS.location}</span>
                </p>

                <p className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <a
                    href={`mailto:${STOREFRONT_CONTACT_DETAILS.email}`}
                    className="transition hover:text-white"
                  >
                    {STOREFRONT_CONTACT_DETAILS.email}
                  </a>
                </p>

                <p className="flex items-start gap-2">
                  <TimerReset className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{STOREFRONT_CONTACT_DETAILS.hours}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <a
                href="#"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10"
                aria-label="Instagram"
              >
                <Instagram className="h-3 w-3" />
              </a>

              <a
                href="#"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10"
                aria-label="Facebook"
              >
                <Facebook className="h-3 w-3" />
              </a>
            </div>

            <p className="text-[11px] text-white/45">
              © 2026 {SITE_NAME}. All rights reserved.
            </p>
          </div>
        </section>
      </div>
    </footer>
  )
}