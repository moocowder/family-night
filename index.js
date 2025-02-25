const express = require("express")
const app = express()

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
  }
  res.json({ meta }) // Wrap in "meta" key
})

app.listen(3000, () => console.log("Add-on running on http://localhost:3000"))
