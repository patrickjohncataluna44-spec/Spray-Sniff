'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { STOREFRONT_CONTACT_DETAILS } from '@/lib/storefront-content'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('Fragrance Consultation')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setName('')
      setEmail('')
      setMessage('')
    }, 1000)
  }

  return (
    <StorefrontShell>
      <StorefrontPageHero
        title="Atelier Concierge"
        description="Speak with our fragrance specialists in Mabini for personal scent consultations, custom gifting, or order inquiries."
      />

      <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-12">
            {/* Left: Contact Info & Boutique Details */}
            <div className="lg:col-span-5 space-y-8">
              <div className="rounded-3xl border border-border/80 bg-white p-8 space-y-6">
                <div>
                  <h2 className="font-serif text-2xl text-foreground">
                    Visit The Mabini Boutique
                  </h2>
                  <p className="mt-1 text-sm text-foreground/65">
                    Our atelier doors are open for walk-ins and private olfactive discovery sessions.
                  </p>
                </div>

                <div className="space-y-4 text-sm text-foreground/80">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Physical Atelier</p>
                      <p className="text-foreground/70">{STOREFRONT_CONTACT_DETAILS.location}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Opening Hours</p>
                      <p className="text-foreground/70">{STOREFRONT_CONTACT_DETAILS.hours}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Direct Concierge Email</p>
                      <a
                        href={`mailto:${STOREFRONT_CONTACT_DETAILS.email}`}
                        className="text-primary hover:underline"
                      >
                        {STOREFRONT_CONTACT_DETAILS.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Phone &amp; WhatsApp</p>
                      <p className="text-foreground/70">{STOREFRONT_CONTACT_DETAILS.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-[#fffaf5] p-4 text-xs text-foreground/70">
                  <span className="font-semibold text-foreground block mb-0.5">Response Guarantee:</span>
                  {STOREFRONT_CONTACT_DETAILS.conciergePromise}
                </div>
              </div>

              {/* Consultation Card */}
              <div className="rounded-3xl border border-border/80 bg-[#fffdfa] p-8 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <Sparkles className="h-4 w-4" />
                  <span>Looking for a scent match?</span>
                </div>
                <h3 className="font-serif text-2xl text-foreground">
                  Take The Digital Consultation
                </h3>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  Our interactive quiz analyzes note pyramids, intensity preferences, and occasions to recommend your ideal fragrance.
                </p>
                <div className="pt-2">
                  <Button asChild className="rounded-xl bg-primary text-primary-foreground hover:bg-[#ff8a73]">
                    <Link href="/discovery">Take Discovery Quiz</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Concierge Inquiry Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-border/80 bg-white p-8 sm:p-12">
                <h2 className="font-serif text-3xl text-foreground">
                  Send A Concierge Message
                </h2>
                <p className="mt-2 text-sm text-foreground/65">
                  Fill in your details below and a fragrance specialist will get back to you shortly.
                </p>

                {submitted ? (
                  <div className="my-10 rounded-2xl border border-primary/30 bg-[#fff7f1] p-8 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Send className="h-5 w-5" />
                    </div>
                    <h3 className="font-serif text-2xl text-foreground">Message Received</h3>
                    <p className="text-sm text-foreground/70 max-w-md mx-auto">
                      Thank you for reaching out to Spray &amp; Sniff. Our Mabini concierge will review your inquiry and reply via email within 2 hours.
                    </p>
                    <div className="pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setSubmitted(false)}
                        className="rounded-xl border-border text-xs"
                      >
                        Send Another Note
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-foreground/70 block mb-1.5">
                          Your Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Sofia Andres"
                          className="h-11 w-full rounded-xl border border-border/70 bg-[#fffdfa] px-4 text-sm text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-foreground/70 block mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="sofia@example.com"
                          className="h-11 w-full rounded-xl border border-border/70 bg-[#fffdfa] px-4 text-sm text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1.5">
                        Inquiry Nature
                      </label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border/70 bg-[#fffdfa] px-4 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="Fragrance Consultation">Personal Fragrance Consultation</option>
                        <option value="Order Tracking & Support">Order Tracking &amp; Delivery Support</option>
                        <option value="Wedding & Corporate Gifting">Wedding, Corporate &amp; Event Gifting</option>
                        <option value="Atelier Private Appointment">Mabini Atelier Private Appointment</option>
                        <option value="Press & Collaborative Inquiries">Press &amp; Brand Inquiries</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1.5">
                        Your Message
                      </label>
                      <textarea
                        required
                        rows={6}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us what scent families you wear, the occasion you are preparing for, or your order question..."
                        className="w-full rounded-xl border border-border/70 bg-[#fffdfa] p-4 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        className="h-12 rounded-xl bg-foreground px-8 text-sm font-semibold text-background hover:bg-foreground/85 cursor-pointer"
                      >
                        Send Inquiry
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}

