/**
 * Nano Banana Tools - Definitions
 * Tool schemas for nano-banana server (image generation)
 */

import type { Tool } from '../../../types';
import { handleGenerateImage } from './handler';

export const nanoBananaTools: Record<string, Tool> = {
  'generate_image': {
    server: 'nano-banana',
    tool: 'generate_image',
    handler: handleGenerateImage,
    description: `Generate or edit images using AI.

## When to Use

Use this tool when the user wants to:
- Generate a new image from a description
- Edit or modify an existing image
- Create variations of an image
- Apply style changes to an image

## Parameters

- **prompt** (required): Detailed description of the desired image. Be specific about subject, composition, lighting, mood, and style.
- **model** (optional): Image generation model. Options:
  - "flux-kontext-max" (default): Fireworks FLUX Kontext Max — excellent at image editing, style transfer, and text rendering on images
  - "nano-banana-1": Gemini 2.5 Flash — fast, good quality general generation
  - "nano-banana-2": Gemini 3.1 Flash — newer generation, improved quality
  - "nano-banana-pro": Gemini 3 Pro — highest quality Gemini model, best for complex scenes
- **reference_images** (optional): Array of library paths for images to use as reference or for editing (e.g., "home/Photos/cat.jpg"). When the user attaches files, their paths appear as \`[Attached files: ...]\` — use those exact paths here.
- **reference_image_ids** (optional): Array of asset UUIDs for reference images. Use when you have asset IDs from tool results or library metadata.
- **style** (optional): Style guidance like "photorealistic", "cartoon", "oil painting", "watercolor", "anime", etc.
- **aspect_ratio** (optional): Output aspect ratio - "1:1" (square), "16:9" (landscape), "9:16" (portrait), "4:3", or "3:4".
- **save_to** (optional): Library folder path to save the image (e.g., "home/Projects/MyProject"). If not specified, saves to "home/Generated_Images".

## Path Format

Same as library:browse - paths are relative to library root:
- "home/Photos/sunset.jpg" or "Photos/sunset.jpg"
- The @library/ prefix from user mentions is optional and stripped automatically

## IMPORTANT: Showing Generated Images to the User

After generating an image, you MUST use \`@library/path\` mentions to display it. Without this mention, the user CANNOT see the generated image.

Use the path from the tool result: \`@library/home/Generated_Images/generated_123.png\`

Example response: "Here's your generated image: @library/home/Generated_Images/generated_1234567890.png"

## Returns

Generated image saved to library with:
- **items**: Map of library path to LibraryItem details
- **libraryItemIds**: Asset IDs for the model to see the generated image

After generation, reference the image in your response using @library/ format for UI preview.

## Examples

Generate new image:
\`\`\`json
{
  "prompt": "A majestic orange cat sitting on a throne in a medieval castle, dramatic lighting",
  "style": "photorealistic",
  "aspect_ratio": "1:1"
}
\`\`\`

Edit existing image (by path):
\`\`\`json
{
  "prompt": "Change the background to a sunset beach scene",
  "reference_images": ["home/Photos/portrait.jpg"]
}
\`\`\`

Edit with asset IDs:
\`\`\`json
{
  "prompt": "Transform this photo into a Studio Ghibli anime style",
  "reference_image_ids": ["70acbb9e-1234-5678-abcd-ef1234567890"],
  "style": "anime"
}
\`\`\``,
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed description of the image to generate or the edit to apply',
        },
        model: {
          type: 'string',
          enum: ['flux-kontext-max', 'nano-banana-1', 'nano-banana-2', 'nano-banana-pro'],
          description: 'Image model. "flux-kontext-max" (default, best for editing & text), "nano-banana-1" (Gemini Flash), "nano-banana-2" (Gemini Flash Next), "nano-banana-pro" (Gemini Pro)',
        },
        reference_images: {
          type: 'array',
          items: { type: 'string' },
          description: 'Library paths of reference images (e.g., "home/Photos/photo.jpg"). Use exact paths from [Attached files: ...] annotations or library:browse results.',
        },
        reference_image_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Asset UUIDs of reference images. Use IDs from tool results or libraryItemIds.',
        },
        style: {
          type: 'string',
          description: 'Style guidance (e.g., "photorealistic", "anime", "oil painting", "watercolor")',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Output aspect ratio',
        },
        save_to: {
          type: 'string',
          description: 'Library folder path to save the image (e.g., "home/Projects/MyProject"). Defaults to "home/Generated_Images".',
        },
      },
    },
    source: 'builtIn',
  },
};
