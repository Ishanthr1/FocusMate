import google.generativeai as genai
import os
import json
from datetime import datetime

genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-2.5-flash')

quiz_history = {}

def generate_quiz(user_id, topic, question_count, quiz_type, difficulty, time_limit, document_text=None):
    prompt = f"""Generate a {difficulty} difficulty quiz on the topic: {topic}

Quiz Requirements:
- Number of questions: {question_count}
- Question type: {quiz_type}

"""

    if document_text:
        prompt += f"\nBase the questions on this document content:\n{document_text}\n\n"

    if quiz_type == "Multiple Choice":
        prompt += """Format each question as JSON with this structure:
{
  "question": "question text here",
  "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"],
  "correct_answer": "A",
  "explanation": "brief explanation of the correct answer"
}

Return ONLY a JSON array of questions, nothing else."""

    elif quiz_type == "True/False":
        prompt += """Format each question as JSON with this structure:
{
  "question": "question statement here",
  "options": ["True", "False"],
  "correct_answer": "True" or "False",
  "explanation": "brief explanation"
}

Return ONLY a JSON array of questions, nothing else."""

    elif quiz_type == "Short Answer":
        prompt += """Format each question as JSON with this structure:
{
  "question": "question text here",
  "correct_answer": "expected answer (can be flexible)",
  "explanation": "detailed explanation of the answer"
}

Return ONLY a JSON array of questions, nothing else."""

    elif quiz_type == "Fill in the Blank":
        prompt += """Format each question as JSON with this structure:
{
  "question": "The capital of France is _____.",
  "correct_answer": "Paris",
  "explanation": "brief explanation"
}

Return ONLY a JSON array of questions, nothing else."""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        questions = json.loads(response_text)

        quiz_id = f"quiz_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        quiz_data = {
            'quiz_id': quiz_id,
            'user_id': user_id,
            'topic': topic,
            'quiz_type': quiz_type,
            'difficulty': difficulty,
            'question_count': question_count,
            'time_limit': time_limit,
            'questions': questions,
            'created_at': datetime.now().isoformat()
        }

        quiz_history[quiz_id] = quiz_data

        save_quiz_to_file(quiz_data)

        return quiz_data, None

    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        print(f"Response text: {response_text}")
        return None, "Failed to parse quiz format. Please try again."
    except Exception as e:
        print(f"Error generating quiz: {e}")
        return None, str(e)


def save_quiz_to_file(quiz_data):
    os.makedirs('data/quizzes', exist_ok=True)
    file_path = f"data/quizzes/{quiz_data['quiz_id']}.json"

    with open(file_path, 'w') as f:
        json.dump(quiz_data, f, indent=2)


def save_quiz_result(quiz_id, user_answers, score, time_taken):
    if quiz_id not in quiz_history:
        try:
            with open(f'data/quizzes/{quiz_id}.json', 'r') as f:
                quiz_history[quiz_id] = json.load(f)
        except:
            return None, "Quiz not found"

    quiz_data = quiz_history[quiz_id]

    results = {
        'quiz_id': quiz_id,
        'user_answers': user_answers,
        'score': score,
        'time_taken': time_taken,
        'completed_at': datetime.now().isoformat(),
        'total_questions': len(quiz_data['questions']),
        'percentage': round((score / len(quiz_data['questions'])) * 100, 1)
    }

    if 'results' not in quiz_data:
        quiz_data['results'] = []
    quiz_data['results'].append(results)

    save_quiz_to_file(quiz_data)

    return results, None


def get_user_quizzes(user_id):
    import glob

    quizzes = []
    quiz_files = glob.glob('data/quizzes/*.json')

    for file_path in quiz_files:
        try:
            with open(file_path, 'r') as f:
                quiz_data = json.load(f)
                if quiz_data['user_id'] == user_id:
                    summary = {
                        'quiz_id': quiz_data['quiz_id'],
                        'topic': quiz_data['topic'],
                        'quiz_type': quiz_data['quiz_type'],
                        'question_count': quiz_data['question_count'],
                        'created_at': quiz_data['created_at'],
                        'completed': 'results' in quiz_data and len(quiz_data['results']) > 0
                    }

                    if summary['completed']:
                        last_result = quiz_data['results'][-1]
                        summary['last_score'] = last_result['percentage']

                    quizzes.append(summary)
        except:
            continue

    quizzes.sort(key=lambda x: x['created_at'], reverse=True)

    return quizzes
