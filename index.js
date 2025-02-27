const express = require("express")
const app = express()
const cheerio = require("cheerio")

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET")
  next()
})

app.get("/manifest.json", (req, res) => {
  const manifest = {
    id: "com.mhdev.family-night",
    version: "1.3.0",
    name: "Family Night",
    description: "A test add-on for learning",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
  }
  res.json(manifest)
})

app.get("/stream/:type/:id.json", async (req, res) => {
  const { type, id } = req.params // e.g., "movie" and "tt0111161"

  const html = await fetchIMDbParentalGuide(id)
  const result = await parseParentalGuide(html)
  const description = await formatParentalGuideInfo(result)
  const streams = [
    {
      name: "Parental Guide",
      description: `this, is a test \n to see how thing are being formatted in stremio.
         1
         2
         3
         abcd\nefga,b,c,d,
         <h1>hello</h1>
         <strong>strong</strong>
        `,,
      infoHash: id, // Not an actual infoHash, just an identifier
      behaviorHints: {
        notWebReady: true, // Signals this isn't an actual video stream
        bingeGroup: "parentalguide",
      },
      title: "View Parental Guide Information",
      externalUrl: `https://www.imdb.com/title/${id}/parentalguide`,
      subtitles: [], // Required field but can be empty
      // The actual content goes here, can be HTML formatted
      // addon_message: formattedGuide,
    },
    {
      name: "formatting test",
      description: `this, is a test \n to see how thing are being formatted in stremio.
         1
         2
         3
         abcd\nefga,b,c,d,
         <h1>hello</h1>
         <strong>strong</strong>
        `,
      infoHash: '124325415', // Not an actual infoHash, just an identifier
      behaviorHints: {
        notWebReady: true, // Signals this isn't an actual video stream
        bingeGroup: "parentalguide",
      },
      title: "do not view Parental Guide Information",
      externalUrl: `https://www.imdb.com/title/${id}/parentalguide`,
      subtitles: [], // Required field but can be empty
      // The actual content goes here, can be HTML formatted
      // addon_message: formattedGuide,
    },
  ]

  res.json({ streams })
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

    console.log(url)
    // Add a user agent to avoid being blocked
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    // const t = await response.text()
    // console.log(t)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch data: ${response.status} ${response.statusText}`
      )
    }

    return await response.text()
  } catch (error) {
    console.error("Error fetching IMDb parental guide:", error)
    return null
  }
}

async function parseParentalGuide(html) {
  const $ = cheerio.load(html)
  // const $ = await fetchIMDbParentalGuide("tt0111161")
  let result = {
    mpaaRating: "",
    categories: {},
  }

  // Extract MPAA rating
  const mpaaRating = $(".ipc-metadata-list__item")
    .first()
    .find(".ipc-html-content-inner-div")
    .text()
    .trim()
  result.mpaaRating = mpaaRating

  console.log(result)
  // Extract category ratings
  $('[data-testid="rating-item"]').each((index, element) => {
    const category = $(element)
      .find(".ipc-metadata-list-item__label")
      .text()
      .trim()
    const rating = $(element).find(".ipc-html-content-inner-div").text().trim()

    console.log(rating)
    // Remove the colon at the end of category names
    const cleanCategory = category.replace(":", "")

    result.categories[cleanCategory] = rating
  })

  return result
}

function formatParentalGuideInfo(result) {
  let description = []
  const colors = { None: "⚪️", Mild: "🟢", Moderate: "🟡", Severe: "🔴" }

  if (result.mpaaRating) {
    description.push(`${result.mpaaRating}`)
  }

  let rating
  for (let category in result.categories) {
    rating = result.categories[category]
    description.push(`${colors[rating]} ${category}: ${rating}`)
  }

  return description.join("\n")
}

app.listen(3000, () => console.log("Add-on running on http://localhost:3000"))
