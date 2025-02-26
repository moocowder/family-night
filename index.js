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
    name: "My Simple Add-on",
    description: "A test add-on for learning",
    resources: ["meta"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
  }
  res.json(manifest)
})

app.get("/meta/:type/:id.json", (req, res) => {
  const { type, id } = req.params // e.g., "movie" and "tt0111161"
  const meta = {
    id: id,
    type: type,
    name: "Test Title",
    description: "This is a test description!",
    parentalGuide: "xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  }
  res.json({ meta }) // Wrap in "meta" key
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
      description: "Contains detailed content warnings and age recommendations",
      infoHash: id, // Not an actual infoHash, just an identifier
      behaviorHints: {
        notWebReady: true, // Signals this isn't an actual video stream
        bingeGroup: "parentalguide",
      },
      title: "View Parental Guide Information",
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
// Helper function to format the parental guide nicely
function formatParentalGuideInfo(guideData) {
  // Format the guide data as HTML or rich text
  return `
    <h3>Parental Guide for ${guideData.title}</h3>
    <div style="padding: 10px; background: #f5f5f5; border-radius: 5px;">
      <p><strong>Age Rating:</strong> age rating</p>
      <h4>Content Warnings:</h4>
      <ul>
             <li><strong> warning 1 </strong></li>
             <li><strong> warning 2 </strong></li>
             <li><strong> warning 3 </strong></li>
      </ul>
    </div>
  `
}

app.listen(3000, () => console.log("Add-on running on http://localhost:3000"))
