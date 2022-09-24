from datetime import datetime
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



app = Flask(__name__)

import server_static
import server_api



parser = argparse.ArgumentParser()
parser.add_argument('--port', '-p', type = str, default = '42420', help = 'The listening port.')
parser.add_argument('--hostname', '-n', type = str, default = '0.0.0.0', help = 'The host name.')
parser.add_argument('--debug', '-d', type = bool, default = _DEBUG_, help = 'Runs the server in debug mode.')
args = parser.parse_args()


app.run(args.hostname, int(args.port), bool(args.debug), use_reloader = False)
