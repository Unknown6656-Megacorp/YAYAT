import os.path as osp
from typing import Callable

from flask import Flask, Response, request, send_from_directory, render_template, redirect, abort
from __main__ import app, STATIC_DIR, USER_DIR
from server_api import get_logged_in_user, USER_FILE, USER_INFOS, COOKIE_API_TOKEN, COOKIE_USER_NAME
from projects import *

app : Flask
STATIC_DIR : str


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
    return route_static('img/favicon.ico')


@app.route('/service-worker.js')
def route_service_worker():
    return route_js('service-worker.js')


@app.route(f'/static/<path:path>')
@app.route(f'/static/templates/<path:path>')
@app.route(f'/yayat/static/<path:path>')
def route_direct_static(path : str = ''):
    return abort(403)


@app.route(f'/offline')
def route_offline():
    return render_template('offline.html', title = 'You are offline')


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
    if get_logged_in_user() is None:
        return redirect('/yayat/login/')
    else:
        return redirect('/yayat/projects/')


@app.route(f'/yayat/login/')
def route_login():
    return render_template('login.html',
        userfile = osp.normpath(osp.join(USER_DIR, USER_FILE)),
        title = 'Login'
    )


# don't look too hard at this clusterfuck of a signature, just use it as a decorator for a function with the signature
#   (user : UserInfo, ...) -> Response
def secure_site(route : str) -> Callable[[Callable[[UserInfo, dict], Response]], Callable[[dict], Response]]:
    def _decorated(callback : Callable[[UserInfo, dict], Response]) -> Callable[[dict], Response]:
        @app.route(route, endpoint = callback.__name__, methods = ['GET'])
        def _inner(**kwargs):
            if (user := get_logged_in_user()) is None:
                response = redirect('/yayat/login/', redirect = request.full_path)
                response.delete_cookie(COOKIE_API_TOKEN)
                response.delete_cookie(COOKIE_USER_NAME)

                return response
            else:
                user.date = datetime.utcnow()

                return callback(user = user, **kwargs)
        return _inner
    return _decorated


@secure_site(f'/yayat/projects/')
def route_all_projects(user : UserInfo):
    return render_template(
        'projects.html',
        user = user,
        title = 'All Projects'
    )


@secure_site(f'/yayat/projects/<int:project>/')
def route_projects(user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    else:
        return render_template(
            'project-overview.html',
            user = user,
            project = proj,
            title = proj.name
        )


@secure_site(f'/yayat/projects/<int:project>/new-task/')
def route_projects_new_task(user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    else:
        return render_template(
            'task-create.html',
            user = user,
            project = proj,
            title = 'New Task'
        )


@secure_site(f'/yayat/tasks/')
def route_all_tasks(user : UserInfo):
    return render_template(
        'tasks.html',
        user = user,
        title = 'All Tasks',
        tasks = [t for p in Project.get_existing_projects() for t in p.get_tasks()],
    )


@secure_site(f'/yayat/projects/<int:project>/tasks/')
def route_projects_tasks(user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    else:
        return render_template(
            'tasks.html',
            user = user,
            project = proj,
            title = f'{proj.name} | Tasks',
            tasks = proj.get_tasks()
        )


@secure_site(f'/yayat/projects/<int:project>/tasks/<int:task>/')
def route_projects_task_overview(user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    elif (t := proj.get_task(task)) is None:
        return abort(404)
    else:
        return render_template(
            'task-overview.html',
            user = user,
            project = proj,
            task = t,
            title = f'{t.name}'
        )


@secure_site(f'/yayat/projects/<int:project>/tasks/<int:task>/annotate')
def route_projects_task_annotate(user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    elif (t := proj.get_task(task)) is None:
        return abort(404)
    else:
        return render_template(
            'task-annotate.html',
            user = user,
            project = proj,
            task = t,
            title = f'{t.name}'
        )


@secure_site(f'/yayat/projects/<int:project>/tasks/<int:task>/upload')
def route_projects_task_upload(user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    elif (t := proj.get_task(task)) is None:
        return abort(404)
    else:
        return render_template(
            'task-upload.html',
            user = user,
            project = proj,
            task = t,
            title = f'{t.name}'
        )


@secure_site(f'/yayat/projects/<int:project>/tasks/<int:task>/export')
def route_projects_task_export(user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    elif (t := proj.get_task(task)) is None:
        return abort(404)
    else:
        return render_template(
            'task-export.html',
            user = user,
            project = proj,
            task = t,
            title = f'{t.name} | Export'
        )


@secure_site(f'/yayat/projects/<int:project>/tasks/<int:task>/edit')
def route_projects_task_edit(user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return abort(404)
    elif (t := proj.get_task(task)) is None:
        return abort(404)
    else:
        return render_template(
            'task-edit.html',
            user = user,
            project = proj,
            task = t,
            title = f'{t.name} | Edit'
        )
