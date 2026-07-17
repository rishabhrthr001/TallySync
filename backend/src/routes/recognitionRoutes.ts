import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { searchProductsByImage } from '../services/recognitionService.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';

const router = express.Router();

// Search products by captured image / upload using Cloudinary & Gemini Vision
router.post('/search', authenticateToken, async (req: any, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided for recognition' });
    }

    // 1. Upload captured query image to Cloudinary (storing it online)
    const imageUrl = await uploadToCloudinary(image, 'photobill_queries');
    console.log('Query image uploaded to Cloudinary:', imageUrl);

    // 2. Process recognition using Gemini Vision and match in DB
    const { matches, threshold } = await searchProductsByImage(image, req.user.companyName);

    res.json({
      success: true,
      imageUrl,
      matches,
      threshold
    });
  } catch (error: any) {
    console.error('AI Recognition search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get suggestions parameters / config
router.get('/suggestions', authenticateToken, async (req: any, res) => {
  try {
    const threshold = Number(process.env.PRODUCT_RECOGNITION_THRESHOLD) || 0.70;
    res.json({
      success: true,
      threshold,
      model: 'Google Gemini 1.5 Flash',
      storageProvider: 'Cloudinary'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
