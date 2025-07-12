require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const FOLDER_NAME = process.env.CLOUDINARY_FOLDER_NAME || 'cards';
const OUTPUT_FILE = path.join(__dirname, '../cards.json'); // Output to root or adjust path

async function getAllImageURLs() {
  try {
    const result = await cloudinary.search
      .expression(`folder:${FOLDER_NAME} AND resource_type:image`)
      .sort_by('public_id', 'desc')
      .max_results(500) // Adjust if needed
      .execute();

    const cards = result.resources.map(img => ({
      id: img.public_id,         // Cloudinary ID like 'cards/card1'
      imageUrl: img.secure_url   // Full image URL
    }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cards, null, 2));
    console.log(`✅ Saved ${cards.length} card objects to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Error fetching Cloudinary images:', err);
  }
}

getAllImageURLs();
