from datetime import datetime
from dataclasses import dataclass
from typing import Any, Callable

import os
import os.path as osp
import hashlib
import random
import string

from flask import Flask, request, send_from_directory, jsonify, Response

from __main__ import app, USER_DIR


@dataclass
class UserToken:
    token : str
    date : datetime


USER_FILE = 'users.txt'
USER_TIMEOUT = 15 * 60 # 15 minutes
USER_TOKENS : dict[str, UserToken] = { }
USERS = { }

COOKIE_API_TOKEN = '__cookie_api_token'
COOKIE_USER_NAME = '__cookie_api_uname'


if osp.isfile(osp.join(USER_DIR, USER_FILE)):
    try:
        with open(osp.join(USER_DIR, USER_FILE), 'r') as f:
            for line in f.readlines():
                line = line.split(':')
                USERS[line[0]] = ':'.join(line[1:]) if len(line) > 1 else ''
    except:
        pass


def sha512(string : str) -> str:
    return hashlib.sha512(string.encode('utf-8')).hexdigest()

def compute_hash(uname : str, passwd : str) -> str:
    return sha512(sha512(uname + passwd) + uname)

def generate_random_string(length : int) -> str:
    return ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(length))

def get_current_utc() -> str:
    return datetime.utcnow().strftime('%Y-%m-%dT%H-%M-%S.%f')[:-3] + 'Z'

def json_ok(obj : dict) -> Response:
    return jsonify({
        'date': get_current_utc(),
        'response': obj,
        'error': None
    })

def json_error(error : str, code : int = 400) -> Response:
    resp = jsonify({
        'date': get_current_utc(),
        'response': None,
        'error': error,
    })
    resp.status_code = code
    resp.status = code
    return resp

# don't look too hard at this clusterfuck of a signature, just use it as a decorator.
def secure_api(route : str) -> Callable[[Callable[[str, dict[str, Any]], Response]], Callable[[dict[str, Any]], Response]]:
    def _decorated(callback : Callable[[str, dict[str, Any]], Response]) -> Callable[[dict[str, Any]], Response]:
        @app.route(route)
        def _inner(**kwargs):
            uname = request.cookies[COOKIE_USER_NAME] if COOKIE_USER_NAME in request.cookies else ''
            token = request.cookies[COOKIE_API_TOKEN] if COOKIE_API_TOKEN in request.cookies else ''
            response : Response = json_error('You are not authorized to perform this action.', 403)
            response.delete_cookie(COOKIE_API_TOKEN)
            response.delete_cookie(COOKIE_USER_NAME)

            if uname in USER_TOKENS:
                entry = USER_TOKENS[uname]

                if entry.token == token and (datetime.utcnow() - entry.date).total_seconds() <= USER_TIMEOUT:
                    entry.date = datetime.utcnow()
                    USER_TOKENS[uname] = entry
                    response = callback(uname, **kwargs)

            return response
        return _inner
    return _decorated


@app.route('/api/login')
def api_login():
    uname = request.args.get('uname', '')
    if uname in USERS:
        passwd_hash = request.args.get('phash', '')
        expected_hash = compute_hash(uname, USERS[uname])
        if passwd_hash == expected_hash:
            token = UserToken(generate_random_string(256), datetime.utcnow())
            USER_TOKENS[uname] = token
            resp = json_ok({ })
            resp.set_cookie(COOKIE_API_TOKEN, token.token, int(USER_TIMEOUT))
            resp.set_cookie(COOKIE_USER_NAME, uname, int(USER_TIMEOUT))

            return resp

    return json_error('Invalid login credentials.', 403)

@secure_api('/api/logout')
def api_logout(uname : str):
    USER_TOKENS.pop(uname, None)
    response = json_ok({})
    response.delete_cookie(COOKIE_API_TOKEN)
    response.delete_cookie(COOKIE_USER_NAME)
    return response

@secure_api('/api/project/create')
def api_project_create(uname : str):
    pass

@secure_api('/api/project/<int:project>/info')
def api_project_info(uname : str, project : int):
    pass

@secure_api('/api/project/<int:project>/labels/create')
def api_project_labels_create(uname : str, project : int):
    pass

@secure_api('/api/project/<int:project>/labels/<int:label>/change')
def api_project_labels_change(uname : str, project : int, label : int):
    pass

@secure_api('/api/project/<int:project>/labels/<int:label>/delete')
def api_project_labels_delete(uname : str, project : int, label : int):
    pass

@secure_api('/api/project/<int:project>/tasks/create')
def api_project_tasks_create(uname : str, project : int):
    pass

@secure_api('/api/project/<int:project>/tasks/<int:task>/info')
def api_project_tasks_info(uname : str, project : int, task : int):
    pass

@secure_api('/api/project/<int:project>/tasks/<int:task>/delete')
def api_project_tasks_delete(uname : str, project : int, task : int):
    pass

@secure_api('/api/project/<int:project>/tasks/<int:task>/upload_data')
def api_project_tasks_upload_data(uname : str, project : int, task : int):
    pass


# TODO : API
#   - create project
#   - get project info
#   - get task info
#   - upload images
#   - upload annotations
#   - download images/annotations
#   - fetch image/labels n in task x / project y
#   - update annotation for image n in task x / project y
