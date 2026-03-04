CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    body_type TEXT,
    skin_tone_depth TEXT,
    skin_tone_undertone TEXT,
    skin_tone_season TEXT,
    skin_tone_best_colors TEXT,
    skin_tone_best_metals TEXT,
    style_essences TEXT,
    budget_range TEXT,
    occasions TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    onboarding_step INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wardrobe_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    cloudinary_public_id TEXT,
    category TEXT NOT NULL,
    color TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    style TEXT NOT NULL,
    seasons TEXT NOT NULL,
    occasions TEXT NOT NULL,
    pairs_with TEXT NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_user ON wardrobe_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_category ON wardrobe_items(user_id, category);
