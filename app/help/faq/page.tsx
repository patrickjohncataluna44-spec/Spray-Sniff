import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { ADMIN_EMAIL, SITE_NAME } from '@/lib/site'

const faqs = [
  {
    question: 'How do I choose the right fragrance for me?',
    answer:
      'Take our Discovery Quiz for perfume recommendations based on mood, scent family, season, and intensity, or browse the collections page for a more curated starting point.',
  },
  {
    question: 'What is the difference between Eau de Parfum and Eau de Toilette?',
    answer:
      'Eau de Parfum usually carries a richer concentration and longer wear, while Eau de Toilette feels lighter and often fades sooner. Both can be beautiful; the right choice depends on how softly or boldly you want the perfume to project.',
  },
  {
    question: 'How long does shipping take?',
    answer:
      'Standard delivery typically takes 5-7 business days. Once your order is confirmed, you can track progress through your account and orders pages.',
  },
  {
    question: 'What is your return policy?',
    answer:
      'If your order arrives with an issue, contact us quickly so we can help review the order and guide you through the next step.',
  },
  {
    question: 'Are your fragrances cruelty-free?',
    answer: `Yes, the ${SITE_NAME} assortment is selected with a cruelty-free, quality-first standard in mind.`,
  },
  {
    question: 'How should I store my perfume?',
    answer:
      'Keep perfume in a cool, dry place away from direct sunlight and heat. Good storage helps preserve the note structure and extends the bottle’s overall character.',
  },
]

export default function FAQPage() {
  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Customer Care"
        title="Frequently Asked Questions"
        description="Answers to common perfume shopping, delivery, and fragrance-care questions in one place."
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-5">
            {faqs.map((faq) => (
              <article key={faq.question} className="storefront-panel rounded-[1.75rem] p-6 sm:p-7">
                <h2 className="text-2xl text-foreground">{faq.question}</h2>
                <p className="mt-3 text-sm leading-7 text-foreground/66 sm:text-base">{faq.answer}</p>
              </article>
            ))}
          </div>

          <article className="storefront-panel mt-8 rounded-[2rem] p-8 text-center">
            <p className="storefront-eyebrow">Need More Help?</p>
            <h2 className="mt-3 text-4xl text-foreground">Contact The Perfume Desk</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-foreground/66 sm:text-base">
              If you still have questions about scents, orders, or availability, we are happy to guide you.
            </p>
            <a
              href={`mailto:${ADMIN_EMAIL}`}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(255,154,134,0.28)] transition hover:bg-[#ff8a73]"
            >
              Email {SITE_NAME}
            </a>
          </article>
        </div>
      </section>
    </StorefrontShell>
  )
}
