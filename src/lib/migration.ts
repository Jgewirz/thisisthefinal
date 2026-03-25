import { useStyleStore } from '../stores/style';

const MIGRATION_KEY = 'girlbot-wardrobe-migrated';

/**
 * One-time migration: finds any base64 wardrobe items in localStorage,
 * uploads them to Cloudinary via the server, and replaces with CDN URLs.
 * Runs once per device (tracked by localStorage key).
 */
export async function migrateBase64Wardrobe(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const store = useStyleStore.getState();
  const base64Items = store.profile.wardrobeItems.filter((item) =>
    item.imageUrl.startsWith('data:')
  );

  if (base64Items.length === 0) {
    localStorage.setItem(MIGRATION_KEY, 'true');
    return;
  }

  console.log(`[migration] Migrating ${base64Items.length} base64 wardrobe items to Cloudinary...`);

  for (const item of base64Items) {
    try {
      const res = await fetch('/api/style/wardrobe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          image: item.imageUrl,
          category: item.category,
          color: item.color,
          colorHex: item.colorHex,
          style: item.style,
          seasons: item.seasons,
          occasions: item.occasions,
          pairsWith: item.pairsWith,
        }),
      });

      if (!res.ok) {
        console.warn(`[migration] Failed to migrate item ${item.id}, skipping`);
        continue;
      }

      const { item: newItem } = await res.json();

      // Remove old base64 item, add new CDN item
      useStyleStore.setState((state) => ({
        profile: {
          ...state.profile,
          wardrobeItems: [
            ...state.profile.wardrobeItems.filter((i) => i.id !== item.id),
            newItem,
          ],
        },
      }));
    } catch (err) {
      console.warn(`[migration] Error migrating item ${item.id}:`, err);
    }
  }

  localStorage.setItem(MIGRATION_KEY, 'true');
  console.log('[migration] Base64 wardrobe migration complete');
}
