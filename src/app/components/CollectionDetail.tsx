import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { collectionsAPI, vocabularyAPI, imagesAPI, quizzesAPI } from '../lib/api';
import { toast } from 'sonner';
import { Header } from './Header';
import { Upload, Plus, Edit2, Trash2, Save, X, Play } from 'lucide-react';

interface Vocabulary {
  id: string;
  english: string;
  vietnamese: string;
  example: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
}

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ english: '', vietnamese: '', example: '' });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ english: '', vietnamese: '', example: '' });
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (id) {
      loadData();
    }
  }, [user, id, navigate]);

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [collectionData, vocabData] = await Promise.all([
        collectionsAPI.getById(id),
        vocabularyAPI.getByCollection(id),
      ]);
      
      setCollection(collectionData.collection);
      setVocabulary(vocabData.vocabulary || []);
    } catch (error: any) {
      console.error('Load data error:', error);
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await imagesAPI.upload(id!, file);
      toast.success('Upload thành công!');
      navigate(`/collections/${id}/extract/${data.image.id}`);
    } catch (error: any) {
      // Check if it's a backend unavailable error
      if (error.message?.includes('fetch') || error.message?.includes('Failed')) {
        toast.error('Upload ảnh yêu cầu kết nối backend. Vui lòng thêm từ vựng thủ công.');
      } else {
        toast.error(error.message || 'Upload thất bại');
      }
    } finally {
      setUploading(false);
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const handleAddVocabulary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const data = await vocabularyAPI.save(id, [newItem]);
      setVocabulary([...vocabulary, ...data.items]);
      setShowAddDialog(false);
      setNewItem({ english: '', vietnamese: '', example: '' });
      toast.success('Đã thêm từ vựng!');
    } catch (error: any) {
      console.error('Add vocabulary error:', error);
      toast.error(error.message || 'Thêm từ vựng thất bại');
    }
  };

  const handleEditStart = (vocab: Vocabulary) => {
    setEditingId(vocab.id);
    setEditForm({
      english: vocab.english,
      vietnamese: vocab.vietnamese,
      example: vocab.example,
    });
  };

  const handleEditSave = async () => {
    if (!editingId) return;

    try {
      const data = await vocabularyAPI.update(editingId, editForm);
      setVocabulary(vocabulary.map(v => v.id === editingId ? data.vocabulary : v));
      setEditingId(null);
      toast.success('Đã cập nhật!');
    } catch (error: any) {
      console.error('Update vocabulary error:', error);
      toast.error(error.message || 'Cập nhật thất bại');
    }
  };

  const handleDelete = async (vocabId: string) => {
    if (!confirm('Xóa từ vựng này?')) return;

    try {
      await vocabularyAPI.delete(vocabId);
      setVocabulary(vocabulary.filter(v => v.id !== vocabId));
      toast.success('Đã xóa!');
    } catch (error: any) {
      console.error('Delete vocabulary error:', error);
      toast.error(error.message || 'Xóa thất bại');
    }
  };

  const handleGenerateQuiz = async () => {
    if (!id) return;

    // Check minimum vocabulary count
    if (vocabulary.length < 4) {
      toast.error('Cần ít nhất 4 từ vựng để tạo quiz!');
      return;
    }

    setGenerating(true);
    try {
      const data = await quizzesAPI.generate(id, 10);
      toast.success('Đã tạo quiz!');
      navigate(`/quiz/${data.quiz.id}`);
    } catch (error: any) {
      console.error('Generate quiz error:', error);
      toast.error(error.message || 'Tạo quiz thất bại');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Không tìm thấy bộ sưu tập</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{collection.name}</h1>
          <p className="text-gray-600">{collection.description}</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {uploading ? 'Đang upload...' : 'Upload ảnh'}
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadImage}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowAddDialog(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Thêm từ vựng
          </button>

          <button
            onClick={handleGenerateQuiz}
            disabled={generating || vocabulary.length < 4}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            {generating ? 'Đang tạo...' : 'Tạo Quiz'}
          </button>

          {vocabulary.length < 4 && (
            <div className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
              Cần ít nhất 4 từ vựng để tạo quiz (hiện có {vocabulary.length})
            </div>
          )}
        </div>

        {/* Vocabulary Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiếng Anh
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiếng Việt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ví dụ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vocabulary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Chưa có từ vựng nào. Upload ảnh hoặc thêm thủ công.
                    </td>
                  </tr>
                ) : (
                  vocabulary.map((vocab) => (
                    <tr key={vocab.id} className="hover:bg-gray-50">
                      {editingId === vocab.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.english}
                              onChange={(e) => setEditForm({ ...editForm, english: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.vietnamese}
                              onChange={(e) => setEditForm({ ...editForm, vietnamese: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.example}
                              onChange={(e) => setEditForm({ ...editForm, example: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={handleEditSave}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {vocab.english}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {vocab.vietnamese}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {vocab.example || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditStart(vocab)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(vocab.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Vocabulary Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Thêm từ vựng mới</h2>
            
            <form onSubmit={handleAddVocabulary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiếng Anh
                </label>
                <input
                  type="text"
                  value={newItem.english}
                  onChange={(e) => setNewItem({ ...newItem, english: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="hello"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiếng Việt
                </label>
                <input
                  type="text"
                  value={newItem.vietnamese}
                  onChange={(e) => setNewItem({ ...newItem, vietnamese: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="xin chào"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ví dụ (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={newItem.example}
                  onChange={(e) => setNewItem({ ...newItem, example: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Hello, how are you?"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewItem({ english: '', vietnamese: '', example: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Thêm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}