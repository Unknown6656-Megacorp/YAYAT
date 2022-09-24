from flask import Flask, request, send_from_directory
import argparse
import sys
import os
import os.path as osp


CURRENT_DIR = osp.dirname(__file__)
STATIC_DIR = osp.join(CURRENT_DIR, 'static')
USER_DIR = osp.join(CURRENT_DIR, 'userdata')

os.chdir(CURRENT_DIR)

if not osp.isdir(USER_DIR):
    os.mkdir(USER_DIR)


app = Flask(__name__)

import server_static
import server_api



parser = argparse.ArgumentParser()
parser.add_argument('--port', '-p', type = str, default = '42420', help = 'The listening port.')
parser.add_argument('--hostname', '-n', type = str, default = '0.0.0.0', help = 'The host name.')
parser.add_argument('--debug', '-d', type = bool, default = True, help = 'Runs the server in debug mode.')
args = parser.parse_args()


app.run(args.hostname, int(args.port), bool(args.debug), use_reloader = False)
