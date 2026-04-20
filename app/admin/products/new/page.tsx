'use client'

import { type ChangeEvent, type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-context'
import {
  PRODUCT_CATEGORIES,
  createProductFromForm,
  initialProductFormValues,
  type ProductFormValues,
} from '@/lib/admin-products'
import { formatPHP } from '@/lib/currency'
import { SITE_NAME } from '@/lib/site'
import { useStore } from '@/lib/store-context'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1400

type FormErrors = Partial<Record<keyof ProductFormValues, string>>

function resizeToFit(width: number, height: number) {
  const largestSide = Math.max(width, height)

  if (largestSide <= MAX_IMAGE_DIMENSION) {
    return { width, height }
  }

  const scale = MAX_IMAGE_DIMENSION / largestSide

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

function optimizeProductImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      try {
        const { width, height } = resizeToFit(image.width, image.height)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('Unable to prepare the image for upload.'))
          return
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.88))
      } catch {
        reject(new Error('Unable to optimize the selected image.'))
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('The selected file could not be read as an image.'))
    }

    image.src = objectUrl
  })
}

function validateForm(values: ProductFormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Enter a product name.'
  }

  if (!values.brand.trim()) {
    errors.brand = 'Enter a brand name.'
  }

  if (!values.description.trim()) {
    errors.description = 'Add a short product description.'
  }

  if (!values.uploadedImage.trim()) {
    errors.uploadedImage = 'Upload a product photo before saving.'
  }

  if (!Number.isFinite(Number(values.price)) || Number(values.price) <= 0) {
    errors.price = 'Enter a valid base price.'
  }

  if (!Number.isFinite(Number(values.sizeMl)) || Number(values.sizeMl) <= 0) {
    errors.sizeMl = 'Enter a valid bottle size.'
  }

  if (
    !Number.isFinite(Number(values.stockQuantity)) ||
    Number(values.stockQuantity) < 0
  ) {
    errors.stockQuantity = 'Enter a valid stock quantity.'
  }

  if (
    !Number.isFinite(Number(values.reorderPoint)) ||
    Number(values.reorderPoint) < 0
  ) {
    errors.reorderPoint = 'Enter a valid reorder point.'
  }

  if (!values.storageLocation.trim()) {
    errors.storageLocation = 'Enter a storage location.'
  }

  return errors
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

