import { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { Header } from './Header';
import { CheckCircle2, XCircle, Trophy, Home, RotateCcw } from 'lucide-react';

interface Answer {
  questionId: string;
  english: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

interface LocationState {
  score: number;
  correctCount: number;
  totalQuestions: number;
  answers: Answer[];
}

export function QuizResults() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = location.state as LocationState;

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (!state) {
      navigate('/dashboard');
    }
  }, [user, state, navigate]);

  if (!state) {
    return null;
  }

  const { score, correctCount, totalQuestions, answers } = state;

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

  const getMessage = (score: number) => {
    if (score >= 90) return 'Xuất sắc! 🎉';
    if (score >= 80) return 'Rất tốt! 👏';
    if (score >= 70) return 'Khá tốt! 👍';
    if (score >= 60) return 'Tạm được! 💪';
    return 'Cần cố gắng thêm! 📚';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Card */}
        <div className={`${getScoreBgColor(score)} rounded-2xl p-8 mb-8 text-center`}>
          <Trophy className={`w-16 h-16 mx-auto mb-4 ${getScoreColor(score)}`} />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{getMessage(score)}</h1>
          <div className={`text-6xl font-bold mb-4 ${getScoreColor(score)}`}>
            {score}%
          </div>
          <p className="text-xl text-gray-700">
            Bạn đã trả lời đúng {correctCount}/{totalQuestions} câu
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Về trang chủ
          </button>
          <button
            onClick={() => navigate(`/quiz/${id}`)}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Làm lại
          </button>
        </div>

        {/* Detailed Answers */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Chi tiết câu trả lời</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {answers.map((answer, index) => (
              <div key={answer.questionId} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {answer.isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-sm text-gray-500">Câu {index + 1}</span>
                        <h3 className="text-lg font-semibold text-gray-900">{answer.english}</h3>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {!answer.isCorrect && answer.userAnswer && (
                        <div className="flex items-start gap-2">
                          <span className="text-sm text-red-600 font-medium">Bạn đã chọn:</span>
                          <span className="text-sm text-red-600">{answer.userAnswer}</span>
                        </div>
                      )}
                      
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-green-600 font-medium">
                          {answer.isCorrect ? 'Bạn đã chọn:' : 'Đáp án đúng:'}
                        </span>
                        <span className="text-sm text-green-600">{answer.correctAnswer}</span>
                      </div>

                      {!answer.userAnswer && (
                        <div className="text-sm text-gray-500 italic">
                          Bạn chưa trả lời câu này
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
