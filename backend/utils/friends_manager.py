import json
import os
from datetime import datetime


def save_friend_request(request_data):
    os.makedirs('data/friend_requests', exist_ok=True)
    file_path = f"data/friend_requests/{request_data['id']}.json"

    with open(file_path, 'w') as f:
        json.dump(request_data, f, indent=2)


def load_all_friend_requests():
    import glob
    requests = {}

    if not os.path.exists('data/friend_requests'):
        return requests

    for file_path in glob.glob('data/friend_requests/*.json'):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                requests[data['id']] = data
        except:
            continue

    return requests


def save_friendship(friendship_data):
    os.makedirs('data/friendships', exist_ok=True)
    file_path = f"data/friendships/{friendship_data['id']}.json"

    with open(file_path, 'w') as f:
        json.dump(friendship_data, f, indent=2)


def load_all_friendships():
    import glob
    friendships = {}

    if not os.path.exists('data/friendships'):
        return friendships

    for file_path in glob.glob('data/friendships/*.json'):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                friendships[data['id']] = data
        except:
            continue

    return friendships


def get_user_by_email(email):
    import glob

    for file_path in glob.glob('data/sessions/*.json'):
        try:
            with open(file_path, 'r') as f:
                session = json.load(f)
                if session.get('user_email') == email:
                    return session.get('user_id')
        except:
            continue

    return None