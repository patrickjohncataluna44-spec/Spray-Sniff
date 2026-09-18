import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { PRODUCT_CATEGORIES } from '@/lib/admin-products'

export interface ProductCategoryItem {
  id: string
  name: string
  slug: string
  description?: string | null
  isSystem: boolean
  createdAt?: string
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// GET /api/categories - accessible to public (clients), staff, and admins
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('product_categories')
      .select('id, name, slug, description, is_system, created_at')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      // Table might not be migrated yet in some local environments; fallback safely to default categories
      console.warn('Unable to query product_categories from Supabase, falling back to defaults', error.message)
      const fallbackList: ProductCategoryItem[] = PRODUCT_CATEGORIES.map((name) => ({
        id: `cat_${slugify(name)}`,
        name,
        slug: slugify(name),
        isSystem: true,
      }))
      return NextResponse.json({ categories: fallbackList })
    }

    const categories: ProductCategoryItem[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at,
    }))

    return NextResponse.json({ categories })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load product categories.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/categories - staff and admin can create new categories
export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'STAFF')) {
      return NextResponse.json(
        { error: 'Only staff and administrators can create product categories.' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const rawName = typeof body?.name === 'string' ? body.name.trim() : ''
    const rawDescription = typeof body?.description === 'string' ? body.description.trim() : null

    if (!rawName) {
      return NextResponse.json({ error: 'Category name is required.' }, { status: 400 })
    }

    const slug = slugify(rawName)
    const id = `cat_${slug || Date.now().toString()}`

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('product_categories')
      .upsert(
        {
          id,
          name: rawName,
          slug,
          description: rawDescription,
          is_system: false,
        },
        { onConflict: 'name' },
      )
      .select('id, name, slug, description, is_system, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const category: ProductCategoryItem = {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      isSystem: Boolean(data.is_system),
      createdAt: data.created_at,
    }

    return NextResponse.json({
      ok: true,
      message: `Category "${category.name}" added successfully.`,
      category,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save category.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
