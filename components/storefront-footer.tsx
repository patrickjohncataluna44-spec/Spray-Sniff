import Link from 'next/link'
import { Facebook, Instagram, Mail, MapPin, Phone, Clock } from 'lucide-react'
import { STOREFRONT_CONTACT_DETAILS, STOREFRONT_FOOTER_GROUPS } from '@/lib/storefront-content'
import { SITE_NAME } from '@/lib/site'

export function StorefrontFooter() {
  return (
    <footer className="bg-[#1e1416] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand Info */}
          <div className="lg:col-span-4 space-y-4">
            <Link href="/" className="inline-block">
              <span className="font-serif text-3xl font-bold tracking-tight text-white">
                {SITE_NAME}
              </span>
            </Link>
            <p className="text-sm text-white/65 leading-relaxed max-w-sm">
              An independent fragrance atelier and perfume house in Manila. Formulated for longevity, intimate sillage, and personal resonance.
            </p>
            <div className="pt-2 flex gap-3 text-white/70">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 transition hover:bg-white/10 hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 transition hover:bg-white/10 hover:text-white"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {STOREFRONT_FOOTER_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-xs font-semibold text-white/40">
                  {group.title}
                </p>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-xs text-white/70 transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact Atelier Details */}
          <div className="lg:col-span-3 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold text-white/40">
              Mabini Atelier
            </p>

            <div className="space-y-3 text-xs text-white/75 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{STOREFRONT_CONTACT_DETAILS.location}</span>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{STOREFRONT_CONTACT_DETAILS.hours}</span>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a
                  href={`mailto:${STOREFRONT_CONTACT_DETAILS.email}`}
                  className="hover:text-white underline underline-offset-2"
                >
                  {STOREFRONT_CONTACT_DETAILS.email}
                </a>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/contact"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Atelier Concierge Inquiries →
              </Link>
            </div>
          </div>
        </div>

        {/* Legal & Copyright */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/40">
          <p>© 2026 {SITE_NAME}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/help/faq" className="hover:text-white transition">FAQ</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
            <Link href="/orders" className="hover:text-white transition">Order Tracking</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
