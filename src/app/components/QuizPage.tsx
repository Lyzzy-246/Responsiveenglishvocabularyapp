import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { quizzesAPI, attemptsAPI, vocabularyAPI } from '../lib/api';
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

interface DetailedAnswer {
  questionId: string;
  order: number;
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  vocabularyId: string;
  vocabEnglish?: string;
  vocabVietnamese?: string;
  vocabExample?: string;
}

export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [baseQuiz, setBaseQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [vocabById, setVocabById] = useState<Record<string, { english: string; vietnamese: string; example?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ score: number; correctCount: number; totalQuestions: number } | null>(null);
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedAnswer[]>([]);
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
      setBaseQuiz(data.quiz);
      try {
        const vocabData = await vocabularyAPI.getByCollection(data.quiz.collectionId);
        const map: Record<string, { english: string; vietnamese: string; example?: string }> = {};
        for (const v of vocabData.vocabulary || []) {
          if (!v?.id) continue;
          map[v.id] = { english: v.english, vietnamese: v.vietnamese, example: v.example };
        }
        setVocabById(map);
      } catch {}
    } catch (error: any) {
      console.error('Load quiz error:', error);
      toast.error('Không thể tải quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    if (answers[questionId]) return;
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

  const resetRunState = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setDetailedAnswers([]);
    setResults(null);
    setShowResults(false);
    setSubmitting(false);
  };

  const handleRedoWrong = () => {
    const wrong = detailedAnswers.filter(a => !a.isCorrect);
    if (wrong.length === 0) {
      toast.info('Không có câu sai để làm lại');
      return;
    }

    const wrongIds = new Set(wrong.map(a => a.questionId));
    const source = baseQuiz || quiz;
    if (!source) return;

    const nextQuestions = source.questions.filter(q => wrongIds.has(q.id));
    if (nextQuestions.length === 0) {
      toast.info('Không có câu sai để làm lại');
      return;
    }

    setQuiz({
      ...source,
      title: `${source.title} (Làm lại câu sai)`,
      questions: nextQuestions,
    });
    resetRunState();
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
      const detailed = quiz.questions.map(q => {
        const isCorrect = answers[q.id] === q.correctAnswer;
        if (isCorrect) correctCount++;
        const v = vocabById[q.vocabularyId];
        return {
          questionId: q.id,
          order: q.order,
          prompt: q.english,
          correctAnswer: q.correctAnswer,
          userAnswer: answers[q.id] || '',
          isCorrect,
          vocabularyId: q.vocabularyId,
          vocabEnglish: v?.english,
          vocabVietnamese: v?.vietnamese,
          vocabExample: v?.example,
        };
      });

      const score = Math.round((correctCount / quiz.questions.length) * 100);

      await attemptsAPI.save(id, detailed, score, quiz.questions.length);
      setDetailedAnswers(detailed);
      
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
  const selectedAnswer = answers[question.id] || '';
  const isAnswered = Boolean(selectedAnswer);
  const isCorrect = isAnswered && selectedAnswer === question.correctAnswer;
  const vocab = vocabById[question.vocabularyId];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const wrongCount = detailedAnswers.filter(a => !a.isCorrect).length;

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
            <div className="text-sm text-gray-500 mb-2">Chọn đáp án đúng:</div>
            <h2 className="text-3xl font-bold text-gray-900">{question.english}</h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === question.correctAnswer;
              const showFeedback = isAnswered;
              const isWrongSelected = showFeedback && isSelected && !isCorrectOption;
              const isRight = showFeedback && isCorrectOption;
              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(question.id, option)}
                  disabled={isAnswered}
                  className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all disabled:cursor-not-allowed ${
                    !showFeedback && isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : showFeedback && isRight
                      ? 'border-green-600 bg-green-50'
                      : showFeedback && isWrongSelected
                      ? 'border-red-600 bg-red-50'
                      : showFeedback
                      ? 'border-gray-200 bg-white opacity-75'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{option}</span>
                    {showFeedback ? (
                      isRight ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : isWrongSelected ? (
                        <XCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )
                    ) : isSelected ? (
                      <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className={`mt-6 rounded-xl border p-5 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={`text-lg font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {isCorrect ? 'Đúng rồi' : 'Sai rồi'}
                  </div>
                  {!isCorrect && (
                    <div className="text-sm text-red-700 mt-1">
                      Bạn chọn: <span className="font-semibold">{selectedAnswer}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-800 mt-1">
                    Đáp án đúng: <span className="font-semibold">{question.correctAnswer}</span>
                  </div>
                </div>
                {isCorrect ? (
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-7 h-7 text-red-600 shrink-0" />
                )}
              </div>

              <div className="mt-4 bg-white/70 rounded-lg p-4 border border-black/5">
                <div className="text-sm font-semibold text-gray-700 mb-2">Thông tin từ vựng</div>
                <div className="text-sm text-gray-900">
                  <div>
                    <span className="text-gray-600">English:</span>{' '}
                    <span className="font-semibold">{vocab?.english || '—'}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-gray-600">Tiếng Việt:</span>{' '}
                    <span className="font-semibold">{vocab?.vietnamese || '—'}</span>
                  </div>
                  {vocab?.example ? (
                    <div className="mt-1">
                      <span className="text-gray-600">Ví dụ:</span> <span>{vocab.example}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
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
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 sm:p-8 overflow-y-auto">
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

              <div className="mb-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">Danh sách câu trả lời</h3>
                  <span className="text-sm text-gray-500">{detailedAnswers.length} câu</span>
                </div>
                <div className="space-y-3 pr-1">
                  {[...detailedAnswers].sort((a, b) => a.order - b.order).map((a, idx) => (
                    <div
                      key={a.questionId}
                      className={`border rounded-lg p-3 ${a.isCorrect ? 'border-green-100 bg-green-50/40' : 'border-red-100 bg-red-50/40'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold text-gray-900">{idx + 1}. {a.prompt}</div>
                        {a.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                      </div>
                      <div className="mt-2 text-sm">
                        {a.userAnswer ? (
                          <div className="flex gap-2">
                            <span className="text-gray-600">Bạn đã chọn:</span>
                            <span className={a.isCorrect ? 'text-green-700 font-medium' : 'text-red-700'}>{a.userAnswer}</span>
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">Bạn chưa trả lời câu này</div>
                        )}
                        <div className="flex gap-2">
                          <span className="text-gray-600">Đáp án đúng:</span>
                          <span className="font-medium text-gray-900">{a.correctAnswer}</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-700 bg-white/60 border border-black/5 rounded-md p-2">
                          <div><span className="text-gray-500">English:</span> <span className="font-semibold">{a.vocabEnglish || '—'}</span></div>
                          <div className="mt-1"><span className="text-gray-500">Tiếng Việt:</span> <span className="font-semibold">{a.vocabVietnamese || '—'}</span></div>
                          {a.vocabExample ? <div className="mt-1"><span className="text-gray-500">Ví dụ:</span> <span>{a.vocabExample}</span></div> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 bg-white">
              <div className="flex flex-col sm:flex-row gap-3">
                {wrongCount > 0 ? (
                  <button
                    onClick={handleRedoWrong}
                    className="flex-1 px-6 py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors text-lg"
                  >
                    Làm lại câu sai ({wrongCount})
                  </button>
                ) : null}
                <button
                  onClick={handleCloseResults}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-lg"
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
