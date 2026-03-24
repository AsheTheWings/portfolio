/**
 * Generate Image API Route
 * POST /api/agent/generate-image
 * Calls Gemini or Fireworks FLUX image model and returns generated image as library asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { AssetService } from '@/features/library/services/asset.service';
import { FolderService } from '@/features/library/services/folder.service';
import type { LibraryItem, Folder, Asset } from '@/features/library/types';

// ============================================================
// Types
// ============================================================

interface GenerateImageRequest {
  prompt: string;
  model?: 'flux-kontext-max' | 'nano-banana-1' | 'nano-banana-2' | 'nano-banana-pro';
  reference_images?: string[];       // Library paths (e.g., "home/Photos/cat.jpg")
  reference_image_ids?: string[];    // Asset UUIDs
  style?: string;
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  save_to?: string;  // Folder path to save the image (e.g., "home/Projects/MyProject")
}

interface GenerateImageResult {
  status: 'success' | 'error';
  message?: string;
  items?: Record<string, LibraryItem>;
  libraryItemIds?: string[];
}

// ============================================================
// Configuration
// ============================================================

const IMAGE_MODEL_KEY_NAME = 'NANO_BANANA';
const GENERATED_IMAGES_FOLDER = 'Generated_Images';

const GEMINI_IMAGE_MODELS: Record<string, string> = {
  'nano-banana-1':   'gemini-2.5-flash-image',
  'nano-banana-2':   'gemini-3.1-flash-image-preview',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
};
const DEFAULT_GEMINI_MODEL = 'nano-banana-1';

const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1/workflows';
const FLUX_KONTEXT_MAX_MODEL = 'accounts/fireworks/models/flux-kontext-max';

function loadImageModelKey(): string {
  const key = process.env[IMAGE_MODEL_KEY_NAME];
  if (!key) {
    throw new Error(`${IMAGE_MODEL_KEY_NAME} API key not found for image generation`);
  }
  return key;
}

function loadFireworksKey(): string {
  // Reuse the same key pool as the chat provider
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`FIREWORKS_API_KEY_${i}`];
    if (key) return key;
  }
  const key = process.env.FIREWORKS_API_KEY;
  if (key) return key;
  throw new Error('No Fireworks API key found for image generation');
}

// ============================================================
// Library Helpers
// ============================================================

/**
 * Find folder by path (supports both /path and /home/path formats)
 */
async function findFolderByPath(userId: string, folderPath: string): Promise<Folder | null> {
  if (!folderPath) return null;
  
  const allFolders = await FolderService.getAllFolders(userId);
  
  const searchPath = `/${folderPath}`.replace(/^\/+/, '/');
  const homeSearchPath = `/home${searchPath}`;
  
  return allFolders.find(f => 
    f.path === searchPath || 
    f.path === homeSearchPath ||
    f.path === `/${folderPath}`
  ) || null;
}

/**
 * Find asset by path (folder path + file name)
 */
async function findAssetByPath(userId: string, path: string): Promise<Asset | null> {
  // Split path into folder and file name
  const segments = path.split('/');
  const fileName = segments.pop();
  const folderPath = segments.join('/');
  
  if (!fileName) return null;
  
  const folder = await findFolderByPath(userId, folderPath);
  const { assets } = await AssetService.listAssets(userId, { 
    folderId: folder?.id || undefined 
  });
  
  return assets.find(a => a.fileName === fileName) || null;
}

/**
 * Convert asset to LibraryItem
 */
function assetToItem(asset: Asset, parentPath: string = ''): LibraryItem {
  return {
    id: asset.id,
    name: asset.fileName,
    type: 'asset',
    path: parentPath ? `${parentPath}/${asset.fileName}` : asset.fileName,
    mimeType: asset.mimeType || undefined,
    fileType: asset.fileType,
    sizeKb: asset.sizeKb || undefined,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    tags: asset.tags?.map(t => t.tag) || [],
    thumbnailUrl: asset.thumbnailUrl || undefined,
    storageUrl: asset.url || undefined,
  };
}

/**
 * Get or create the Generated Images folder inside home
 */
async function getGeneratedImagesFolder(userId: string): Promise<Folder> {
  const homeFolder = await FolderService.getHomeFolder(userId);
  return FolderService.getOrCreateSystemFolder(
    userId,
    GENERATED_IMAGES_FOLDER,
    homeFolder.id,
    homeFolder.path
  );
}

/**
 * Get destination folder - either the specified save_to path or default Generated_Images
 */
async function getDestinationFolder(userId: string, saveTo?: string): Promise<Folder> {
  if (!saveTo) {
    return getGeneratedImagesFolder(userId);
  }
  
  // Try to find the specified folder
  const folder = await findFolderByPath(userId, saveTo);
  if (folder) {
    return folder;
  }
  
  // Folder doesn't exist - create it
  // Parse the path to create nested folders if needed
  const segments = saveTo.split('/').filter(Boolean);
  if (segments.length === 0) {
    return getGeneratedImagesFolder(userId);
  }
  
  // Use createFolderTree to create the folder structure
  const folderMap = await FolderService.createFolderTree(userId, null, [saveTo]);
  const createdFolderId = folderMap[saveTo];
  
  if (createdFolderId) {
    const createdFolder = await FolderService.getFolder(userId, createdFolderId);
    if (createdFolder) return createdFolder;
  }
  
  // Fallback to default folder
  console.warn(`Failed to create folder at ${saveTo}, using default`);
  return getGeneratedImagesFolder(userId);
}

