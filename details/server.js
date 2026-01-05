import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

const BASE_DIR = path.resolve(__dirname, '../product_details')

// Serve static files
app.use('/product_details', express.static(BASE_DIR))

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`)
  next()
})

// Multer configuration: Using query params for folderName
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderName = req.query.folderName
    if (!folderName) {
      console.error('Upload Error: folderName missing in query params')
      return cb(new Error('folderName is required in query params'), null)
    }
    const dir = path.join(BASE_DIR, folderName, 'images')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_')
    cb(null, `${Date.now()}_${name}${ext}`)
  }
})

const upload = multer({ storage })

app.get('/api/ping', (req, res) => res.send('pong'))

app.post('/api/save', (req, res) => {
  const { folderName, html, css } = req.body
  if (!folderName) return res.status(400).send('Folder name is required')

  const projectDir = path.join(BASE_DIR, folderName)
  try {
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'index.html'), html)
    fs.writeFileSync(path.join(projectDir, 'style.css'), css)
    console.log(`Successfully saved project: ${folderName}`)
    res.send('Saved successfully')
  } catch (err) {
    console.error('Save Failure:', err)
    res.status(500).send('Failed to save')
  }
})

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded')
  const folderName = req.query.folderName
  const relativePath = `http://localhost:3002/product_details/${folderName}/images/${req.file.filename}`
  console.log(`File uploaded: ${req.file.filename} -> ${folderName}`)
  res.json({ url: relativePath })
})

const PORT = 3002
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`File server running at http://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} is already in use.`)
  } else {
    console.error('Server error:', err)
  }
})
