const express = require("express")
const rateLimit = require('express-rate-limit')
const app = express()
const cheerio = require("cheerio")

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

    const html = await fetchIMDbParentalGuide(id)
    if (!html) {
      return res.status(404).json({ error: "Failed to fetch parental guide" })
    }

    const result = await parseParentalGuide(html)
    const description = await formatParentalGuideInfo(result)
    
    const streams = [{
      name: "Family Night",
      title: description,
      externalUrl: `https://www.imdb.com/title/${id}/parentalguide`,
    }]

    res.json({ streams })
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
