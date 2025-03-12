const express = require("express")
const rateLimit = require('express-rate-limit')
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const app = express()
const cheerio = require("cheerio")

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const RATING_MAP = {
  None: 0,
  Mild: 1,
  Moderate: 2,
  Severe: 3,
}

const RATING_REVERSE_MAP = {
  0: "None",
  1: "Mild",
  2: "Moderate",
  3: "Severe",
}

function toRatingNumber(rating) {
  return RATING_MAP[rating] ?? 0 // Default to "None" if unknown
}

function toRatingString(ratingNumber) {
  return RATING_REVERSE_MAP[ratingNumber] ?? "None" // Default to "None" if unknown
}

/** @type {Object.<string, string>} */
const SEVERITY_INDICATORS = {
  None: "⚪️",
  Mild: "🟢",
  Moderate: "🟡",
  Severe: "🔴"
}

const CONFIG = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || "0.0.0.0",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

app.use(limiter)

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  )
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }
  next()
})

app.get("/manifest.json", (req, res) => {
  console.log("******")
  try {
    const manifest = {
      id: "com.moocowder.family-night",
      version: "2.0.0",
      name: "Family Night",
      description: "A test add-on for learning",
      resources: ["stream"],
      types: ["movie", "series"],
      idPrefixes: ["tt"],
    }
    res.json(manifest)
  } catch (error) {
    console.error("Error serving manifest:", error)
    res.status(500).json({ error: "Failed to serve manifest" })
  }
})

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const { type, id } = req.params
    
    // Validate IMDB ID format
    if (!id.startsWith('tt') || id.length < 3) {
      return res.status(400).json({ error: "Invalid IMDB ID format" })
    }

    // Check Supabase first
    const { data: cachedData, error: cacheError } = await supabase
      .from('guides')
      .select('*')
      .eq('imdb_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cachedData && !cacheError) {
      console.log(`Returning cached data for ${id}`)
      const description = formatParentalGuideInfo({
        mpaaRating: cachedData.mpaa_rating,
        categories: {
          'Sex & Nudity': toRatingString(cachedData.sex_and_nudity),
          'Violence & Gore': toRatingString(cachedData.violence_gore),
          'Profanity': toRatingString(cachedData.profanity),
          'Alcohol, Drugs & Smoking': toRatingString(cachedData.alcohol_drugs_smoking),
          'Frightening & Intense Scenes': toRatingString(cachedData.frightening_intense_scenes),
        },
      })
      console.log('returning')
      return res.json({ streams: [{
        name: "Family Night",
        title: description,
        externalUrl: `https://www.imdb.com/title/${id}/parentalguide`,
      }]})
    }

    console.log('not really returning')
    // If not in Supabase, fetch from IMDb
    console.log("fetchin from imdb")
    const html = await fetchIMDbParentalGuide(id)
    if (!html) {
      return res.status(404).json({ error: "Failed to fetch parental guide" })
    }

    const result = await parseParentalGuide(html)
    const description = formatParentalGuideInfo(result)

    // Insert into Supabase
    console.log('inserting into supabase...')
    await supabase
      .from('guides')
      .insert([{
        imdb_id: id,
        mpaa_rating: result.mpaaRating,
        sex_and_nudity: toRatingNumber(result.categories['Sex & Nudity']),
        violence_gore: toRatingNumber(result.categories['Violence & Gore']),
        profanity: toRatingNumber(result.categories['Profanity']),
        alcohol_drugs_smoking: toRatingNumber(result.categories['Alcohol, Drugs & Smoking']),
        frightening_intense_scenes: toRatingNumber(result.categories['Frightening & Intense Scenes']),
      }])

    res.json({ streams: [{
      name: "Family Night",
      title: description,
      externalUrl: `https://www.imdb.com/title/${id}/parentalguide`,
    }]})
  } catch (error) {
    console.error("Error processing stream request:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/test", async (req, res) => {
  const html = await fetchIMDbParentalGuide("tt0111161")
  const result = await parseParentalGuide(html)
  const description = await formatParentalGuideInfo(result)
  res.send(description)
})

async function fetchIMDbParentalGuide(imdbId) {
  try {
    const url = `https://www.imdb.com/title/${imdbId}/parentalguide`
    console.log(`Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        "User-Agent": CONFIG.userAgent,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.text()
  } catch (error) {
    console.error("Error fetching IMDb parental guide:", error)
    return null
  }
}

/**
 * @typedef {Object} ParentalGuideResult
 * @property {string} mpaaRating
 * @property {Object.<string, string>} categories
 */

/**
 * @param {string} html
 * @returns {Promise<ParentalGuideResult>}
 */
async function parseParentalGuide(html) {
  const $ = cheerio.load(html)
  const result = {
    mpaaRating: "",
    categories: {},
  }

  try {
    result.mpaaRating = $(".ipc-metadata-list__item")
      .first()
      .find(".ipc-html-content-inner-div")
      .text()
      .trim() || "Not Rated"

    $('[data-testid="rating-item"]').each((_, element) => {
      const category = $(element)
        .find(".ipc-metadata-list-item__label")
        .text()
        .trim()
        .replace(":", "")
      
      const rating = $(element)
        .find(".ipc-html-content-inner-div")
        .text()
        .trim()

      if (category && rating) {
        result.categories[category] = rating
      }
    })

    return result
  } catch (error) {
    console.error("Error parsing parental guide:", error)
    throw error
  }
}

function formatParentalGuideInfo(result) {
  const description = []

  if (result.mpaaRating) {
    description.push(`${result.mpaaRating}`)
  }

  Object.entries(result.categories).forEach(([category, rating]) => {
    const indicator = SEVERITY_INDICATORS[rating] || "❓"
    description.push(`${indicator} ${category}: ${rating}`)
  })

  return description.join("\n")
}

app.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`Addon running on port ${CONFIG.port}`)
})
