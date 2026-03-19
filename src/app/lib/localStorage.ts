// LocalStorage fallback for when backend is unavailable
// This is temporary data storage for development/testing

interface Collection {
  id: string;
  name: string;
  description: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface VocabularyItem {
  id: string;
  collectionId: string;
  word: string;
  meaning: string;
  example?: string;
  imageId?: string;
  createdAt: string;
}

interface Quiz {
  id: string;
  collectionId: string;
  questions: any[];
  createdAt: string;
}

interface Attempt {
  id: string;
  quizId: string;
  collectionId: string;
  userId: string;
  answers: any[];
  score: number;
  totalQuestions: number;
  createdAt: string;
}

const STORAGE_KEYS = {
  USER: 'vocabmaster_user',
  COLLECTIONS: 'vocabmaster_collections',
  VOCABULARY: 'vocabmaster_vocabulary',
  QUIZZES: 'vocabmaster_quizzes',
  ATTEMPTS: 'vocabmaster_attempts',
};

export const localStorageAPI = {
  // User
  setUser: (user: any) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  
  getUser: () => {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  },
  
  clearUser: () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
  
  signup: async (email: string, password: string, name: string) => {
    // Create a simple local user
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      createdAt: new Date().toISOString(),
    };
    localStorageAPI.setUser(user);
    
    // Store credentials (in production, never store passwords like this!)
    const credentials = { email, password };
    localStorage.setItem(`credentials_${email}`, JSON.stringify(credentials));
    
    return { success: true, user };
  },
  
  login: async (email: string, password: string) => {
    const credentials = localStorage.getItem(`credentials_${email}`);
    if (credentials) {
      const { email: storedEmail, password: storedPassword } = JSON.parse(credentials);
      if (email === storedEmail && password === storedPassword) {
        const user = localStorageAPI.getUser();
        return { success: true, user };
      }
    }
    return { success: false, message: 'Invalid email or password' };
  },
  
  // Collections
  getCollections: (): Collection[] => {
    const collections = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
    return collections ? JSON.parse(collections) : [];
  },
  
  addCollection: (collection: Collection) => {
    const collections = localStorageAPI.getCollections();
    collections.push(collection);
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
  },

  updateCollection: (id: string, updates: Partial<Collection>) => {
    const collections = localStorageAPI.getCollections();
    const index = collections.findIndex(c => c.id === id);
    if (index !== -1) {
      collections[index] = { ...collections[index], ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
    }
  },
  
  deleteCollection: (id: string) => {
    const collections = localStorageAPI.getCollections();
    const filtered = collections.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(filtered));
    
    // Also delete related vocabulary and quizzes
    const vocabulary = localStorageAPI.getVocabulary();
    const filteredVocab = vocabulary.filter(v => v.collectionId !== id);
    localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(filteredVocab));
    
    const quizzes = localStorageAPI.getQuizzes();
    const filteredQuizzes = quizzes.filter(q => q.collectionId !== id);
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(filteredQuizzes));
  },
  
  getCollectionById: (id: string): Collection | null => {
    const collections = localStorageAPI.getCollections();
    return collections.find(c => c.id === id) || null;
  },
  
  // Vocabulary
  getVocabulary: (): VocabularyItem[] => {
    const vocabulary = localStorage.getItem(STORAGE_KEYS.VOCABULARY);
    return vocabulary ? JSON.parse(vocabulary) : [];
  },
  
  getVocabularyByCollection: (collectionId: string): VocabularyItem[] => {
    const vocabulary = localStorageAPI.getVocabulary();
    return vocabulary.filter(v => v.collectionId === collectionId);
  },
  
  saveVocabulary: (items: VocabularyItem[]) => {
    const allVocabulary = localStorageAPI.getVocabulary();
    const existingPairs = new Set(
      allVocabulary.map(v =>
        `${(v.word || '').toLowerCase().trim()}|${(v.meaning || '').toLowerCase().trim()}`
      )
    );
    const seen = new Set<string>();
    const newItems = items.filter(item => {
      const key = `${(item.word || '').toLowerCase().trim()}|${(item.meaning || '').toLowerCase().trim()}`;
      if (!item.word || !item.meaning) return false;
      if (existingPairs.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return !allVocabulary.find(v => v.id === item.id);
    });
    const updated = [...allVocabulary, ...newItems];
    localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(updated));
  },
  
  deleteVocabulary: (id: string) => {
    const vocabulary = localStorageAPI.getVocabulary();
    const filtered = vocabulary.filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(filtered));
  },
  
  updateVocabulary: (id: string, updates: Partial<VocabularyItem>) => {
    const vocabulary = localStorageAPI.getVocabulary();
    const index = vocabulary.findIndex(v => v.id === id);
    if (index !== -1) {
      vocabulary[index] = { ...vocabulary[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(vocabulary));
    }
  },
  
  // Quizzes
  getQuizzes: (): Quiz[] => {
    const quizzes = localStorage.getItem(STORAGE_KEYS.QUIZZES);
    return quizzes ? JSON.parse(quizzes) : [];
  },
  
  saveQuiz: (quiz: Quiz) => {
    const quizzes = localStorageAPI.getQuizzes();
    quizzes.push(quiz);
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
  },
  
  getQuizById: (id: string): Quiz | null => {
    const quizzes = localStorageAPI.getQuizzes();
    return quizzes.find(q => q.id === id) || null;
  },
  
  // Attempts
  getAttempts: (): Attempt[] => {
    const attempts = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
    return attempts ? JSON.parse(attempts) : [];
  },
  
  saveAttempt: (attempt: Attempt) => {
    const attempts = localStorageAPI.getAttempts();
    attempts.push(attempt);
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
  },
  
  // Seed data
  seedData: (userId: string) => {
    const collectionId = crypto.randomUUID();
    
    const collection: Collection = {
      id: collectionId,
      userId,
      name: 'Từ vựng mẫu',
      description: 'Bộ sưu tập mẫu để bắt đầu học',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    localStorageAPI.addCollection(collection);
    
    const sampleVocabulary: VocabularyItem[] = [
      {
        id: crypto.randomUUID(),
        collectionId,
        word: 'abundant',
        meaning: 'dồi dào, phong phú',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        collectionId,
        word: 'accomplish',
        meaning: 'hoàn thành, đạt được',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        collectionId,
        word: 'perseverance',
        meaning: 'sự kiên trì, bền bỉ',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        collectionId,
        word: 'diligent',
        meaning: 'chăm chỉ, siêng năng',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        collectionId,
        word: 'resilient',
        meaning: 'kiên cường, có khả năng phục hồi',
        createdAt: new Date().toISOString(),
      },
    ];
    
    localStorageAPI.saveVocabulary(sampleVocabulary);
    
    return collection;
  },
};
