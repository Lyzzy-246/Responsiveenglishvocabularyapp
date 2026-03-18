import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { attemptsAPI } from '../lib/api';
import { toast } from 'sonner';
import { Header } from './Header';
import { Trophy, Calendar, BookOpen, TrendingUp } from 'lucide-react';

interface Attempt {
  id: string;
  quizId: string;
  collectionId: string;
  collectionName?: string;
  collection?: {
    name: string;
  };
  score: number;
  totalQuestions: number;
  completedAt?: string;
  createdAt?: string;
}

export function QuizHistory() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadHistory();
  }, [user, navigate]);

  const loadHistory = async () => {
    try {
      const data = await attemptsAPI.getHistory();
      const items: Attempt[] = data.attempts || [];
      const sorted = items.slice().sort((a, b) => {
        const ta = new Date(a.completedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.completedAt || b.createdAt || 0).getTime();
        return tb - ta; // mới nhất lên trên
      });
      setAttempts(sorted);
    } catch (error: any) {
      console.error('Load history error:', error);
      toast.error('Không thể tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50';
    if (score >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const calculateStats = () => {
    if (attempts.length === 0) return { avgScore: 0, totalQuizzes: 0, bestScore: 0 };
    
    const avgScore = Math.round(
      attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
    );
    const bestScore = Math.max(...attempts.map(a => a.score));
    
    return {
      avgScore,
      totalQuizzes: attempts.length,
      bestScore,
    };
  };

  const stats = calculateStats();

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lịch sử làm Quiz</h1>
          <p className="text-gray-600">Xem lại kết quả các bài quiz đã làm</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Tổng số quiz</div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalQuizzes}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Điểm cao nhất</div>
                <div className="text-2xl font-bold text-gray-900">{stats.bestScore}%</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Điểm trung bình</div>
                <div className="text-2xl font-bold text-gray-900">{stats.avgScore}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* History List */}
        {attempts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Chưa có lịch sử</h3>
            <p className="text-gray-500 mb-6">Bạn chưa làm quiz nào. Hãy bắt đầu học từ vựng!</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Về trang chủ
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bộ sưu tập
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Điểm số
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kết quả
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thời gian
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attempts.map((attempt) => {
                    const correctCount = Math.round((attempt.score / 100) * attempt.totalQuestions);
                    return (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {attempt.collectionName || attempt.collection?.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getScoreBgColor(attempt.score)} ${getScoreColor(attempt.score)}`}>
                            {attempt.score}%
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {correctCount}/{attempt.totalQuestions} đúng
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            {new Date(attempt.completedAt || attempt.createdAt || '').toLocaleString('vi-VN')}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