// ============================================================
// Image Generation
// ============================================================

/**
 * Resolve reference images to inline data for Gemini.
 * Accepts library paths and/or asset UUIDs separately.
 * Returns resolved images and any references that failed to resolve.
 */
async function resolveReferenceImages(
  userId: string,
  paths: string[],
  ids: string[],
): Promise<{ resolved: Array<{ mimeType: string; data: string }>; notFound: string[] }> {
  const resolved: Array<{ mimeType: string; data: string }> = [];
  const notFound: string[] = [];

  // Helper: fetch asset data and push to resolved
  async function resolveAsset(asset: { url: string; mimeType: string | null } | null, ref: string) {
    if (!asset?.url) { notFound.push(ref); return; }
    const response = await fetch(asset.url);
    if (!response.ok) { notFound.push(ref); return; }
    const arrayBuffer = await response.arrayBuffer();
    resolved.push({
      mimeType: asset.mimeType || 'image/png',
      data: Buffer.from(arrayBuffer).toString('base64'),
    });
    console.log(`✅ Resolved reference image: ${ref}`);
  }

  // Resolve by path
  for (const path of paths) {
    try {
      const asset = await findAssetByPath(userId, path);
      await resolveAsset(asset, path);
    } catch (err) {
      console.warn(`Error resolving reference image path ${path}:`, err);
      notFound.push(path);
    }
  }

  // Resolve by ID (batch fetch)
  if (ids.length > 0) {
    try {
      const assets = await AssetService.getAssetsByIds(ids);
      const assetMap = new Map(assets.map(a => [a.id, a]));
      for (const id of ids) {
        await resolveAsset(assetMap.get(id) ?? null, id);
      }
    } catch (err) {
      console.warn(`Error resolving reference image IDs:`, err);
      ids.forEach(id => notFound.push(id));
    }
  }

  return { resolved, notFound };
}

/**
 * Build the prompt with style guidance
 * Note: Aspect ratio is handled via imageConfig, not in prompt
 */
function buildPrompt(
  basePrompt: string,
  style?: string
): string {
  if (!style) return basePrompt;
  return `${basePrompt}. Style: ${style}`;
}

/**
 * Call Gemini image model to generate image
 */
async function generateImageWithGemini(
  prompt: string,
  referenceImages: Array<{ mimeType: string; data: string }>,
  style?: string,
  aspectRatio?: string,
  geminiModel?: string
): Promise<{ mimeType: string; data: string }> {
  const apiKey = loadImageModelKey();
  const client = new GoogleGenAI({ apiKey });
  const modelId = geminiModel || GEMINI_IMAGE_MODELS[DEFAULT_GEMINI_MODEL];
  
  // Build content parts
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
  
  // Add reference images first (for editing/style reference)
  for (const img of referenceImages) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    });
  }
  
  // Add the prompt (style is included in prompt, aspect ratio via config)
  const fullPrompt = buildPrompt(prompt, style);
  parts.push({ text: fullPrompt });
  
  console.log(`🖼️ Generating image with prompt: ${fullPrompt.substring(0, 100)}...`);
  console.log(`📎 Reference images: ${referenceImages.length}`);
  if (aspectRatio) console.log(`📐 Aspect ratio: ${aspectRatio}`);
  
  // Build config with optional imageConfig for aspect ratio
  const config: { responseModalities: string[]; imageConfig?: { aspectRatio: string } } = {
    responseModalities: ['TEXT', 'IMAGE'],
  };
  
  if (aspectRatio) {
    config.imageConfig = {
      aspectRatio,
    };
  }
  
  // Call the model
  const response = await client.models.generateContent({
    model: modelId,
    contents: [{ role: 'user', parts }],
    config,
  });
  
  // Extract generated image from response
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error('No response from image model');
  }
  
  // Find inline image in response
  for (const part of candidate.content.parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType) {
      return {
        mimeType: part.inlineData.mimeType,
        data: part.inlineData.data,
      };
    }
  }
  
  throw new Error('No image generated in response');
}

/**
 * Call Fireworks FLUX Kontext Max to generate or edit an image.
 * Supports text-to-image (prompt only) and image-to-image (prompt + reference image).
 * Only the first reference image is used (FLUX Kontext takes a single input image).
 */
