export type VocabItem = { english: string; vietnamese: string; example?: string };

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
  // length bounds
  if (t.length < 2 || t.length > 80) return false;
  // must contain at least one English vowel
  if (!/[aeiou]/i.test(t)) return false;
  // allow letters, spaces, apostrophes, hyphens, plus signs, and slashes
  if (/[^A-Za-z\s'\-\/\+]/.test(t)) return false;
  return true;
};

const isExampleSentence = (s: string) => {
  const t = s.trim();
  if (!t) return false;
  if (hasVietnamese(t)) return false;
  return /[.!?]$/.test(t) && t.split(/\s+/).length >= 4;
};

// Split inline line into EN | VI if colon/dash missing but VI appears in-line
const splitInlineByVietnamese = (l: string): [string, string] | null => {
  const idx = [...l].findIndex((ch) => hasVietnamese(ch));
  if (idx <= 0) return null;
  const left = l.slice(0, idx).trim().replace(/[,\-:]+$/, "").trim();
  const right = l.slice(idx).trim().replace(/^[:\-,\s]+/, "").trim();
  if (!left || !right) return null;
  if (!isLikelyEnglishTerm(left)) return null;
  return [left, right];
};

// Join OCR-broken Vietnamese syllables: e.g., "ng ười" -> "người", "th ông" -> "thông", "ch ị" -> "chị"
const fixVietnameseArtifacts = (vi: string): string => {
  let s = vi;
  const VN_VOWEL =
    "[aeiouyăâêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]";
  const CONS_CLUSTER = "(?:ngh|ng|nh|th|tr|ch|gh|gi|kh|ph|qu|b|c|d|đ|g|h|k|l|m|n|p|q|r|s|t|v|x)";
  // cluster + vowel
  s = s.replace(new RegExp(`\\b(${CONS_CLUSTER})\\s+(${VN_VOWEL})`, "gi"), (_m, a, b) => `${a}${b}`);
  // common stuck combinations (no space) -> insert a space (chịmẹ -> chị mẹ, anhmẹ -> anh mẹ)
  s = s.replace(/([ạảãáàâăêôơưéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵa-zđ]+)mẹ/gi, "$1 mẹ");
  // collapse multiple spaces and normalize separators
  s = s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/\s+\/\s+/g, "/").trim();
  return s;
};

// Loại bỏ đuôi tiếng Anh rõ ràng (ví dụ "half-brother") nếu OCR dính vào cuối nghĩa
const removeTrailingEnglishTail = (vi: string): string => {
  const WHITELIST = new Set([
    "em",
    "anh",
    "trai",
    "gia",
    "me",
    "mẹ",
    "cha",
    "gái",
    "hàng",
    "cùng",
    "cha/mẹ",
    "anh/em",
  ]);
  const parts = vi.split(/\s+/);
  if (parts.length === 0) return vi.trim();
  const last = parts[parts.length - 1];
  // Nếu là cặp có dấu "/" (cha/mẹ, anh/em) thì giữ nguyên
  if (last.includes("/")) {
    return vi.replace(/[,\-:\s]+$/g, "").trim();
  }
  // Nếu là tiếng Anh thuần (ASCII) và có gạch nối hoặc khá dài, coi là đuôi tiếng Anh
  const isAsciiWord = /^[A-Za-z\-]+$/.test(last);
  const isEnglishTail = isAsciiWord && (last.includes("-") || last.length >= 7);
  if (isEnglishTail) {
    parts.pop();
    return parts.join(" ").replace(/[,\-:\s]+$/g, "").trim();
  }
  // Nếu là từ ngắn, giữ lại (tránh cắt "em", "trai", "gia")
  if (WHITELIST.has(last.toLowerCase())) {
    return vi.replace(/[,\-:\s]+$/g, "").trim();
  }
  return vi.replace(/[,\-:\s]+$/g, "").trim();
};

export function parseVocabularyFromText(text: string): VocabItem[] {
  if (!text || !text.trim()) return [];
  // Dùng dòng gốc để xác định ranh giới khối bullet "•" hoặc danh sách "- "
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: string[] = [];
  let cur: string | null = null;
  const isSectionHeading = (l: string) => /^\d+(?:\.\d+)*\.\s+/.test(l);
  for (const l0 of rawLines) {
    const l = l0.trim();
    // Nếu là heading dạng "1." hoặc "1.2." thì kết thúc khối hiện tại và bỏ qua heading
    if (/^\d+\.\s+/.test(l) || isSectionHeading(l)) {
      if (cur) {
        blocks.push(cur.trim());
        cur = null;
      }
      continue;
    }
    if (/^[—\-]+$/.test(l)) continue;  // bỏ separator
    if (/^•\s+/.test(l) || /^\-\s+/.test(l)) {
      if (cur) blocks.push(cur.trim());
      cur = l;
    } else {
      if (cur) cur += " " + l;
      else {
        // Bỏ qua nội dung trước bullet đầu tiên
      }
    }
  }
  if (cur) blocks.push(cur.trim());

  const items: VocabItem[] = [];
  for (let block of blocks) {
    // Bỏ dấu bullet/list marker
    let b = block.replace(/^•\s+/, "").replace(/^\-\s+/, "");
    // Gộp khoảng trắng
    b = b.replace(/\s+/g, " ").trim();
    // Bản không phiên âm để fallback tách theo ký tự tiếng Việt
    const bNoPho = b.replace(/\/[^/]*\//g, " ").replace(/\s+/g, " ").trim();

    // Ưu tiên mẫu: EN /.../ : VI  (EN có thể chứa dấu '-')
    let en = "";
    let vi = "";
    const mSlash = b.match(/^([A-Za-z][A-Za-z\- ]+?)\s*\/[^/]*\/\s*:\s*(.+)$/);
    if (mSlash) {
      en = mSlash[1].trim();
      vi = mSlash[2].trim();
    } else {
      // Thử EN : VI (không có phiên âm)
      const idx = b.indexOf(":");
      if (idx !== -1) {
        en = b.slice(0, idx).trim();
        vi = b.slice(idx + 1).trim();
      } else {
        // Fallback: tách theo sự xuất hiện ký tự tiếng Việt đầu tiên
        const pair = splitInlineByVietnamese(bNoPho);
        if (pair) {
          en = pair[0];
          vi = pair[1];
        }
      }
    }

    // Lọc EN hợp lệ (giữ nguyên "S +", dấu "/" trong cụm từ)
    en = en.trim();
    if (!isLikelyEnglishTerm(en)) continue;

    // Làm sạch nghĩa tiếng Việt
    if (vi) {
      vi = fixVietnameseArtifacts(vi);
      vi = removeTrailingEnglishTail(vi);
    }

    if (en && vi) {
      items.push({ english: en, vietnamese: vi });
    }
  }
  return items;
}
