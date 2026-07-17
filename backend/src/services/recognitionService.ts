import { extractProductDetails } from './geminiService.js';
import Item from '../models/Item.js';

interface ProductMatch {
  _id: string;
  name: string;
  sku: string;
  rate: number;
  gst: number;
  category: string;
  confidence: number;
}

/**
 * Computes a matching confidence score (0 to 100) between a database Item and Gemini's predictions.
 */
function computeMatchScore(item: any, geminiDetails: any): number {
  const itemNameLower = (item.name || '').toLowerCase();
  const itemSkuLower = (item.sku || '').toLowerCase();
  const itemCategoryLower = (item.category || '').toLowerCase();

  const geminiNameLower = (geminiDetails.productName || '').toLowerCase();
  const geminiBrandLower = (geminiDetails.brand || '').toLowerCase();
  const geminiSkuLower = (geminiDetails.sku || '').toLowerCase();
  const geminiCategoryLower = (geminiDetails.category || '').toLowerCase();
  const geminiFeaturesLower = (geminiDetails.distinctiveFeatures || '').toLowerCase();

  // 1. Direct SKU match is a 100% score
  if (itemSkuLower && geminiSkuLower && itemSkuLower === geminiSkuLower) {
    return 100;
  }

  // 2. Direct name match is a 98% score
  if (itemNameLower === geminiNameLower) {
    return 98;
  }

  let score = 0;

  // 3. Token-based word overlap matching
  const itemTokens = itemNameLower.split(/\s+/).filter((t: string) => t.length > 1);
  if (itemTokens.length > 0) {
    let tokenMatches = 0;
    for (const token of itemTokens) {
      if (
        geminiNameLower.includes(token) || 
        geminiBrandLower.includes(token) || 
        geminiFeaturesLower.includes(token)
      ) {
        tokenMatches++;
      }
    }
    // Up to 70 points for word overlaps
    const overlapRatio = tokenMatches / itemTokens.length;
    score += overlapRatio * 70;
  }

  // 4. Brand match boost (+15 points)
  if (geminiBrandLower && itemNameLower.includes(geminiBrandLower)) {
    score += 15;
  }

  // 5. Category match boost (+10 points)
  if (itemCategoryLower && geminiCategoryLower && (itemCategoryLower.includes(geminiCategoryLower) || geminiCategoryLower.includes(itemCategoryLower))) {
    score += 10;
  }

  // 6. Partial SKU match boost (+15 points)
  if (itemSkuLower && geminiNameLower.includes(itemSkuLower)) {
    score += 15;
  }

  // Round and cap score (maximum 95 for non-exact matches)
  return Math.round(Math.min(Math.max(score, 0), 95));
}

/**
 * Runs image-based product matching:
 * 1. Calls Gemini Vision to identify product and extract details.
 * 2. Scans company's inventory DB items in-memory.
 * 3. Returns top 5 sorted candidates with confidence percentage.
 */
export async function searchProductsByImage(
  base64Image: string,
  companyName: string
): Promise<{ matches: ProductMatch[]; threshold: number }> {
  const threshold = Number(process.env.PRODUCT_RECOGNITION_THRESHOLD) || 0.70;

  // 1. Submit image to Gemini Vision to get structured details
  const geminiDetails = await extractProductDetails(base64Image);
  console.log(`Gemini Extracted Details for ${companyName}:`, geminiDetails);

  // 2. Fetch all inventory products for this company
  const items = await Item.find({ companyName });
  if (items.length === 0) {
    return { matches: [], threshold };
  }

  // 3. Compute matching confidence for each item
  const matches: ProductMatch[] = [];
  for (const item of items) {
    const confidence = computeMatchScore(item, geminiDetails);
    
    // Only return matching results above a minimal confidence floor (15%)
    if (confidence > 15) {
      matches.push({
        _id: item._id.toString(),
        name: item.name,
        sku: item.sku || '',
        rate: item.rate || 0,
        gst: item.gst || 18,
        category: item.category || 'General',
        confidence
      });
    }
  }

  // 4. Sort descending by confidence and return top 5
  matches.sort((a, b) => b.confidence - a.confidence);
  const topMatches = matches.slice(0, 5);

  return {
    matches: topMatches,
    threshold
  };
}
