import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { localStorageAPI } from './localStorage';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

// Flag to track if backend is available
let backendAvailable: boolean | null = null;
let backendCheckLogged = false;

// Create Supabase client for auth
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || publicAnonKey;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    ...options.headers,
  };

  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Helper to get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || publicAnonKey;
};

// Auth API
export const authAPI = {
  signup: async (email: string, password: string, name: string) => {
    // Use public anon key for signup since user is not authenticated yet
    try {
      const url = `${API_BASE}/auth/signup`;
      console.log('Signup request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email, password, name }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }
      
      return data;
    } catch (error) {
      console.error('Signup fetch error:', error);
      throw error;
    }
  },
  
  signin: async (email: string, password: string) => {
    return apiRequest('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  getSession: async () => {
    return apiRequest('/auth/session');
  },
  
  signout: async () => {
    await supabase.auth.signOut();
  },
};

// Collections API
export const collectionsAPI = {
  getAll: async () => {
    try {
      const data = await apiRequest('/collections');
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const collections = localStorageAPI.getCollections();
      return { collections };
    }
  },
  
  getById: async (id: string) => {
    try {
      const data = await apiRequest(`/collections/${id}`);
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const collection = localStorageAPI.getCollectionById(id);
      if (!collection) throw new Error('Collection not found');
      return { collection };
    }
  },
  
  create: async (name: string, description: string) => {
    try {
      const data = await apiRequest('/collections', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const user = localStorageAPI.getUser();
      const collection = {
        id: crypto.randomUUID(),
        userId: user?.id || 'local-user',
        name,
        description: description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorageAPI.addCollection(collection);
      return { collection };
    }
  },

  update: async (id: string, updates: { name?: string; description?: string }) => {
    try {
      const data = await apiRequest(`/collections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      localStorageAPI.updateCollection(id, updates as any);
      const collection = localStorageAPI.getCollectionById(id);
      if (!collection) throw new Error('Collection not found');
      return { collection };
    }
  },
  
  delete: async (id: string) => {
    try {
      const data = await apiRequest(`/collections/${id}`, {
        method: 'DELETE',
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      localStorageAPI.deleteCollection(id);
      return { success: true };
    }
  },
};

// Images API
export const imagesAPI = {
  upload: async (collectionId: string, file: File) => {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collectionId', collectionId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${API_BASE}/images/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  },
  
  extract: async (imageId: string) => {
    const token = await getAuthToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${API_BASE}/images/${imageId}/extract`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Extract failed');
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  },
};

// Vocabulary API
export const vocabularyAPI = {
  getByCollection: async (collectionId: string) => {
    try {
      const data = await apiRequest(`/vocabulary/${collectionId}`);
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const items = localStorageAPI.getVocabularyByCollection(collectionId);
      // Map localStorage format {word, meaning} to component format {english, vietnamese}
      const vocabulary = items.map(item => ({
        id: item.id,
        english: item.word,
        vietnamese: item.meaning,
        example: (item as any).example || '',
      }));
      return { vocabulary };
    }
  },
  
  save: async (collectionId: string, items: any[]) => {
    try {
      const data = await apiRequest('/vocabulary', {
        method: 'POST',
        body: JSON.stringify({ collectionId, items }),
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const existing = localStorageAPI.getVocabularyByCollection(collectionId);
      const existingSet = new Set(
        existing.map(v =>
          `${(v.word || '').toLowerCase().trim()}|${(v.meaning || '').toLowerCase().trim()}`
        )
      );
      const seen = new Set<string>();
      const vocabItems = items
        .map(item => ({
          id: item.id || crypto.randomUUID(),
          collectionId,
          word: item.english || item.word,
          meaning: item.vietnamese || item.meaning,
          example: item.example || '',
          imageId: item.imageId,
          createdAt: item.createdAt || new Date().toISOString(),
        }))
        .filter(it => {
          const key = `${(it.word || '').toLowerCase().trim()}|${(it.meaning || '').toLowerCase().trim()}`;
          if (!it.word || !it.meaning) return false;
          if (existingSet.has(key)) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      if (vocabItems.length > 0) {
        localStorageAPI.saveVocabulary(vocabItems);
      }
      // Map back to component format
      const resultItems = vocabItems.map(item => ({
        id: item.id,
        english: item.word,
        vietnamese: item.meaning,
        example: item.example,
      }));
      return { items: resultItems };
    }
  },
  
  update: async (id: string, updates: any) => {
    try {
      const data = await apiRequest(`/vocabulary/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      // Map component format to localStorage format
      const storageUpdates = {
        word: updates.english,
        meaning: updates.vietnamese,
        example: updates.example,
      };
      localStorageAPI.updateVocabulary(id, storageUpdates);
      // Return in component format
      const vocabulary = {
        id,
        english: updates.english,
        vietnamese: updates.vietnamese,
        example: updates.example,
      };
      return { vocabulary };
    }
  },
  
  delete: async (id: string) => {
    try {
      const data = await apiRequest(`/vocabulary/${id}`, {
        method: 'DELETE',
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      localStorageAPI.deleteVocabulary(id);
      return { success: true };
    }
  },
};

// Quizzes API
export const quizzesAPI = {
  generate: async (
    collectionId: string,
    questionCount: number = 10,
    mode: 'en-vi' | 'vi-en' | 'challenge' = 'en-vi'
  ) => {
    try {
      const data = await apiRequest('/quizzes/generate', {
        method: 'POST',
        body: JSON.stringify({ collectionId, questionCount, mode }),
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      
      // Generate quiz locally
      const vocabulary = localStorageAPI.getVocabularyByCollection(collectionId);
      
      if (vocabulary.length < 4) {
        throw new Error('Cần ít nhất 4 từ vựng để tạo quiz');
      }
      
      const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
      const count = Math.min(questionCount, vocabulary.length);
      
      const baseQuestions = shuffled.slice(0, count).map((item, index) => {
        const otherItems = vocabulary.filter(v => v.id !== item.id);
        const q: any = { item, index, otherItems };
        return q;
      });

      const questions = baseQuestions.map(({ item, index, otherItems }) => {
        // Decide mode for this question
        let m: 'en-vi' | 'vi-en' = 'en-vi';
        if (mode === 'vi-en') m = 'vi-en';
        else if (mode === 'challenge') m = Math.random() < 0.5 ? 'en-vi' : 'vi-en';

        if (m === 'en-vi') {
          const wrongAnswers = otherItems
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(v => v.meaning);
          const options = [item.meaning, ...wrongAnswers].sort(() => Math.random() - 0.5);
          return {
            id: `q${index + 1}`,
            order: index + 1,
            english: item.word, // question text
            correctAnswer: item.meaning,
            options,
            vocabularyId: item.id,
          };
        } else {
          // vi-en
          const wrongAnswers = otherItems
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(v => v.word);
          const options = [item.word, ...wrongAnswers].sort(() => Math.random() - 0.5);
          return {
            id: `q${index + 1}`,
            order: index + 1,
            english: item.meaning, // question text (vietnamese)
            correctAnswer: item.word,
            options,
            vocabularyId: item.id,
          };
        }
      });
      
      const quiz = {
        id: crypto.randomUUID(),
        collectionId,
        title: mode === 'en-vi' ? 'Quiz EN → VI' : mode === 'vi-en' ? 'Quiz VI → EN' : 'Quiz Challenge',
        questions,
        createdAt: new Date().toISOString(),
      };
      
      localStorageAPI.saveQuiz(quiz);
      return { quiz };
    }
  },
  
  getById: async (id: string) => {
    try {
      const data = await apiRequest(`/quizzes/${id}`);
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const quiz = localStorageAPI.getQuizById(id);
      if (!quiz) throw new Error('Quiz not found');
      return { quiz };
    }
  },
};

// Attempts API
export const attemptsAPI = {
  save: async (quizId: string, answers: any[], score: number, totalQuestions: number) => {
    try {
      const data = await apiRequest('/attempts', {
        method: 'POST',
        body: JSON.stringify({ quizId, answers, score, totalQuestions }),
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      
      const quiz = localStorageAPI.getQuizById(quizId);
      const user = localStorageAPI.getUser();
      
      const attempt = {
        id: crypto.randomUUID(),
        quizId,
        collectionId: quiz?.collectionId || '',
        userId: user?.id || 'local-user',
        answers,
        score,
        totalQuestions,
        createdAt: new Date().toISOString(),
      };
      
      localStorageAPI.saveAttempt(attempt);
      return { attempt };
    }
  },
  
  getHistory: async () => {
    try {
      const data = await apiRequest('/attempts');
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      const attempts = localStorageAPI.getAttempts();
      const collections = localStorageAPI.getCollections();
      
      // Enrich attempts with collection info
      const enrichedAttempts = attempts.map(attempt => ({
        ...attempt,
        collection: collections.find(c => c.id === attempt.collectionId),
      }));
      
      return { attempts: enrichedAttempts };
    }
  },
};

// Seed API
export const seedAPI = {
  seedData: async () => {
    try {
      const data = await apiRequest('/seed', {
        method: 'POST',
      });
      backendAvailable = true;
      return data;
    } catch (error) {
      console.warn('Backend unavailable, using localStorage fallback');
      backendAvailable = false;
      
      const user = localStorageAPI.getUser();
      const collection = localStorageAPI.seedData(user?.id || 'local-user');
      
      return { success: true, collection };
    }
  },
};
