import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// Handle OPTIONS preflight requests
app.options('*', (c) => c.text('', 204));

// Initialize Supabase client for auth and storage
const supabaseAdmin = createClient(
  Deno.env.get('SB_URL') ?? Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SB_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Create storage bucket on startup
const BUCKET_NAME = 'make-06e2d339-vocab-images';
(async () => {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
  if (!bucketExists) {
    await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 10485760, // 10MB
    });
    console.log('Created storage bucket:', BUCKET_NAME);
  }
})();

// Utility to get authenticated user
async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Health check endpoint
app.get("/server/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== AUTH ROUTES ====================

// Sign up
app.post("/server/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }
    
    // Create user profile
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      createdAt: new Date().toISOString(),
    });
    
    // Initialize empty collections list
    await kv.set(`collections:user:${data.user.id}`, []);
    await kv.set(`attempts:user:${data.user.id}`, []);
    
    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Sign in
app.post("/server/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    const supabase = createClient(
      Deno.env.get('SB_URL') ?? Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SB_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error:', error);
      return c.json({ error: error.message }, 400);
    }
    
    return c.json({ 
      success: true, 
      session: data.session,
      user: data.user 
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get session
app.get("/server/auth/session", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ user: null }, 401);
    }
    
    const profile = await kv.get(`user:${user.id}`);
    return c.json({ user: profile || user });
  } catch (error) {
    console.error('Session error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==================== COLLECTIONS ROUTES ====================

// Get all collections for user
app.get("/server/collections", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const collectionIds = await kv.get(`collections:user:${user.id}`) || [];
    const keys = collectionIds.map((id: string) =>
      id.startsWith('collection:') ? id : `collection:${id}`
    );
    const collections = await kv.mget(keys);
    
    return c.json({ collections: collections.filter(Boolean) });
  } catch (error) {
    console.error('Get collections error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Create collection
app.post("/server/collections", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { name, description } = await c.req.json();
    const collectionId = crypto.randomUUID();
    
    const collection = {
      id: collectionId,
      userId: user.id,
      name,
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`collection:${collectionId}`, collection);
    
    // Add to user's collections
    const userCollections = await kv.get(`collections:user:${user.id}`) || [];
    userCollections.push(collectionId);
    await kv.set(`collections:user:${user.id}`, userCollections);
    
    // Initialize empty arrays for this collection
    await kv.set(`vocabulary:collection:${collectionId}`, []);
    await kv.set(`images:collection:${collectionId}`, []);
    await kv.set(`quizzes:collection:${collectionId}`, []);
    
    return c.json({ collection });
  } catch (error) {
    console.error('Create collection error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get single collection
app.get("/server/collections/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const collectionId = c.req.param('id');
    const collection = await kv.get(`collection:${collectionId}`);
    
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    
    return c.json({ collection });
  } catch (error) {
    console.error('Get collection error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete collection
app.delete("/server/collections/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const collectionId = c.req.param('id');
    const collection = await kv.get(`collection:${collectionId}`);
    
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    
    // Delete collection and related data
    await kv.del(`collection:${collectionId}`);
    await kv.del(`vocabulary:collection:${collectionId}`);
    await kv.del(`images:collection:${collectionId}`);
    await kv.del(`quizzes:collection:${collectionId}`);
    
    // Remove from user's collections
    const userCollections = await kv.get(`collections:user:${user.id}`) || [];
    const filtered = userCollections.filter((id: string) =>
      id !== `collection:${collectionId}` && id !== collectionId
    );
    await kv.set(`collections:user:${user.id}`, filtered);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete collection error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==================== IMAGE ROUTES ====================

// Upload image
app.post("/server/images/upload", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const collectionId = formData.get('collectionId') as string;
    
    if (!file || !collectionId) {
      return c.json({ error: 'File and collectionId required' }, 400);
    }
    
    const collection = await kv.get(`collection:${collectionId}`);
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    
    const imageId = crypto.randomUUID();
    const fileName = `${user.id}/${collectionId}/${imageId}-${file.name}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return c.json({ error: error.message }, 500);
    }
    
    // Create signed URL (valid for 1 year)
    const { data: urlData } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 31536000);
    
    // Save image metadata
    const image = {
      id: imageId,
      collectionId,
      userId: user.id,
      fileName: file.name,
      storagePath: fileName,
      url: urlData?.signedUrl || '',
      uploadedAt: new Date().toISOString(),
    };
    
    await kv.set(`image:${imageId}`, image);
    
    // Add to collection's images
    const collectionImages = await kv.get(`images:collection:${collectionId}`) || [];
    collectionImages.push(`image:${imageId}`);
    await kv.set(`images:collection:${collectionId}`, collectionImages);
    
    return c.json({ image });
  } catch (error) {
    console.error('Upload image error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Mock OCR extraction (in production, integrate with Google Cloud Vision, AWS Textract, etc.)
app.post("/server/images/:id/extract", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const imageId = c.req.param('id');
    const image = await kv.get(`image:${imageId}`);
    
    if (!image || image.userId !== user.id) {
      return c.json({ error: 'Image not found' }, 404);
    }
    
    const hasVietnamese = (s: string) =>
      /[ăâđêôơưĂÂĐÊÔƠƯáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/i.test(
        s,
      );

    const stripPhonetics = (s: string) => s.replace(/\/[^/]+\/:?/g, "").trim();

    const normalize = (s: string) =>
      stripPhonetics(
        s
          .replace(/\u2014/g, "-")
          .replace(/[•–—]/g, "-")
          .replace(/\s+/g, " ")
          .replace(/^\s*[-:*•]+/, "")
          .trim(),
      );

    const isLikelyEnglishTerm = (s: string) => {
      const t = s.trim();
      if (!t) return false;
      if (hasVietnamese(t)) return false;
      if (t.length < 2 || t.length > 80) return false;
      if (!/[aeiou]/i.test(t)) return false;
      if (/[^A-Za-z\s'\-\/\+]/.test(t)) return false;
      return true;
    };

    const splitInlineByVietnamese = (l: string): [string, string] | null => {
      const idx = [...l].findIndex((ch) => hasVietnamese(ch));
      if (idx <= 0) return null;
      const left = l.slice(0, idx).trim().replace(/[,\-:]+$/, "").trim();
      const right = l.slice(idx).trim().replace(/^[:\-,\s]+/, "").trim();
      if (!left || !right) return null;
      if (!isLikelyEnglishTerm(left)) return null;
      return [left, right];
    };

    const fixVietnameseArtifacts = (vi: string): string => {
      let s = vi;
      const VN_VOWEL =
        "[aeiouyăâêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]";
      const CONS_CLUSTER = "(?:ngh|ng|nh|th|tr|ch|gh|gi|kh|ph|qu|b|c|d|đ|g|h|k|l|m|n|p|q|r|s|t|v|x)";
      s = s.replace(new RegExp(`\\b(${CONS_CLUSTER})\\s+(${VN_VOWEL})`, "gi"), (_m, a, b) => `${a}${b}`);
      s = s.replace(/([ạảãáàâăêôơưéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵa-zđ]+)mẹ/gi, "$1 mẹ");
      s = s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/\s+\/\s+/g, "/").trim();
      return s;
    };

    const removeTrailingEnglishTail = (vi: string): string => {
      const WHITELIST = new Set(["em", "anh", "trai", "gia", "me", "mẹ", "cha", "gái", "hàng", "cùng", "cha/mẹ", "anh/em"]);
      const parts = vi.split(/\s+/);
      if (parts.length === 0) return vi.trim();
      const last = parts[parts.length - 1];
      if (last.includes("/")) return vi.replace(/[,\-:\s]+$/g, "").trim();
      const isAsciiWord = /^[A-Za-z\-]+$/.test(last);
      const isEnglishTail = isAsciiWord && (last.includes("-") || last.length >= 7);
      if (isEnglishTail) {
        parts.pop();
        return parts.join(" ").replace(/[,\-:\s]+$/g, "").trim();
      }
      if (WHITELIST.has(last.toLowerCase())) return vi.replace(/[,\-:\s]+$/g, "").trim();
      return vi.replace(/[,\-:\s]+$/g, "").trim();
    };

    const parseVocabularyFromText = (text: string): Array<{ english: string; vietnamese: string; example?: string }> => {
      if (!text || !text.trim()) return [];
      const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const blocks: string[] = [];
      let cur: string | null = null;
      const isSectionHeading = (l: string) => /^\d+(?:\.\d+)*\.\s+/.test(l);
      for (const l0 of rawLines) {
        const l = l0.trim();
        if (/^\d+\.\s+/.test(l) || isSectionHeading(l)) {
          if (cur) {
            blocks.push(cur.trim());
            cur = null;
          }
          continue;
        }
        if (/^[—\-]+$/.test(l)) continue;
        if (/^•\s+/.test(l) || /^\-\s+/.test(l)) {
          if (cur) blocks.push(cur.trim());
          cur = l;
        } else {
          if (cur) cur += " " + l;
        }
      }
      if (cur) blocks.push(cur.trim());

      const items: Array<{ english: string; vietnamese: string; example?: string }> = [];
      for (const block0 of blocks) {
        let b = block0.replace(/^•\s+/, "").replace(/^\-\s+/, "");
        b = b.replace(/\s+/g, " ").trim();
        const bNoPho = b.replace(/\/[^/]*\//g, " ").replace(/\s+/g, " ").trim();

        let en = "";
        let vi = "";
        const mSlash = b.match(/^([A-Za-z][A-Za-z\- ]+?)\s*\/[^/]*\/\s*:\s*(.+)$/);
        if (mSlash) {
          en = mSlash[1].trim();
          vi = mSlash[2].trim();
        } else {
          const idx = b.indexOf(":");
          if (idx !== -1) {
            en = b.slice(0, idx).trim();
            vi = b.slice(idx + 1).trim();
          } else {
            const pair = splitInlineByVietnamese(bNoPho);
            if (pair) {
              en = pair[0];
              vi = pair[1];
            }
          }
        }

        en = en.trim();
        if (!isLikelyEnglishTerm(en)) continue;

        if (vi) {
          vi = fixVietnameseArtifacts(vi);
          vi = removeTrailingEnglishTail(vi);
        }

        if (en && vi) items.push({ english: en, vietnamese: vi, example: "" });
      }
      return items;
    };

    const ocrKey = Deno.env.get("OCR_SPACE_API_KEY") || "helloworld";
    let ocrText = "";

    try {
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(image.storagePath);
      if (dlErr) throw dlErr;
      if (!blob) throw new Error("Download failed");

      const buf = new Uint8Array(await blob.arrayBuffer());
      const base64Encode = (bytes: Uint8Array) => {
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      };

      const contentType = blob.type || "image/jpeg";
      const base64Image = `data:${contentType};base64,${base64Encode(buf)}`;

      const form = new FormData();
      form.append("apikey", ocrKey);
      form.append("language", "auto");
      form.append("OCREngine", "2");
      form.append("base64Image", base64Image);

      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      const parsed = json?.ParsedResults?.[0]?.ParsedText;
      if (parsed && typeof parsed === "string") {
        ocrText = String(parsed || "").trim();
      }
    } catch (_e) {
      ocrText = "";
    }

    let extracted: Array<{ english: string; vietnamese: string; example?: string }> = [];
    if (ocrText) extracted = parseVocabularyFromText(ocrText);
    
    // Deduplicate against existing vocabulary of this collection
    const vocabIds = await kv.get(`vocabulary:collection:${image.collectionId}`) || [];
    const existing = (await kv.mget(vocabIds)).filter(Boolean);
    const exists = new Set(existing.map((v: any) => `${(v.english || "").toLowerCase().trim()}|${(v.vietnamese || "").toLowerCase().trim()}`));
    
    const toSave = extracted.filter(it => {
      const key = `${it.english.toLowerCase().trim()}|${it.vietnamese.toLowerCase().trim()}`;
      if (exists.has(key)) return false;
      exists.add(key);
      return true;
    });
    
    // Save new items
    const savedItems = [];
    for (const item of toSave) {
      const vocabId = crypto.randomUUID();
      const vocabulary = {
        id: vocabId,
        collectionId: image.collectionId,
        english: item.english,
        vietnamese: item.vietnamese,
        example: item.example || '',
        createdAt: new Date().toISOString(),
      };
      await kv.set(`vocabulary:${vocabId}`, vocabulary);
      vocabIds.push(`vocabulary:${vocabId}`);
      savedItems.push(vocabulary);
    }
    await kv.set(`vocabulary:collection:${image.collectionId}`, vocabIds);
    
    // Update collection timestamp
    const collection = await kv.get(`collection:${image.collectionId}`);
    if (collection) {
      collection.updatedAt = new Date().toISOString();
      await kv.set(`collection:${image.collectionId}`, collection);
    }
    
    return c.json({ savedCount: savedItems.length, items: savedItems, extracted, ocrText });
  } catch (error) {
    console.error('Extract vocabulary error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==================== VOCABULARY ROUTES ====================

// Get vocabulary for collection
app.get("/server/vocabulary/:collectionId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const collectionId = c.req.param('collectionId');
    const collection = await kv.get(`collection:${collectionId}`);
    
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    
    const vocabIds = await kv.get(`vocabulary:collection:${collectionId}`) || [];
    const vocabulary = await kv.mget(vocabIds);
    
    return c.json({ vocabulary: vocabulary.filter(Boolean) });
  } catch (error) {
    console.error('Get vocabulary error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Save vocabulary items
app.post("/server/vocabulary", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { collectionId, items } = await c.req.json();
    
    const collection = await kv.get(`collection:${collectionId}`);
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    
    const savedItems = [];
    const vocabIds = await kv.get(`vocabulary:collection:${collectionId}`) || [];
    
    for (const item of items) {
      const vocabId = crypto.randomUUID();
      const vocabulary = {
        id: vocabId,
        collectionId,
        english: item.english,
        vietnamese: item.vietnamese,
        example: item.example || '',
        createdAt: new Date().toISOString(),
      };
      
      await kv.set(`vocabulary:${vocabId}`, vocabulary);
      vocabIds.push(`vocabulary:${vocabId}`);
      savedItems.push(vocabulary);
    }
    
    await kv.set(`vocabulary:collection:${collectionId}`, vocabIds);
    
    // Update collection timestamp
    collection.updatedAt = new Date().toISOString();
    await kv.set(`collection:${collectionId}`, collection);
    
    return c.json({ items: savedItems });
  } catch (error) {
    console.error('Save vocabulary error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update vocabulary item
app.put("/server/vocabulary/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const vocabId = c.req.param('id');
    const updates = await c.req.json();
    
    const vocabulary = await kv.get(`vocabulary:${vocabId}`);
    if (!vocabulary) {
      return c.json({ error: 'Vocabulary not found' }, 404);
    }
    
    const collection = await kv.get(`collection:${vocabulary.collectionId}`);
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const updated = {
      ...vocabulary,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`vocabulary:${vocabId}`, updated);
    
    return c.json({ vocabulary: updated });
  } catch (error) {
    console.error('Update vocabulary error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete vocabulary item
app.delete("/server/vocabulary/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const vocabId = c.req.param('id');
    const vocabulary = await kv.get(`vocabulary:${vocabId}`);
    
    if (!vocabulary) {
      return c.json({ error: 'Vocabulary not found' }, 404);
    }
    
    const collection = await kv.get(`collection:${vocabulary.collectionId}`);
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    await kv.del(`vocabulary:${vocabId}`);
    
    // Remove from collection's vocabulary list
    const vocabIds = await kv.get(`vocabulary:collection:${vocabulary.collectionId}`) || [];
    const filtered = vocabIds.filter((id: string) => id !== `vocabulary:${vocabId}`);
    await kv.set(`vocabulary:collection:${vocabulary.collectionId}`, filtered);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete vocabulary error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==================== QUIZ ROUTES ====================

// Generate quiz from collection
app.post("/server/quizzes/generate", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { collectionId, questionCount = 10, mode = 'en-vi' } = await c.req.json();
    
    const collection = await kv.get(`collection:${collectionId}`);
    if (!collection || collection.userId !== user.id) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    
    // Get all vocabulary for this collection
    const vocabIds = await kv.get(`vocabulary:collection:${collectionId}`) || [];
    const allVocabulary = await kv.mget(vocabIds);
    const vocabulary = allVocabulary.filter(Boolean);
    
    // CRITICAL: Must have at least 4 unique items to generate quiz
    if (vocabulary.length < 4) {
      return c.json({ 
        error: 'Cần ít nhất 4 từ vựng khác nhau để tạo quiz. Hiện tại chỉ có ' + vocabulary.length + ' từ.' 
      }, 400);
    }
    
    // Shuffle and select questions
    const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
    const selectedVocab = shuffled.slice(0, Math.min(questionCount, vocabulary.length));
    
    // Generate questions with wrong answers from same collection
    const questions = selectedVocab.map((vocab, index) => {
      let m: 'en-vi' | 'vi-en' = 'en-vi';
      if (mode === 'vi-en') m = 'vi-en';
      else if (mode === 'challenge') m = Math.random() < 0.5 ? 'en-vi' : 'vi-en';

      if (m === 'en-vi') {
        const wrongAnswers = vocabulary
          .filter(v => v.id !== vocab.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(v => v.vietnamese);
        const options = [vocab.vietnamese, ...wrongAnswers].sort(() => Math.random() - 0.5);
        return {
          id: crypto.randomUUID(),
          order: index,
          english: vocab.english,
          correctAnswer: vocab.vietnamese,
          options,
          vocabularyId: vocab.id,
        };
      } else {
        const wrongAnswers = vocabulary
          .filter(v => v.id !== vocab.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(v => v.english);
        const options = [vocab.english, ...wrongAnswers].sort(() => Math.random() - 0.5);
        return {
          id: crypto.randomUUID(),
          order: index,
          english: vocab.vietnamese, // question text in Vietnamese
          correctAnswer: vocab.english,
          options,
          vocabularyId: vocab.id,
        };
      }
    });
    
    const quizId = crypto.randomUUID();
    const quiz = {
      id: quizId,
      collectionId,
      userId: user.id,
      title: mode === 'en-vi'
        ? `Quiz EN → VI: ${collection.name}`
        : mode === 'vi-en'
        ? `Quiz VI → EN: ${collection.name}`
        : `Quiz Challenge: ${collection.name}`,
      questions,
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`quiz:${quizId}`, quiz);
    
    // Add to collection's quizzes
    const collectionQuizzes = await kv.get(`quizzes:collection:${collectionId}`) || [];
    collectionQuizzes.push(`quiz:${quizId}`);
    await kv.set(`quizzes:collection:${collectionId}`, collectionQuizzes);
    
    return c.json({ quiz });
  } catch (error) {
    console.error('Generate quiz error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get quiz by ID
app.get("/server/quizzes/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const quizId = c.req.param('id');
    const quiz = await kv.get(`quiz:${quizId}`);
    
    if (!quiz || quiz.userId !== user.id) {
      return c.json({ error: 'Quiz not found' }, 404);
    }
    
    return c.json({ quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Save quiz attempt
app.post("/server/attempts", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { quizId, answers, score, totalQuestions } = await c.req.json();
    
    const quiz = await kv.get(`quiz:${quizId}`);
    if (!quiz || quiz.userId !== user.id) {
      return c.json({ error: 'Quiz not found' }, 404);
    }
    
    const attemptId = crypto.randomUUID();
    const attempt = {
      id: attemptId,
      quizId,
      userId: user.id,
      collectionId: quiz.collectionId,
      answers,
      score,
      totalQuestions,
      completedAt: new Date().toISOString(),
    };
    
    await kv.set(`attempt:${attemptId}`, attempt);
    
    // Add to user's attempts
    const userAttempts = await kv.get(`attempts:user:${user.id}`) || [];
    userAttempts.unshift(`attempt:${attemptId}`); // Add to beginning
    await kv.set(`attempts:user:${user.id}`, userAttempts);
    
    return c.json({ attempt });
  } catch (error) {
    console.error('Save attempt error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get quiz attempt history
app.get("/server/attempts", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const attemptIds = await kv.get(`attempts:user:${user.id}`) || [];
    const attempts = await kv.mget(attemptIds);
    
    // Get collection names for each attempt
    const attemptsWithCollections = await Promise.all(
      attempts.filter(Boolean).map(async (attempt) => {
        const collection = await kv.get(`collection:${attempt.collectionId}`);
        return {
          ...attempt,
          collectionName: collection?.name || 'Unknown',
        };
      })
    );
    
    return c.json({ attempts: attemptsWithCollections });
  } catch (error) {
    console.error('Get attempts error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==================== SEED DATA ====================

// Seed sample data for demo
app.post("/server/seed", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    // Create sample collection
    const collectionId = crypto.randomUUID();
    const collection = {
      id: collectionId,
      userId: user.id,
      name: 'Từ vựng giao tiếp cơ bản',
      description: 'Các từ vựng tiếng Anh thường dùng trong giao tiếp hàng ngày',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`collection:${collectionId}`, collection);
    
    const userCollections = await kv.get(`collections:user:${user.id}`) || [];
    userCollections.push(`collection:${collectionId}`);
    await kv.set(`collections:user:${user.id}`, userCollections);
    
    // Sample vocabulary
    const sampleVocabulary = [
      { english: 'hello', vietnamese: 'xin chào', example: 'Hello! How are you today?' },
      { english: 'goodbye', vietnamese: 'tạm biệt', example: 'Goodbye! See you tomorrow.' },
      { english: 'thank you', vietnamese: 'cảm ơn', example: 'Thank you very much for your help.' },
      { english: 'please', vietnamese: 'làm ơn', example: 'Please pass me the salt.' },
      { english: 'sorry', vietnamese: 'xin lỗi', example: 'Sorry, I didn\'t mean to interrupt.' },
      { english: 'yes', vietnamese: 'có', example: 'Yes, I agree with you.' },
      { english: 'no', vietnamese: 'không', example: 'No, I don\'t think so.' },
      { english: 'friend', vietnamese: 'bạn bè', example: 'She is my best friend.' },
      { english: 'family', vietnamese: 'gia đình', example: 'I love spending time with my family.' },
      { english: 'school', vietnamese: 'trường học', example: 'I go to school every day.' },
      { english: 'teacher', vietnamese: 'giáo viên', example: 'My teacher is very kind.' },
      { english: 'student', vietnamese: 'học sinh', example: 'There are 30 students in my class.' },
      { english: 'book', vietnamese: 'sách', example: 'I like reading books.' },
      { english: 'water', vietnamese: 'nước', example: 'Can I have a glass of water?' },
      { english: 'food', vietnamese: 'thức ăn', example: 'Vietnamese food is delicious.' },
    ];
    
    const vocabIds = [];
    for (const item of sampleVocabulary) {
      const vocabId = crypto.randomUUID();
      const vocabulary = {
        id: vocabId,
        collectionId,
        ...item,
        createdAt: new Date().toISOString(),
      };
      
      await kv.set(`vocabulary:${vocabId}`, vocabulary);
      vocabIds.push(`vocabulary:${vocabId}`);
    }
    
    await kv.set(`vocabulary:collection:${collectionId}`, vocabIds);
    await kv.set(`images:collection:${collectionId}`, []);
    await kv.set(`quizzes:collection:${collectionId}`, []);
    
    return c.json({ success: true, collection });
  } catch (error) {
    console.error('Seed data error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