export default function NewProductPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { addCatalogProduct } = useStore()
  const [formValues, setFormValues] = useState<ProductFormValues>(
    initialProductFormValues,
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [isPreparingImage, setIsPreparingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const previewImage =
    formValues.uploadedImage.trim() || '/placeholder.jpg'
  const previewPrice = Number(formValues.price)
  const previewStock = Math.max(0, Math.round(Number(formValues.stockQuantity) || 0))
  const previewReorderPoint = Math.max(
    0,
    Math.round(Number(formValues.reorderPoint) || 0),
  )
  const availabilityTone =
    previewStock <= 0
      ? 'bg-red-100 text-red-700'
      : previewStock <= previewReorderPoint
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700'
  const availabilityLabel =
    previewStock <= 0
      ? 'Out of Stock'
      : previewStock <= previewReorderPoint
        ? 'Low Stock'
        : 'In Stock'

  const updateField = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }))

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors((current) => ({
        ...current,
        uploadedImage: 'Use a JPG, PNG, or WebP image.',
      }))
      toast({
        title: 'Unsupported image format',
        description: 'Upload a JPG, PNG, or WebP photo for the product.',
        variant: 'destructive',
      })
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setErrors((current) => ({
        ...current,
        uploadedImage: 'Image must be 5 MB or smaller.',
      }))
      toast({
        title: 'Image is too large',
        description: 'Choose a file that is 5 MB or smaller.',
        variant: 'destructive',
      })
      event.target.value = ''
      return
    }

    setIsPreparingImage(true)

    try {
      const optimizedImage = await optimizeProductImage(file)

      setFormValues((current) => ({
        ...current,
        uploadedImage: optimizedImage,
      }))
      setErrors((current) => ({
        ...current,
        uploadedImage: undefined,
      }))

      toast({
        title: 'Photo ready',
        description: 'The product image was optimized and attached to the form.',
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The product image could not be prepared.'

      setErrors((current) => ({
        ...current,
        uploadedImage: message,
      }))
      toast({
        title: 'Unable to upload image',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsPreparingImage(false)
      event.target.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedValues: ProductFormValues = {
      ...formValues,
      inStock: Number(formValues.stockQuantity) > 0,
    }
    const nextErrors = validateForm(normalizedValues)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast({
        title: 'Check the product details',
        description: 'Fill in the required fields before saving the product.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const product = createProductFromForm(normalizedValues)
      const result = await addCatalogProduct(product, {
        initialStock: Number(normalizedValues.stockQuantity),
        reorderPoint: Number(normalizedValues.reorderPoint),
        location: normalizedValues.storageLocation.trim(),
        actor: user?.name || 'Store admin',
      })

      toast({
        title: result.ok ? 'Product added' : 'Unable to add product',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })

      if (!result.ok) {
        return
      }

      router.push('/admin/products')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />

        <div className="flex-1">
          <div className="border-b border-border bg-card">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <div className="mb-4 flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/products" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Products
                  </Link>
                </Button>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Catalog Studio
                  </span>
                  <h1 className="mt-4 font-serif text-3xl text-foreground">
                    Add a New Product
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-foreground/60">
                    Admins can add new fragrances here. Upload a product photo,
                    define the scent profile, and the storefront, inventory,
                    and POS catalog will update together.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground/70">
                  <p className="font-medium text-foreground">
                    Signed in as {user?.role === 'STAFF' ? 'staff' : 'admin'}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-foreground/45">
                    {user?.name || `${SITE_NAME} Team`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_380px]">
              <form onSubmit={handleSubmit} className="space-y-8">
                <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="font-serif text-2xl text-foreground">
                      Product Profile
                    </h2>
                    <p className="mt-2 text-sm text-foreground/60">
                      Start with the core selling details customers see first.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="name">Product Name</Label>
                      <Input
                        id="name"
                        value={formValues.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        placeholder="Silk Bloom Reserve"
                      />
                      <FieldError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="brand">Brand</Label>
                      <Input
                        id="brand"
                        value={formValues.brand}
                        onChange={(event) => updateField('brand', event.target.value)}
                        placeholder={SITE_NAME}
                      />
                      <FieldError message={errors.brand} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        value={formValues.category}
                        onChange={(event) =>
                          updateField('category', event.target.value)
                        }
                        className="h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {PRODUCT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="gender">Target Wearer</Label>
                      <select
                        id="gender"
                        value={formValues.gender}
                        onChange={(event) =>
                          updateField(
                            'gender',
                            event.target.value as ProductFormValues['gender'],
                          )
                        }
                        className="h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="unisex">Unisex</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="price">Base Price (PHP)</Label>
                      <Input
                        id="price"
                        type="number"
                        min="1"
                        step="0.01"
                        value={formValues.price}
                        onChange={(event) => updateField('price', event.target.value)}
                        placeholder="245"
                      />
                      <FieldError message={errors.price} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="sizeMl">Bottle Size (mL)</Label>
                      <Input
                        id="sizeMl"
                        type="number"
                        min="1"
                        value={formValues.sizeMl}
                        onChange={(event) => updateField('sizeMl', event.target.value)}
                        placeholder="50"
                      />
                      <FieldError message={errors.sizeMl} />
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formValues.description}
                        onChange={(event) =>
                          updateField('description', event.target.value)
                        }
                        placeholder="Describe the fragrance character, mood, and who it is best for."
                        className="min-h-28"
                      />
                      <FieldError message={errors.description} />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="font-serif text-2xl text-foreground">
                      Product Photo
                    </h2>
                    <p className="mt-2 text-sm text-foreground/60">
                      Upload a clean bottle image for the product. Uploaded photos
                      are optimized for this demo and saved with the product in
                      browser storage.
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-5">
                      <div className="grid gap-3">
                        <Label htmlFor="product-photo">Upload Product Photo</Label>
                        <label
                          htmlFor="product-photo"
                          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-8 text-center transition-colors hover:border-primary/45 hover:bg-primary/8"
                        >
                          {isPreparingImage ? (
                            <>
                              <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
                              <p className="font-medium text-foreground">
                                Preparing image...
                              </p>
                              <p className="mt-2 text-sm text-foreground/60">
                                Optimizing the photo for faster loading.
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="mb-4 rounded-full bg-white p-3 text-primary shadow-sm">
                                <Upload className="h-6 w-6" />
                              </div>
                              <p className="font-medium text-foreground">
                                Click to upload a product image
                              </p>
                              <p className="mt-2 max-w-sm text-sm text-foreground/60">
                                Use JPG, PNG, or WebP up to 5 MB. We compress it
                                automatically so catalog pages stay fast.
                              </p>
                            </>
                          )}
                        </label>
                        <input
                          id="product-photo"
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES.join(',')}
                          onChange={handleImageUpload}
                          className="sr-only"
                        />
                        <FieldError message={errors.uploadedImage} />
                      </div>

                      {formValues.uploadedImage ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => updateField('uploadedImage', '')}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Uploaded Photo
                        </Button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-border bg-background/80 p-5">
                      <p className="text-sm font-medium text-foreground">
                        Best Photo Perspective
                      </p>
                      <div className="mt-4 space-y-3 text-sm text-foreground/70">
                        <p>Front-facing or front three-quarter bottle angle.</p>
                        <p>Eye-level camera with the full bottle and cap visible.</p>
                        <p>Clean cream, white, or soft neutral background.</p>
                        <p>Soft studio light with a gentle shadow, not harsh flash.</p>
                      </div>
                      <div className="mt-5 rounded-2xl bg-primary/8 p-4 text-xs leading-6 text-foreground/70">
                        This angle looks the most professional on collection cards,
                        product pages, and admin previews because the label stays easy
                        to read.
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="font-serif text-2xl text-foreground">
                      Fragrance Details
                    </h2>
                    <p className="mt-2 text-sm text-foreground/60">
                      Use commas to separate scent notes, occasions, and seasons.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="scentFamily">Scent Family</Label>
                      <Input
                        id="scentFamily"
                        value={formValues.scentFamily}
                        onChange={(event) =>
                          updateField('scentFamily', event.target.value)
                        }
                        placeholder="Floral, Powdery, Soft Musk"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="occasions">Occasions</Label>
                      <Input
                        id="occasions"
                        value={formValues.occasions}
                        onChange={(event) =>
                          updateField('occasions', event.target.value)
                        }
                        placeholder="Day, Work, Romantic"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="topNotes">Top Notes</Label>
                      <Input
                        id="topNotes"
                        value={formValues.topNotes}
                        onChange={(event) =>
                          updateField('topNotes', event.target.value)
                        }
                        placeholder="Pear, Bergamot, Pink Pepper"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="seasons">Seasons</Label>
                      <Input
                        id="seasons"
                        value={formValues.seasons}
                        onChange={(event) =>
                          updateField('seasons', event.target.value)
                        }
                        placeholder="Spring, Summer"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="middleNotes">Middle Notes</Label>
                      <Input
                        id="middleNotes"
                        value={formValues.middleNotes}
                        onChange={(event) =>
                          updateField('middleNotes', event.target.value)
                        }
                        placeholder="Rose, Jasmine, Peony"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="baseNotes">Base Notes</Label>
                      <Input
                        id="baseNotes"
                        value={formValues.baseNotes}
                        onChange={(event) =>
                          updateField('baseNotes', event.target.value)
                        }
                        placeholder="Musk, Amber, Sandalwood"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="font-serif text-2xl text-foreground">
                      Inventory and Merchandising
                    </h2>
                    <p className="mt-2 text-sm text-foreground/60">
                      The starting stock here becomes the live inventory record used by
                      the storefront and POS.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="stockQuantity">Starting Stock</Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        min="0"
                        value={formValues.stockQuantity}
                        onChange={(event) =>
                          updateField('stockQuantity', event.target.value)
                        }
                      />
                      <FieldError message={errors.stockQuantity} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="reorderPoint">Reorder Point</Label>
                      <Input
                        id="reorderPoint"
                        type="number"
                        min="0"
                        value={formValues.reorderPoint}
                        onChange={(event) =>
                          updateField('reorderPoint', event.target.value)
                        }
                      />
                      <FieldError message={errors.reorderPoint} />
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="storageLocation">Storage Location</Label>
                      <Input
                        id="storageLocation"
                        value={formValues.storageLocation}
                        onChange={(event) =>
                          updateField('storageLocation', event.target.value)
                        }
                        placeholder="A1-01"
                      />
                      <FieldError message={errors.storageLocation} />
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-4">
                      <input
                        type="checkbox"
                        checked={formValues.featured}
                        onChange={(event) =>
                          updateField('featured', event.target.checked)
                        }
                        className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          Feature on highlighted sections
                        </span>
                        <span className="mt-1 block text-sm text-foreground/60">
                          Show this fragrance in featured carousels and premium
                          collection placements.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-4">
                      <input
                        type="checkbox"
                        checked={formValues.isNewArrival}
                        onChange={(event) =>
                          updateField('isNewArrival', event.target.checked)
                        }
                        className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          Mark as new arrival
                        </span>
                        <span className="mt-1 block text-sm text-foreground/60">
                          Helps the storefront spotlight fresh additions to the
                          catalog.
                        </span>
                      </span>
                    </label>
                  </div>
                </section>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="outline" asChild>
                    <Link href="/admin/products">Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    className="gap-2"
                    disabled={isPreparingImage || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Product
                  </Button>
                </div>
              </form>

              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm xl:sticky xl:top-8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-primary">
                        Live Preview
                      </p>
                      <h2 className="mt-2 font-serif text-2xl text-foreground">
                        {formValues.name.trim() || 'New Fragrance'}
                      </h2>
                    </div>
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>

                  <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-background">
                    <div className="aspect-[4/5] bg-[radial-gradient(circle_at_top,rgba(255,224,236,0.75),rgba(255,248,250,0.92)_55%,rgba(255,255,255,1))] p-5">
                      <div className="flex h-full items-center justify-center overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-[0_18px_50px_rgba(176,109,136,0.12)]">
                        {previewImage === '/placeholder.jpg' ? (
                          <div className="flex flex-col items-center justify-center px-6 text-center text-foreground/55">
                            <ImagePlus className="mb-4 h-10 w-10 text-primary/70" />
                            <p className="font-medium text-foreground/75">
                              Upload a bottle photo
                            </p>
                            <p className="mt-2 text-sm">
                              A clean front or three-quarter shot works best.
                            </p>
                          </div>
                        ) : (
                          <img
                            src={previewImage}
                            alt={formValues.name || 'Product preview'}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              if (!event.currentTarget.src.endsWith('/placeholder.jpg')) {
                                event.currentTarget.src = '/placeholder.jpg'
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                          {formValues.category}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${availabilityTone}`}
                        >
                          {availabilityLabel}
                        </span>
                      </div>

                      <div>
                        <p className="text-sm text-foreground/55">
                          {formValues.brand.trim() || SITE_NAME}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground/75">
                          {formValues.description.trim() ||
                            'Your fragrance summary will appear here while you fill out the form.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-background p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                            Price
                          </p>
                          <p className="mt-2 font-serif text-2xl text-foreground">
                            {Number.isFinite(previewPrice) && previewPrice > 0
                              ? formatPHP(previewPrice)
                              : formatPHP(0)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-background p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                            Inventory
                          </p>
                          <p className="mt-2 font-serif text-2xl text-foreground">
                            {previewStock}
                          </p>
                          <p className="mt-1 text-xs text-foreground/55">
                            Reorder at {previewReorderPoint}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-border px-3 py-1 text-xs text-foreground/65">
                          {formValues.gender}
                        </span>
                        <span className="rounded-full border border-border px-3 py-1 text-xs text-foreground/65">
                          {formValues.sizeMl || '50'} ml
                        </span>
                        {formValues.featured ? (
                          <span className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs text-primary">
                            Featured
                          </span>
                        ) : null}
                        {formValues.isNewArrival ? (
                          <span className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs text-primary">
                            New Arrival
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">
                    Upload Tip
                  </p>
                  <h3 className="mt-3 font-serif text-2xl text-foreground">
                    Best for Perfume Listings
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-foreground/70">
                    Use a high-resolution bottle photo with the label facing forward,
                    soft side lighting, and a clean neutral backdrop. That perspective
                    looks the most elegant in your collection grid and product page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
