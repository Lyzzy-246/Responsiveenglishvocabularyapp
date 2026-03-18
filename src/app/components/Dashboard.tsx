import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { collectionsAPI, seedAPI } from '../lib/api';
import { toast } from 'sonner';
import { Header } from './Header';
import { Plus, BookOpen, Trash2, ChevronRight, Sparkles, WifiOff } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export function Dashboard() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadCollections();
  }, [user, navigate]);

  const loadCollections = async () => {
    try {
      const data = await collectionsAPI.getAll();
      setCollections(data.collections || []);
    } catch (error: any) {
      // Silently handled by localStorage fallback
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên bộ sưu tập');
      return;
    }
    
    setCreating(true);

    try {
      const data = await collectionsAPI.create(name, description);
      toast.success('Tạo bộ sưu tập thành công!');
      setCollections([...collections, data.collection]);
      setShowNewDialog(false);
      setName('');
      setDescription('');
    } catch (error: any) {
      toast.error(error.message || 'Tạo bộ sưu tập thất bại');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Bạn có chắc muốn xóa bộ sưu tập này?')) return;

    try {
      await collectionsAPI.delete(id);
      toast.success('Đã xóa bộ sưu tập');
      setCollections(collections.filter(c => c.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Xóa bộ sưu tập thất bại');
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const data = await seedAPI.seedData();
      toast.success('Đã tạo dữ liệu mẫu!');
      await loadCollections();
    } catch (error: any) {
      toast.error(error.message || 'Tạo dữ liệu mẫu thất bại');
    } finally {
      setSeeding(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bộ sưu tập của tôi</h1>
            <p className="text-gray-600 mt-1">Quản lý từ vựng và tạo bài quiz</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {seeding ? 'Đang tạo...' : 'Tạo dữ liệu mẫu'}
            </button>
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Tạo mới
            </button>
          </div>
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Chưa có bộ sưu tập nào</h3>
            <p className="text-gray-500 mb-6">Tạo bộ sưu tập đầu tiên để bắt đầu học từ vựng</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Tạo bộ sưu tập mới
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                onClick={() => navigate(`/collections/${collection.id}`)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate group-hover:text-blue-600 transition-colors">
                      {collection.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {collection.description || 'Không có mô tả'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteCollection(collection.id, e)}
                    className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {new Date(collection.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Collection Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tạo bộ sưu tập mới</h2>
            
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Tên bộ sưu tập
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ví dụ: Từ vựng IELTS"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả (không bắt buộc)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Mô tả ngắn về bộ sưu tập này"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDialog(false);
                    setName('');
                    setDescription('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}