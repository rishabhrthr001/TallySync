import { matchProductWithInventoryCatalog, extractProductDetails } from './geminiService.js';
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
  matchReason?: string;
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
 * Computes a fallback matching confidence score (0 to 100) between an inventory Item and detected details.
 */
function computeFallbackScore(item: any, geminiDetails: any): number {
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

  // 3. Substring containment -> 92%
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
    score += tokenRatio * 65;
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
 * Runs inventory-first AI product matching:
 * 1. Queries company's inventory DB items.
 * 2. Feeds image + full inventory catalog to Gemini Vision for visual-to-catalog matching.
 * 3. Only returns items with match score > 50%.
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
  const threshold = Number(process.env.PRODUCT_RECOGNITION_THRESHOLD) || 0.50;

  // 1. Query all inventory items for this company or user
  const queryConditions: any[] = [];
  if (companyName) {
    queryConditions.push({ companyName: { $regex: new RegExp(`^${companyName.trim()}$`, 'i') } });
  }
  if (userId) {
    queryConditions.push({ userId });
  }

  const items = await Item.find(queryConditions.length > 0 ? { $or: queryConditions } : {});
  const totalInventoryCount = items.length;

  // Create an in-memory lookup map for quick item access
  const itemMap = new Map<string, any>();
  for (const item of items) {
    itemMap.set(item._id.toString(), item);
  }

  // 2. Submit image AND the company's inventory items to Gemini Vision for direct catalog matching
  const matchingResult = await matchProductWithInventoryCatalog(
    base64Image,
    items.map(item => ({
      _id: item._id.toString(),
      name: item.name,
      category: item.category,
      sku: item.sku,
      rate: item.rate
    }))
  );

  const detectedProduct = {
    productName: matchingResult.detectedProduct?.productName || 'Unidentified Product',
    brand: matchingResult.detectedProduct?.brand || '',
    category: matchingResult.detectedProduct?.category || 'General',
    sku: '',
    distinctiveFeatures: matchingResult.detectedProduct?.distinctiveFeatures || ''
  };

  console.log(`[AI Inventory Matcher] Detected for ${companyName}:`, detectedProduct);
  console.log(`[AI Inventory Matcher] Direct Catalog Matches:`, matchingResult.matches);

  // 3. Process matches from Gemini direct catalog matching
  const matchesMap = new Map<string, ProductMatch>();

  for (const match of matchingResult.matches || []) {
    const item = itemMap.get(match.id);
    if (item) {
      const confidence = Math.round(Number(match.confidence) || 0);
      if (confidence > 50) {
        matchesMap.set(match.id, {
          _id: item._id.toString(),
          name: item.name,
          sku: item.sku || '',
          rate: item.rate || 0,
          gst: item.gst || 18,
          category: item.category || 'General',
          stock: item.stock || 0,
          confidence,
          isStrongMatch: confidence >= Math.round(threshold * 100),
          matchReason: match.reason
        });
      }
    }
  }

  // 4. Combine with fallback scoring for any items missed by catalog prompt
  for (const item of items) {
    const id = item._id.toString();
    if (!matchesMap.has(id)) {
      const fallbackScore = computeFallbackScore(item, detectedProduct);
      if (fallbackScore > 50) {
        matchesMap.set(id, {
          _id: id,
          name: item.name,
          sku: item.sku || '',
          rate: item.rate || 0,
          gst: item.gst || 18,
          category: item.category || 'General',
          stock: item.stock || 0,
          confidence: fallbackScore,
          isStrongMatch: fallbackScore >= Math.round(threshold * 100)
        });
      }
    }
  }

  // 5. Convert to array and sort descending by confidence score
  const matches = Array.from(matchesMap.values());
  matches.sort((a, b) => b.confidence - a.confidence);

  return {
    matches: matches.slice(0, 5),
    threshold,
    detectedProduct,
    totalInventoryCount
  };
}


