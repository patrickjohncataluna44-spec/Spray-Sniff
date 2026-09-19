import { NextResponse } from 'next/server'

interface NominatimAddress {
  road?: string
  house_number?: string
  neighbourhood?: string
  suburb?: string
  village?: string
  quarter?: string
  hamlet?: string
  town?: string
  city?: string
  municipality?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'reverse'
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const query = searchParams.get('q')

  const headers = {
    'User-Agent': 'PerfumeStoreCheckoutApp/1.0 (delivery@perfumestore.ph)',
    Accept: 'application/json',
  }

  try {
    if (action === 'reverse') {
      if (!lat || !lon) {
        return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
      }

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
        lat,
      )}&lon=${encodeURIComponent(lon)}&format=jsonv2&addressdetails=1`

      const res = await fetch(url, {
        headers,
        next: { revalidate: 60 },
      })

      if (!res.ok) {
        throw new Error(`Nominatim reverse error: ${res.statusText}`)
      }

      const data = await res.json()
      const addr: NominatimAddress = data.address || {}

      // Build sensible street and city representation for Philippine addresses
      const streetParts = [
        addr.house_number,
        addr.road,
        addr.neighbourhood || addr.suburb || addr.quarter || addr.village,
      ].filter(Boolean)

      const street = streetParts.length > 0 ? streetParts.join(', ') : data.name || ''

      const city =
        addr.town ||
        addr.city ||
        addr.municipality ||
        addr.county ||
        addr.state ||
        ''

      const province = addr.state || ''
      const postalCode = addr.postcode || ''

      return NextResponse.json({
        lat: Number(data.lat),
        lon: Number(data.lon),
        displayName: data.display_name,
        street,
        city: province && city && !city.includes(province) ? `${city}, ${province}` : city,
        province,
        postalCode,
        rawAddress: addr,
      })
    }

    if (action === 'search') {
      if (!query) {
        return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
      }

      // Append Philippines if not already present to bias search accurately
      const searchQuery = query.toLowerCase().includes('philippines')
        ? query
        : `${query}, Philippines`

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery,
      )}&format=jsonv2&addressdetails=1&limit=5&countrycodes=ph`

      const res = await fetch(url, {
        headers,
        next: { revalidate: 300 },
      })

      if (!res.ok) {
        throw new Error(`Nominatim search error: ${res.statusText}`)
      }

      const results = await res.json()
      return NextResponse.json({ results })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error) {
    console.error('Geocode API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to query OpenStreetMap' },
      { status: 500 },
    )
  }
}
