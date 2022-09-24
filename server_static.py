from genericpath import isfile
import os
import os.path as osp

from flask import Flask, request, send_from_directory
from __main__ import app, STATIC_DIR


# TODO : caching

@app.route(f'/yayat/<path:path>')
def route_static(path : str = ''):
    file = osp.join(STATIC_DIR, path)
    if not osp.isfile(file) and osp.isfile(file + '.html'):
        path += '.html'

    return send_from_directory('static', path)

@app.route(f'/js/<path:path>')
def route_js(path : str = ''):
    return route_static('js/' + path)

@app.route(f'/img/<path:path>')
def route_img(path : str = ''):
    return route_static('img/' + path)

@app.route(f'/css/<path:path>')
def route_css(path : str = ''):
    return route_static('css/' + path)

@app.route(f'/font/<path:path>')
def route_font(path : str = ''):
    return route_static('font/' + path)

# @app.route(f'/yayat/login')
# def route_login():
#     return route_static('login.html')

@app.route(f'/yayat/')
def route_index():
    return route_static('index.html')

@app.route(f'/favicon.ico')
def route_favicon():
    return route_static('favicon.ico')

@app.route('/')
def route_root():
    return route_static('redirect.html')
