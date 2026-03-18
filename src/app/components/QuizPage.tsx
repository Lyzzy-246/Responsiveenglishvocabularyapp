import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { quizzesAPI, attemptsAPI } from '../lib/api';
import { toast } from 'sonner';
import { Header } from './Header';
import { CheckCircle2, Circle, ChevronRight, Trophy, XCircle } from 'lucide-react';

interface Question {
  id: string;
  order: number;
  english: string;
  correctAnswer: string;
  options: string[];
  vocabularyId: string;
}

interface Quiz {
  id: string;
  collectionId: string;
  title: string;
  questions: Question[];
}

export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ score: number; correctCount: number; totalQuestions: number } | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (id) {
      loadQuiz();
    }
  }, [user, id, navigate]);

  const loadQuiz = async () => {
    if (!id) return;

    try {
      const data = await quizzesAPI.getById(id);
      setQuiz(data.quiz);
    } catch (error: any) {
      console.error('Load quiz error:', error);
      toast.error('Không thể tải quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleNext = () => {
    if (quiz && currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz || !id) return;

    // Check if all questions are answered
    const unanswered = quiz.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      if (!confirm(`Còn ${unanswered.length} câu chưa trả lời. Bạn có muốn nộp bài?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      // Calculate score
      let correctCount = 0;
      const detailedAnswers = quiz.questions.map(q => {
        const isCorrect = answers[q.id] === q.correctAnswer;
        if (isCorrect) correctCount++;
        return {
          questionId: q.id,
          english: q.english,
          correctAnswer: q.correctAnswer,
          userAnswer: answers[q.id] || '',
          isCorrect,
        };
      });

      const score = Math.round((correctCount / quiz.questions.length) * 100);

      await attemptsAPI.save(id, detailedAnswers, score, quiz.questions.length);
      
      // Show results modal instead of navigating
      setResults({
        score,
        correctCount,
        totalQuestions: quiz.questions.length,
      });
      setShowResults(true);
    } catch (error: any) {
      console.error('Submit quiz error:', error);
      toast.error(error.message || 'Nộp bài thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseResults = () => {
    if (quiz) {
      navigate(`/collections/${quiz.collectionId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Đang tải quiz...</div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Không tìm thấy quiz</div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Câu {currentQuestion + 1}/{quiz.questions.length}</span>
            <span>•</span>
            <span>{Object.keys(answers).length}/{quiz.questions.length} đã trả lời</span>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="mb-8">
            <div className="text-sm text-gray-500 mb-2">Dịch từ tiếng Anh sang tiếng Việt:</div>
            <h2 className="text-3xl font-bold text-gray-900">{question.english}</h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option, index) => {
              const isSelected = answers[question.id] === option;
              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(question.id, option)}
                  className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{option}</span>
                    {isSelected ? (
                      <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Navigation */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {quiz.questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                  index === currentQuestion
                    ? 'bg-blue-600 text-white'
                    : answers[q.id]
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Câu trước
          </button>

          {currentQuestion < quiz.questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Câu tiếp theo
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Đang nộp bài...' : 'Nộp bài'}
            </button>
          )}
        </div>
      </main>

      {/* Results Modal */}
      {showResults && results && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${ 
                results.score >= 80 ? 'bg-green-100' : results.score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                {results.score >= 60 ? (
                  <Trophy className={`w-10 h-10 ${
                    results.score >= 80 ? 'text-green-600' : 'text-yellow-600'
                  }`} />
                ) : (
                  <XCircle className="w-10 h-10 text-red-600" />
                )}
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {results.score >= 90 ? 'Xuất sắc! 🎉' : 
                 results.score >= 80 ? 'Rất tốt! 👏' : 
                 results.score >= 70 ? 'Khá tốt! 👍' : 
                 results.score >= 60 ? 'Tạm được! 💪' : 
                 'Cần cố gắng thêm! 📚'}
              </h2>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Điểm số</span>
                  <span className={`text-3xl font-bold ${
                    results.score >= 80 ? 'text-green-600' : 
                    results.score >= 60 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {results.score}%
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Câu đúng</span>
                  <span className="text-2xl font-bold text-green-600">
                    {results.correctCount}/{results.totalQuestions}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Câu sai</span>
                  <span className="text-2xl font-bold text-red-600">
                    {results.totalQuestions - results.correctCount}/{results.totalQuestions}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCloseResults}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-lg"
            >
              Đồng ý
            </button>
          </div>
        </div>
      )}
    </div>
  );
}