async function generateImageWithFluxKontext(
  prompt: string,
  referenceImages: Array<{ mimeType: string; data: string }>,
  style?: string,
  aspectRatio?: string
): Promise<{ mimeType: string; data: string }> {
  const apiKey = loadFireworksKey();
  const fullPrompt = buildPrompt(prompt, style);

  // Build request body
  const body: Record<string, unknown> = { prompt: fullPrompt };

  // FLUX Kontext accepts a single input image as data URI
  if (referenceImages.length > 0) {
    const ref = referenceImages[0];
    body.image = `data:${ref.mimeType};base64,${ref.data}`;
  }

  // Map aspect_ratio to width/height (FLUX Kontext uses pixel dimensions)
  if (aspectRatio) {
    const dims = ASPECT_RATIO_TO_DIMS[aspectRatio];
    if (dims) {
      body.width = dims.width;
      body.height = dims.height;
    }
  }

  console.log(`🖼️ [FLUX Kontext] Generating with prompt: ${fullPrompt.substring(0, 100)}...`);
  console.log(`📎 Reference images: ${referenceImages.length > 0 ? 'yes' : 'none'}`);

  const url = `${FIREWORKS_BASE_URL}/${FLUX_KONTEXT_MAX_MODEL}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Fireworks FLUX Kontext error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  // Response format: { output: ["data:image/png;base64,..."] }
  const output = result.output;
  if (!output || !Array.isArray(output) || output.length === 0) {
    throw new Error('No image in FLUX Kontext response');
  }

  const dataUri = output[0] as string;

  // Parse data URI: "data:image/png;base64,iVBOR..."
  const dataUriMatch = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    return { mimeType: dataUriMatch[1], data: dataUriMatch[2] };
  }

  // If it's a URL instead of data URI, fetch it
  if (dataUri.startsWith('http')) {
    const imgResponse = await fetch(dataUri);
    if (!imgResponse.ok) throw new Error('Failed to fetch generated image from URL');
    const arrayBuffer = await imgResponse.arrayBuffer();
    const contentType = imgResponse.headers.get('content-type') || 'image/png';
    return { mimeType: contentType, data: Buffer.from(arrayBuffer).toString('base64') };
  }

  throw new Error('Unexpected FLUX Kontext response format');
}

const ASPECT_RATIO_TO_DIMS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3':  { width: 1152, height: 896 },
  '3:4':  { width: 896, height: 1152 },
};

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request
    const body: GenerateImageRequest = await request.json();
    const { prompt, model, reference_images, reference_image_ids, style, aspect_ratio, save_to } = body;
    
    if (!prompt) {
      return NextResponse.json(
        { status: 'error', message: 'Prompt is required' },
        { status: 400 }
      );
    }
    
    // Resolve reference images (paths and/or IDs)
    const hasPaths = reference_images && reference_images.length > 0;
    const hasIds = reference_image_ids && reference_image_ids.length > 0;
    const { resolved: resolvedRefs, notFound } = hasPaths || hasIds
      ? await resolveReferenceImages(user.id, reference_images || [], reference_image_ids || [])
      : { resolved: [], notFound: [] };

    if (notFound.length > 0) {
      return NextResponse.json(
        { status: 'error', message: `Reference images not found: ${notFound.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Generate image — route to appropriate backend (flux-kontext-max is default)
    const useGemini = model && model in GEMINI_IMAGE_MODELS;
    const geminiModelId = useGemini
      ? GEMINI_IMAGE_MODELS[model]
      : undefined;
    const generatedImage = useGemini
      ? await generateImageWithGemini(prompt, resolvedRefs, style, aspect_ratio, geminiModelId)
      : await generateImageWithFluxKontext(prompt, resolvedRefs, style, aspect_ratio);
    
    // Get or create the destination folder (user-specified or default)
    const folder = await getDestinationFolder(user.id, save_to);
    
    // Upload to library
    const fileName = `generated_${Date.now()}.${generatedImage.mimeType.split('/')[1] || 'png'}`;
    const asset = await AssetService.createAssetFromBase64(
      user.id,
      folder.id,
      generatedImage.data,
      generatedImage.mimeType,
      fileName
    );
    
    console.log(`✅ Generated image saved: ${asset.id} to ${folder.path}`);
    
    // Build response in same format as library/browse read_asset
    const folderPath = folder.path.replace(/^\//, '');  // Strip leading slash
    const item = assetToItem(asset, folderPath);
    
    const result: GenerateImageResult = {
      status: 'success',
      items: {
        [asset.id]: item,
      },
      libraryItemIds: [asset.id],
    };
    
    return NextResponse.json(result);
    
  } catch (err: unknown) {
    console.error('❌ Image generation failed:', err);
    
    const errorStr = String(err);
    
    // Quota / rate limit errors
    if (/quota|rate.?limit|429/i.test(errorStr)) {
      return NextResponse.json(
        { status: 'error', message: 'Image generation quota exceeded. Please try again later.' },
        { status: 503 }
      );
    }
    
    // Auth / API key errors
    if (/api.?key|unauthorized|401|authentication|invalid.*key/i.test(errorStr)) {
      return NextResponse.json(
        { status: 'error', message: 'Image generation service is temporarily unavailable.' },
        { status: 503 }
      );
    }
    
    // Safety filter / content policy
    if (/safety|blocked|content.?policy|prohibited/i.test(errorStr)) {
      return NextResponse.json(
        { status: 'error', message: 'Image could not be generated due to content policy restrictions. Try rephrasing the prompt.' },
        { status: 400 }
      );
    }
    
    // Generic fallback — no raw error details exposed
    return NextResponse.json(
      { status: 'error', message: 'Image generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
