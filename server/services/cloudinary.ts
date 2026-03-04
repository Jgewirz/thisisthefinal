import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  thumbnailUrl: string;
}

export async function uploadWardrobeImage(
  base64DataUrl: string,
  userId: string,
  itemId: string
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(base64DataUrl, {
    folder: `girlbot/wardrobe/${userId}`,
    public_id: itemId,
    transformation: [
      { width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
    ],
  });

  const thumbnailUrl = cloudinary.url(result.public_id, {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto',
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    thumbnailUrl,
  };
}

export async function deleteWardrobeImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
