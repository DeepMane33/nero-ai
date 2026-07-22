/**
 * Free APIs for Nero AI — no API keys needed
 *
 * - Open-Meteo: Weather (unlimited, free)
 * - Wikipedia: Knowledge (free)
 * - DuckDuckGo: General search (free, sometimes rate-limited)
 * - ESPN: Sports scores (free)
 */

/* ------------------------------------------------------------------ */
/*  Open-Meteo Weather API (completely free, no key)                   */
/* ------------------------------------------------------------------ */

interface WeatherData {
  location: string
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  description: string
  icon: string
}

export async function getWeather(location: string): Promise<WeatherData | null> {
  try {
    // First, geocode the location
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en`
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) })
    const geoData = await geoRes.json()

    if (!geoData.results?.[0]) return null

    const { latitude, longitude, name, country } = geoData.results[0]

    // Get weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(8000) })
    const weatherData = await weatherRes.json()

    if (!weatherData.current) return null

    const current = weatherData.current
    const wmoCode = current.weather_code || 0

    const descriptions: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
    }

    return {
      location: `${name}, ${country}`,
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      description: descriptions[wmoCode] || 'Unknown',
      icon: wmoCode <= 1 ? '☀️' : wmoCode <= 3 ? '⛅' : wmoCode <= 48 ? '🌫️' : wmoCode <= 65 ? '🌧️' : wmoCode <= 75 ? '❄️' : wmoCode <= 82 ? '🌦️' : '⛈️',
    }
  } catch (err) {
    console.error('[free-apis] Weather failed:', err)
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Wikipedia full article fetch (for richer answers)                  */
/* ------------------------------------------------------------------ */

export async function getWikipediaSummary(topic: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(topic)
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.extract || ''
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/*  Currency conversion (free, no key)                                 */
/* ------------------------------------------------------------------ */

const VALID_CURRENCY_CODES = /^[A-Z]{3}$/

export async function convertCurrency(from: string, to: string, amount: number = 1): Promise<string> {
  try {
    const fromCode = from.toUpperCase()
    const toCode = to.toUpperCase()
    if (!VALID_CURRENCY_CODES.test(fromCode) || !VALID_CURRENCY_CODES.test(toCode)) {
      return ''
    }
    const url = `https://api.exchangerate-api.com/v4/latest/${fromCode}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const rate = data.rates?.[to.toUpperCase()]
    if (!rate) return ''
    const result = (amount * rate).toFixed(2)
    return `${amount} ${from.toUpperCase()} = ${result} ${to.toUpperCase()} (rate: ${rate})`
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/*  Detect what free API to use                                        */
/* ------------------------------------------------------------------ */

export function detectFreeAPI(query: string): {
  isWeather: boolean
  isCurrency: boolean
  weatherLocation: string
  currencyFrom: string
  currencyTo: string
} {
  const lower = query.toLowerCase()

  const isWeather = /\b(weather|temperature|temp|forecast|rain|snow|storm|humidity|wind|hot|cold|warm|climate)\b/i.test(lower)

  let weatherLocation = ''
  if (isWeather) {
    // Extract location: "weather in Tokyo" -> "Tokyo"
    const match = query.match(/(?:weather|temperature|temp|forecast)\s+(?:in|for|at|of)\s+(.+?)(?:\s+today|\s+now|\s+right now|\s*\?|\s*$)/i)
    if (match) {
      weatherLocation = match[1].trim()
    } else {
      // Try "Tokyo weather"
      const match2 = query.match(/(.+?)\s+(?:weather|temperature|temp|forecast)/i)
      if (match2) weatherLocation = match2[1].trim()
    }
  }

  const isCurrency = /\b(exchange rate|convert|currency|usd|eur|gbp|inr|jpy|cny)\b/i.test(lower)
  let currencyFrom = 'USD'
  let currencyTo = 'INR'
  if (isCurrency) {
    const fromMatch = query.match(/\b(usd|eur|gbp|inr|jpy|cny|dollar|euro|pound|rupee|yen|yuan)\b/i)
    const toMatch = query.match(/(?:to|in|into)\s+(usd|eur|gbp|inr|jpy|cny|dollar|euro|pound|rupee|yen|yuan)\b/i)
    if (fromMatch) currencyFrom = fromMatch[1].toUpperCase().replace('DOLLAR', 'USD').replace('EURO', 'EUR').replace('POUND', 'GBP').replace('RUPEE', 'INR').replace('YEN', 'JPY').replace('YUAN', 'CNY')
    if (toMatch) currencyTo = toMatch[1].toUpperCase().replace('DOLLAR', 'USD').replace('EURO', 'EUR').replace('POUND', 'GBP').replace('RUPEE', 'INR').replace('YEN', 'JPY').replace('YUAN', 'CNY')
  }

  return { isWeather, isCurrency, weatherLocation, currencyFrom, currencyTo }
}
