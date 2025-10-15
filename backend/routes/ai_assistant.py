import google.generativeai as genai
import os
from datetime import datetime
import json

genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

model = genai.GenerativeModel('gemini-2.5-flash')
vision_model = genai.GenerativeModel('gemini-2.5-flash')

active_chats = {}


def get_or_create_chat(user_id, chat_id=None):
    if chat_id and chat_id in active_chats:
        return active_chats[chat_id]

    new_chat_id = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    active_chats[new_chat_id] = {
        'chat_id': new_chat_id,
        'user_id': user_id,
        'created_at': datetime.now().isoformat(),
        'messages': [],
        'model_chat': model.start_chat(history=[])
    }

    save_chat_to_file(new_chat_id)

    return active_chats[new_chat_id]


def save_chat_to_file(chat_id):
    if chat_id not in active_chats:
        return

    chat_data = active_chats[chat_id].copy()
    chat_data.pop('model_chat', None)

    os.makedirs('data/chats', exist_ok=True)
    file_path = f'data/chats/{chat_id}.json'

    with open(file_path, 'w') as f:
        json.dump(chat_data, f, indent=2)


def load_chat_from_file(chat_id):
    file_path = f'data/chats/{chat_id}.json'

    if not os.path.exists(file_path):
        return None

    with open(file_path, 'r') as f:
        chat_data = json.load(f)

    history = []
    for msg in chat_data['messages']:
        if msg['role'] == 'user':
            history.append({'role': 'user', 'parts': [msg['content']]})
        else:
            history.append({'role': 'model', 'parts': [msg['content']]})

    chat_data['model_chat'] = model.start_chat(history=history)
    active_chats[chat_id] = chat_data

    return chat_data


def send_message(chat_id, user_message, image_data=None):
    if chat_id not in active_chats:
        load_chat_from_file(chat_id)

    if chat_id not in active_chats:
        return None, "Chat not found"

    chat = active_chats[chat_id]

    try:
        chat['messages'].append({
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.now().isoformat(),
            'has_image': image_data is not None
        })

        if image_data:
            import base64
            from PIL import Image
            import io

            image_bytes = base64.b64decode(image_data.split(',')[1])
            image = Image.open(io.BytesIO(image_bytes))

            response = vision_model.generate_content([user_message, image])
            ai_response = response.text
        else:
            response = chat['model_chat'].send_message(user_message)
            ai_response = response.text

        chat['messages'].append({
            'role': 'assistant',
            'content': ai_response,
            'timestamp': datetime.now().isoformat()
        })

        save_chat_to_file(chat_id)

        return ai_response, None

    except Exception as e:
        return None, str(e)


def get_all_chats(user_id):
    import glob

    chats = []
    chat_files = glob.glob('data/chats/*.json')

    for file_path in chat_files:
        with open(file_path, 'r') as f:
            chat_data = json.load(f)
            if chat_data['user_id'] == user_id:
                chat_preview = {
                    'chat_id': chat_data['chat_id'],
                    'created_at': chat_data['created_at'],
                    'message_count': len(chat_data['messages']),
                    'last_message': chat_data['messages'][-1]['content'][:50] + '...' if chat_data['messages'] else ''
                }
                chats.append(chat_preview)

    chats.sort(key=lambda x: x['created_at'], reverse=True)

    return chats


def delete_chat(chat_id):
    file_path = f'data/chats/{chat_id}.json'

    if os.path.exists(file_path):
        os.remove(file_path)

    if chat_id in active_chats:
        del active_chats[chat_id]

    return True