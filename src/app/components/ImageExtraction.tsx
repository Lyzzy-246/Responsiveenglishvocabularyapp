import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { imagesAPI, vocabularyAPI } from '../lib/api';
import { toast } from 'sonner';
import { Header } from './Header';
import { Save, X, Plus, Trash2 } from 'lucide-react';

interface ExtractedItem {
  english: string;
  vietnamese: string;
  example: string;
}

export function ImageExtraction() {
  const { id: collectionId, imageId } = useParams<{ id: string; imageId: string }>();
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (imageId) {
      extractVocabulary();
    }
  }, [user, imageId, navigate]);

  const extractVocabulary = async () => {
    if (!imageId) return;

    try {
      if (collectionId) {
        const draftKey = `ocrDraft:${collectionId}:${imageId}`;
        const raw = sessionStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          setExtractedItems(draft?.items || []);
          return;
        }
      }

      const data = await imagesAPI.extract(imageId);
      setExtractedItems(data.extracted || []);
    } catch (error: any) {
      console.error('Extract error:', error);
      toast.error('Trích xuất từ vựng thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof ExtractedItem, value: string) => {
    const updated = [...extractedItems];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setExtractedItems(extractedItems.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setExtractedItems([...extractedItems, { english: '', vietnamese: '', example: '' }]);
  };

  const handleSave = async () => {
    if (!collectionId) return;

    // Filter out empty items
    const validItems = extractedItems.filter(
      item => item.english.trim() && item.vietnamese.trim()
    );

    if (validItems.length === 0) {
      toast.error('Vui lòng nhập ít nhất một từ vựng');
      return;
    }

    setSaving(true);
    try {
      await vocabularyAPI.save(collectionId, validItems);
      toast.success(`Đã lưu ${validItems.length} từ vựng!`);
      if (imageId) {
        sessionStorage.removeItem(`ocrDraft:${collectionId}:${imageId}`);
      }
      navigate(`/collections/${collectionId}`);
    } catch (error: any) {
      console.error('Save vocabulary error:', error);
      toast.error(error.message || 'Lưu từ vựng thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Hủy bỏ? Các thay đổi sẽ không được lưu.')) {
      if (collectionId && imageId) {
        sessionStorage.removeItem(`ocrDraft:${collectionId}:${imageId}`);
      }
      navigate(`/collections/${collectionId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Đang trích xuất từ vựng...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Xem và chỉnh sửa từ vựng</h1>
          <p className="text-gray-600">Kiểm tra và chỉnh sửa từ vựng được trích xuất từ ảnh</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Từ vựng trích xuất ({extractedItems.length})
            </h2>
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm từ
            </button>
          </div>

          <div className="space-y-4">
            {extractedItems.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tiếng Anh *
                    </label>
                    <input
                      type="text"
                      value={item.english}
                      onChange={(e) => handleUpdateItem(index, 'english', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="hello"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tiếng Việt *
                    </label>
                    <input
                      type="text"
                      value={item.vietnamese}
                      onChange={(e) => handleUpdateItem(index, 'vietnamese', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="xin chào"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ví dụ
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.example}
                        onChange={(e) => handleUpdateItem(index, 'example', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Hello, how are you?"
                      />
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {extractedItems.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Không có từ vựng nào. Nhấn "Thêm từ" để thêm thủ công.
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Đang lưu...' : 'Lưu từ vựng'}
          </button>
        </div>
      </main>
    </div>
  );
}
