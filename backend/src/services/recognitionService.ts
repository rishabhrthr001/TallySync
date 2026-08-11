import { extractProductDetails } from './geminiService.js';
import Item from '../models/Item.js';

interface ProductMatch {
  _id: string;
  name: string;
  sku: string;
  rate: number;
  gst: number;
  category: string;
  stock: number;
  confidence: number;
  isStrongMatch: boolean;
}

/**
 * Normalizes strings by removing special characters, punctuation, and multiple spaces.
 */
function cleanString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes a matching confidence score (0 to 100) between an inventory Item and Gemini's detected details.
 */
function computeMatchScore(item: any, geminiDetails: any): number {
  const itemNameClean = cleanString(item.name);
  const itemSkuClean = cleanString(item.sku);
  const itemCategoryClean = cleanString(item.category);

  const geminiNameClean = cleanString(geminiDetails.productName);
  const geminiBrandClean = cleanString(geminiDetails.brand);
  const geminiSkuClean = cleanString(geminiDetails.sku);
  const geminiCategoryClean = cleanString(geminiDetails.category);
  const geminiFeaturesClean = cleanString(geminiDetails.distinctiveFeatures);

  const combinedGemini = `${geminiNameClean} ${geminiBrandClean} ${geminiCategoryClean} ${geminiFeaturesClean}`;

  // 1. Exact SKU match -> 100%
  if (itemSkuClean && geminiSkuClean && itemSkuClean === geminiSkuClean) {
    return 100;
  }

  // 2. Direct Name Match -> 98%
  if (itemNameClean && geminiNameClean && itemNameClean === geminiNameClean) {
    return 98;
  }

  // 3. Substring containment
  if (itemNameClean && geminiNameClean && (geminiNameClean.includes(itemNameClean) || itemNameClean.includes(geminiNameClean))) {
    return 92;
  }

  let score = 0;

  // 4. Token Overlap Score
  const itemTokens = itemNameClean.split(' ').filter(t => t.length > 1);
  if (itemTokens.length > 0) {
    let matchedTokens = 0;
    for (const token of itemTokens) {
      if (combinedGemini.includes(token)) {
        matchedTokens++;
      }
    }
    const tokenRatio = matchedTokens / itemTokens.length;
    score += tokenRatio * 65; // Up to 65 points
  }

  // 5. Brand Match Boost (+15 points)
  if (geminiBrandClean && (itemNameClean.includes(geminiBrandClean) || combinedGemini.includes(geminiBrandClean))) {
    score += 15;
  }

  // 6. Category Match Boost (+10 points)
  if (itemCategoryClean && geminiCategoryClean && (itemCategoryClean.includes(geminiCategoryClean) || geminiCategoryClean.includes(itemCategoryClean))) {
    score += 10;
  }

  // 7. SKU partial match (+10 points)
  if (itemSkuClean && combinedGemini.includes(itemSkuClean)) {
    score += 10;
  }

  return Math.min(Math.max(Math.round(score), 0), 95);
}

/**
 * Runs image-based product matching:
 * 1. Calls Gemini Vision to identify product from image.
 * 2. Scans company's inventory DB items.
 * 3. Returns top candidates with confidence match scores.
 */
export async function searchProductsByImage(
  base64Image: string,
  companyName: string,
  userId?: string
): Promise<{
  matches: ProductMatch[];
  threshold: number;
  detectedProduct: {
    productName: string;
    brand: string;
    category: string;
    sku: string;
    distinctiveFeatures: string;
  };
  totalInventoryCount: number;
}> {
  const threshold = Number(process.env.PRODUCT_RECOGNITION_THRESHOLD) || 0.70;

  // 1. Submit image to Gemini Vision
  const geminiDetails = await extractProductDetails(base64Image);
  console.log(`[AI Scanner] Detected for ${companyName}:`, geminiDetails);

  // 2. Query all inventory items for this company or user
  const queryConditions: any[] = [];
  if (companyName) {
    queryConditions.push({ companyName: { $regex: new RegExp(`^${companyName.trim()}$`, 'i') } });
  }
  if (userId) {
    queryConditions.push({ userId });
  }

  const items = await Item.find(queryConditions.length > 0 ? { $or: queryConditions } : {});
  const totalInventoryCount = items.length;

  // 3. Compute matching confidence for each item
  const matches: ProductMatch[] = [];
  for (const item of items) {
    const confidence = computeMatchScore(item, geminiDetails);
    
    // Only return matching inventory items with a match score of more than 50%
    if (confidence > 50) {
      matches.push({
        _id: item._id.toString(),
        name: item.name,
        sku: item.sku || '',
        rate: item.rate || 0,
        gst: item.gst || 18,
        category: item.category || 'General',
        stock: item.stock || 0,
        confidence,
        isStrongMatch: confidence >= Math.round(threshold * 100)
      });
    }
  }

  // 4. Sort descending by confidence and return top 5
  matches.sort((a, b) => b.confidence - a.confidence);
  const topMatches = matches.slice(0, 5);

  return {
    matches: topMatches,
    threshold,
    detectedProduct: {
      productName: geminiDetails.productName || 'Unidentified Product',
      brand: geminiDetails.brand || '',
      category: geminiDetails.category || 'General',
      sku: geminiDetails.sku || '',
      distinctiveFeatures: geminiDetails.distinctiveFeatures || ''
    },
    totalInventoryCount
  };
}

