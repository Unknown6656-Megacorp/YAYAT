from datetime import datetime, timezone
import os
import os.path as osp
import argparse

from flask import Flask, request, send_from_directory


CURRENT_DIR = osp.dirname(__file__)
STATIC_DIR = osp.join(CURRENT_DIR, 'static')
USER_DIR = osp.join(CURRENT_DIR, 'userdata')
PROJECTS_DIR = osp.join(USER_DIR, 'projects')
_DEBUG_ = True

os.chdir(CURRENT_DIR)

if not osp.isdir(USER_DIR): os.mkdir(USER_DIR)
if not osp.isdir(PROJECTS_DIR): os.mkdir(PROJECTS_DIR)

if not osp.isfile(gitignore := osp.join(USER_DIR, '.gitignore')):
    with open(gitignore, 'w') as f:
        f.write('*')



def parse_utc(utc : str) -> datetime:
    return datetime.strptime(utc, "%Y-%m-%dT%H-%M-%S.%fZ")

def print_utc(utc : datetime) -> str:
    return utc.strftime('%Y-%m-%dT%H-%M-%S.%f')[:-3] + 'Z'

def print_utcnow() -> str: return print_utc(datetime.utcnow())

def utc_from_unix(unix : float) -> datetime: return datetime.fromtimestamp(unix, tz = timezone.utc)


app = Flask(
    __name__,
    static_folder = 'static',
    template_folder = 'static/templates'
)

import server_api
import server_static

if _DEBUG_:
    @app.after_request
    def add_header(r):
        r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        r.headers["Pragma"] = "no-cache"
        r.headers["Expires"] = "0"
        r.headers['Cache-Control'] = 'public, max-age=0'
        return r



parser = argparse.ArgumentParser()
parser.add_argument('--port', '-p', type = str, default = '42420', help = 'The listening port.')
parser.add_argument('--hostname', '-n', type = str, default = '0.0.0.0', help = 'The host name.')
parser.add_argument('--debug', '-d', type = bool, default = _DEBUG_, help = 'Runs the server in debug mode.')
args = parser.parse_args()

app.config['TEMPLATES_AUTO_RELOAD'] = _DEBUG_
app.run(
    host = args.hostname,
    port = int(args.port),
    debug = bool(args.debug),
    use_reloader = False
)
