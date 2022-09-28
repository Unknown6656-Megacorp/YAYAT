import os.path as osp
from typing import Callable

from flask import Flask, request, send_from_directory, render_template, redirect, abort
from __main__ import app, STATIC_DIR, USER_DIR, __file__ as mainfile
from server_api import get_logged_in_name, USER_FILE
from projects import *

app : Flask
STATIC_DIR : str
get_logged_in_name : Callable[[], str | None]


# TODO : caching


@app.errorhandler(403)
def route_403(error, **context):
    context['error'] = error
    context['url'] = request.url
    context['title'] = 'Forbidden'
    return render_template('403.html', **context), 403

@app.errorhandler(404)
def route_404(error, **context):
    context['error'] = error
    context['url'] = request.url
    context['title'] = 'URL Not Found'
    return render_template('404.html', **context), 404

@app.route('/')
def route_root():
    return redirect('/yayat/')

@app.route(f'/favicon.ico')
def route_favicon():
    return route_static('favicon.ico')

@app.route(f'/static/<path:path>')
@app.route(f'/static/templates/<path:path>')
@app.route(f'/yayat/static/<path:path>')
def route_direct_static(path : str = ''):
    return abort(403)

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

@app.route(f'/yayat/')
def route_index():
    if (uname := get_logged_in_name()) is None:
        return redirect('/yayat/login/')
    else:
        return redirect('/yayat/projects/')

@app.route(f'/yayat/login/')
def route_login():
    return render_template('login.html',
        userfile = osp.normpath(osp.join(USER_DIR, USER_FILE)),
        mainfile = osp.normpath(mainfile),
        title = 'Login'
    )

@app.route(f'/yayat/projects/')
def route_all_projects():
    if (uname := get_logged_in_name()) is None:
        return redirect('/yayat/login/', redirect = request.full_path)
    else:
        return render_template('projects.html', uname = uname, title = 'Projects')

@app.route(f'/yayat/projects/<int:project>/')
def route_projects(project : int):
    if (uname := get_logged_in_name()) is None:
        return abort(403)
    elif (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    else:
        return render_template(
            'project-overview.html',
            uname = uname,
            project = proj,
            title = proj.name
        )

@app.route(f'/yayat/projects/<int:project>/tasks/')
def route_projects_tasks(project : int):
    if (uname := get_logged_in_name()) is None:
        return abort(403)
    elif (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    else:
        return render_template(
            'tasks.html',
            uname = uname,
            project = proj,
            tasks = [t.to_jsonobj() for t in proj.get_tasks()],
            title = f'{proj.name} | Tasks'
        )

@app.route(f'/yayat/tasks/')
def route_all_tasks():
    if (uname := get_logged_in_name()) is None:
        return redirect('/yayat/login/', redirect = request.full_path)
    else:
        return render_template(
            'tasks.html',
            uname = uname,
            tasks = [
                t.to_jsonobj()
                for p in Project.get_existing_projects()
                for t in p.get_tasks()
            ],
            title = 'Tasks'
        )
