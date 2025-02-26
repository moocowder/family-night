const express = require("express")
const app = express()

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET")
  next()
})

app.get("/manifest.json", (req, res) => {
  const manifest = {
    id: "com.mhdev.family-night",
    version: "1.0.0",
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

  // Fetch parental guide information
  const parentalGuide = await fetchParentalGuide(id)

  // Format the information
  const formattedGuide = formatParentalGuideInfo(parentalGuide)

  const streams = [
    {
      name: "Parental Guide",
      description: formatParentalGuideInfo(),
      infoHash: id, // Not an actual infoHash, just an identifier
      behaviorHints: {
        notWebReady: true, // Signals this isn't an actual video stream
        bingeGroup: "parentalguide",
      },
      title: "View Parental Guide Information",
      externalUrl: `https://www.imdb.com/title/${id}/parentalguide`,
      subtitles: [], // Required field but can be empty
      // The actual content goes here, can be HTML formatted
      addon_message: formattedGuide,
    },
  ]

  res.json({ streams })
})

function fetchParentalGuide(id) {
  return {
    title: "title of guide",
  }
}

function formatParentalGuideInfo() {
  // Format the guide data as HTML or rich text
  return `
    <h3>Parental Guide for</h3>\n\n
    ️‍🔥<div style="padding: 10px; background: #f5f5f5; border-radius: 5px;">
      <p><strong>Age Rating:</strong> age rating</p>\n
     ️‍🔥<h4>Content Warnings:</h4>
      <ul>
             <li><strong> warning 1 </strong></li>
             <li><strong> warning 2 </strong></li>
             <li><strong> warning 3 </strong></li>
      </ul>
    </div>
  `
}

app.listen(3000, () => console.log("Add-on running on http://localhost:3000"))
