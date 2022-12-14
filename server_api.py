from dataclasses import dataclass
from typing import Any, Callable
from datetime import datetime
import urllib
import random
import string
import re
import io
import os
import os.path as osp

from flask import Flask, request, jsonify, send_file, send_from_directory, Response
from __main__ import app, print_utcnow, print_utc, parse_utc, utc_from_unix, USER_DIR, _DEBUG_
from users import *
from projects import *

app : Flask
USER_DIR : str
_DEBUG_ : bool

USER_TIMEOUT = 15 * 60 # 15 minutes

COOKIE_API_TOKEN = '__cookie_api_token'
COOKIE_USER_NAME = '__cookie_api_uname'

task_upload_updates : dict[tuple[int, int], list[str]] = { }
task_download_updates : dict[tuple[int, int], list[str]] = { }


def add_task_upload_update(project : int, task : int, message : str) -> None:
    updates = task_upload_updates.get((project, task), [])
    updates.append(message) # TODO : add timestamp
    task_upload_updates[(project, task)] = updates

def add_task_download_update(project : int, task : int, message : str) -> None:
    updates = task_download_updates.get((project, task), [])
    updates.append(message) # TODO : add timestamp
    task_download_updates[(project, task)] = updates

def generate_random_string(length : int) -> str:
    return ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(length))

def json_ok(obj : dict) -> Response:
    return jsonify({
        'date': print_utcnow(),
        'response': obj,
        'error': None
    })

def json_error(error : str, code : int = 400) -> Response:
    resp = jsonify({
        'date': print_utcnow(),
        'response': None,
        'error': error,
        'request_data': request.get_json(silent = True) or dict(request.args) or { },
    })
    resp.status_code = code
    resp.status = code
    return resp


def get_logged_in_user() -> UserInfo | None:
    if _DEBUG_:
        return USER_INFOS[USER_ROOT]
    else:
        uname = request.cookies[COOKIE_USER_NAME] if COOKIE_USER_NAME in request.cookies else ''
        token = request.cookies[COOKIE_API_TOKEN] if COOKIE_API_TOKEN in request.cookies else ''

        if uname in USER_INFOS:
            entry = USER_INFOS[uname]
            if entry.token == token and (datetime.utcnow() - entry.date).total_seconds() <= USER_TIMEOUT:
                return entry
    return None


# don't look too hard at this clusterfuck of a signature, just use it as a decorator for a function with the signature
#   (args : dict, user : UserInfo, ...) -> Response
def secure_api(route : str) -> Callable[[Callable[[dict, UserInfo], Response]], Callable[[dict], Response]]:
    def _decorated(callback : Callable[[dict, UserInfo], Response]) -> Callable[[dict], Response]:
        @app.route(route, endpoint = callback.__name__, methods = ['GET', 'POST'])
        def _inner(**kwargs):
            user = get_logged_in_user()
            response : Response = json_error('You are not authorized to perform this action.', 403)
            response.delete_cookie(COOKIE_API_TOKEN)
            response.delete_cookie(COOKIE_USER_NAME)

            if user is not None:
                user.date = datetime.utcnow()

                if 'user' not in kwargs: kwargs['user'] = user
                if 'args' not in kwargs: kwargs['args'] = request.get_json(silent = True) or request.args or { }

                response = callback(**kwargs)
            return response
        return _inner
    return _decorated


# POST:
#   { uname : str, phash : str }
# Sets login cookies
@app.route('/api/login', methods = ['GET', 'POST'])
def api_login():
    args = request.get_json() or request.args

    if (uname := args.get('uname', '')) in USER_INFOS:
        passwd_hash = args.get('phash', '')

        if passwd_hash == USER_INFOS[uname].hash:
            USER_INFOS[uname].token = generate_random_string(256)
            USER_INFOS[uname].date = datetime.utcnow()
            resp = json_ok({ })
            resp.set_cookie(COOKIE_API_TOKEN, USER_INFOS[uname].token, int(USER_TIMEOUT))
            resp.set_cookie(COOKIE_USER_NAME, uname, int(USER_TIMEOUT))

            return resp
    return json_error('Invalid login credentials.', 403)


# RETURN:
#   { USER_TOKENS }
# Requires to be ROOT_USER
@secure_api('/api/users/')
def api_users(args : dict, user : UserInfo):
    if user.is_root():
        return json_ok([u.to_jsonobj() for u in USER_INFOS.values()])
    else:
        return json_error('You are not the root user.', 403)


# Deletes the login cookies
@secure_api('/api/logout')
def api_logout(args : dict, user : UserInfo):
    USER_INFOS.pop(user.uname, None)
    response = json_ok({})
    response.delete_cookie(COOKIE_API_TOKEN)
    response.delete_cookie(COOKIE_USER_NAME)
    return response


# Returns all project jsons
@secure_api('/api/projects/')
def api_projects(args : dict, user : UserInfo):
    return json_ok([p.to_jsonobj() for p in Project.get_existing_projects()])


# POST:
#   { name : str }
# Returns the newly created project json
@secure_api('/api/projects/create')
def api_projects_create(args : dict, user : UserInfo):
    if (name := request.args.get('name')) is None or any(p for p in Project.get_existing_projects() if p.name == name):
        return json_error('Please provide a non-empty name for the project which has not yet been used.')
    else:
        return json_ok(Project.create_new_project(name, user).to_jsonobj())


# Returns the project json
@secure_api('/api/projects/<int:project>/')
def api_projects_info(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    else:
        return json_ok(proj.to_jsonobj())


@secure_api('/api/projects/<int:project>/delete')
def api_projects_delete(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    else:
        proj.delete_project()
        return json_ok({ })


# POST:
#   { name : str, color : str }
# Returns the label json
@secure_api('/api/projects/<int:project>/labels/create')
def api_projects_labels_create(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (name := args.get('name')) is None:
        return json_error('No name has been provided for the label.')
    elif any(l for l in proj.labels if l.name == name):
        return json_error(f'A label with the name "{name}" does already exist.')
    elif (color := args.get('color')) is None:
        return json_error('No color has been provided for the label.')
    else:
        return json_ok(proj.add_label(name, color).to_jsonobj())


@secure_api('/api/projects/<int:project>/labels/')
def api_projects_labels(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    else:
        return json_ok([l.to_jsonobj() for l in proj.labels])


@secure_api('/api/projects/<int:project>/labels/<int:label>/')
def api_projects_labels_info(args : dict, user : UserInfo, project : int, label : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif len(lbl := [l for l in proj.labels if l.id == label]) != 1:
        return json_error(f'Unknown label id "{label}"')
    else:
        return json_ok(lbl[0].to_jsonobj())


@secure_api('/api/projects/<int:project>/labels/change')
def api_projects_labels_change_all(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (labels := args.get('labels', None)) is None:
        return json_error('No label information has been provided.')
    else:
        try:
            proj.labels = [Label(
                id = int(label['id']),
                name = label['name'],
                order = int(label['order']),
                color = label['color']
            ) for label in labels]
            proj.update_json()

            return json_ok({ })
        except:
            return json_error('Invalid label data')


@secure_api('/api/projects/<int:project>/tasks/')
def api_projects_tasks(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    else:
        return json_ok([t.to_jsonobj() for t in proj.get_tasks()])


@secure_api('/api/tasks/')
@secure_api('/api/projects/tasks/')
def api_all_tasks(args : dict, user : UserInfo):
    return json_ok([
        t.to_jsonobj()
        for p in Project.get_existing_projects()
        for t in p.get_tasks()
    ])


# POST:
#   { name : str }
# Returns the task json
@secure_api('/api/projects/<int:project>/tasks/create')
def api_projects_tasks_create(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (name := args.get('name', None)) is None:
        return json_error('No name has been provided for the task.')
    elif len(name.strip()) < 1:
        return json_error('The task\'s name must not be empty or only consisting of whitespaces.')
    elif any(t for t in proj.get_tasks() if t.name == name):
        return json_error(f'A task with the name "{name}" does already exist.')
    else:
        return json_ok(proj.add_task(name, user).to_jsonobj())


@secure_api('/api/projects/<int:project>/tasks/<int:task>/')
def api_projects_tasks_info(args : dict, user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    else:
        return json_ok(t.to_jsonobj())


@secure_api('/api/projects/<int:project>/tasks/<int:task>/delete')
def api_projects_tasks_delete(args : dict, user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    else:
        t.delete()
        return json_ok({ })


@secure_api('/api/projects/<int:project>/tasks/<int:task>/completed')
def api_projects_tasks_completed(args : dict, user : UserInfo, project : int, task : int):
    pass # TODO


# POST [multipart/form-data]:
#   {
#       <uuid> : [<file>],
#       files : str = json(
#           list[{
#               file : str,
#               uuid : str,
#               type : ['s', 'u', 'w']
#           }]
#       )
#   }
# RETURN:
#   [ Frame ]
@secure_api('/api/projects/<int:project>/tasks/<int:task>/upload')
def api_projects_tasks_upload(args : dict, user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    else:
        try:
            frames : list[Frame] = []
            files = json.loads(request.form.get('files', []))
        except Exception as e:
            return json_error(f'Invalid form submission data: {e}')

        task_upload_updates[(project, task)] = []

        for file in files:
            try:
                bytes = None

                add_task_upload_update(project, task, f'Reading data from "{file["file"]}".')

                match origin := FrameOrigin(file['type']):
                    case FrameOrigin.SERVER:
                        if osp.isfile(file['file']):
                            with open(file['file'], 'rb') as f:
                                bytes = bytearray(f.read())
                        elif osp.isdir(file['file']):
                            add_task_upload_update(project, task, f'Enumerating directory "{file["file"]}".')

                            for subfile in os.listdir(file['file']):
                                files.append({
                                    'file': osp.join(file['file'], subfile),
                                    'type': FrameOrigin.SERVER.value,
                                    'uuid': '00000000-0000-0000-0000-000000000000',
                                })
                    case FrameOrigin.UPLOAD:
                        if (file_obj := request.files.get(file['uuid'], None)) is not None:
                            bytes = bytearray(file_obj.stream.read())
                    case FrameOrigin.WEBURL:
                        req = urllib.request.urlopen(file['file'])
                        bytes = bytearray(req.read())

                images = read_images(
                    bytes,
                    lambda msg: add_task_upload_update(project, task, f'Extracting frames from "{file["file"]}": {msg}')
                )

                for framenum, image in enumerate(images):
                    add_task_upload_update(
                        project,
                        task,
                        f'Creating frame {framenum + 1}/{len(images)} from "{file["file"]}".' if len(images) > 1 else f'Creating frame for "{file["file"]}".'
                    )

                    frame = t.add_frame(image, file['file'], origin)

                    if frame.deleted:
                        t.delete_frame(frame, True)
                    else:
                        frames.append(frame)
            except Exception as e:
                pass # TODO

        with open(t.upload_file, 'w') as f:
            f.writelines(task_upload_updates[(project, task)])

        return json_ok([f.to_jsonobj() for f in frames])


@secure_api('/api/projects/<int:project>/tasks/<int:task>/upload/progress')
def api_projects_tasks_upload_progress(args : dict, user : UserInfo, project : int, task : int):
    return json_ok(task_upload_updates.get((project, task), []))


@secure_api('/api/projects/<int:project>/tasks/<int:task>/download')
def api_projects_tasks_download(args : dict, user : UserInfo, project : int, task : int):
    pass # TODO


@secure_api('/api/projects/<int:project>/tasks/<int:task>/download/progress')
def api_projects_tasks_download_progress(args : dict, user : UserInfo, project : int, task : int):
    return json_ok(task_download_updates.get((project, task), []))


@secure_api('/api/img/<int:project>/<int:task>/<int:frame>')
def api_img(args : dict, user : UserInfo, project : int, task : int, frame : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    elif (f := t.get_frame(frame)) is None:
        return json_error(f'Invalid frame id "{frame}" in project "{project}", task "{task}".')
    else:
        return send_file(t.get_image_path(f))


@secure_api('/api/img/<int:project>/<int:task>/<int:frame>/preview')
def api_img_preview(args : dict, user : UserInfo, project : int, task : int, frame : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    elif (f := t.get_frame(frame)) is None:
        return json_error(f'Invalid frame id "{frame}" in project "{project}", task "{task}".')
    else:
        return send_file(t.get_preview_path(f))


@secure_api('/api/img/<int:project>/<int:task>/preview')
def api_img_task_preview(args : dict, user : UserInfo, project : int, task : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    elif len(t.frames) > 0:
        return send_file(t.get_preview_path(t.frames[0]))
    else:
        return json_error(f'Task "{task}" has no frame.')


@secure_api('/api/img/<int:project>/preview')
def api_img_project_preview(args : dict, user : UserInfo, project : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif len(proj.tasks) == 0:
        return json_error(f'Project "{project}" has no tasks.')
    else:
        task = proj.get_task(proj.tasks[0])

        if len(task.frames) > 0:
            return send_file(task.get_preview_path(task.frames[0]))
        else:
            return json_error(f'Task "{task}" has no frame.')


@secure_api('/api/projects/<int:project>/tasks/<int:task>/frames/<int:frame>')
def api_projects_tasks_frames_info(args : dict, user : UserInfo, project : int, task : int, frame : int):
    pass # TODO


@secure_api('/api/projects/<int:project>/tasks/<int:task>/frames/<int:frame>/annotations')
def api_projects_tasks_frames_annotations(args : dict, user : UserInfo, project : int, task : int, frame : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    elif (f := t.get_frame(frame)) is None:
        return json_error(f'Invalid frame id "{frame}" in project "{project}", task "{task}".')
    else:
        annotations = f.explicit_annotations

        print('TODO : interpolate implicits')

        return json_ok([a.to_jsonobj() for a in annotations])


# POST
#   { label : int, x : float, y : float, w : float, h : float }
@secure_api('/api/projects/<int:project>/tasks/<int:task>/frames/<int:frame>/annotations/add')
def api_projects_tasks_frames_add_annotations(args : dict, user : UserInfo, project : int, task : int, frame : int):
    if (proj := Project.get_existing_project(project)) is None:
        return json_error(f'Invalid project id "{project}".')
    elif (t := proj.get_task(task)) is None:
        return json_error(f'Invalid task id "{task}" in project "{project}".')
    elif (f := t.get_frame(frame)) is None:
        return json_error(f'Invalid frame id "{frame}" in project "{project}", task "{task}".')
    else:
        label = int(args['label'])
        label = proj.get_label(label)
        pose = AnnotationPose(
            float(args['x']),
            float(args['y']),
            float(args['w']),
            float(args['h'])
        )
        t.add_explicit_annotation(f, label, pose, user.uname)

        return api_projects_tasks_frames_annotations(
            args = args,
            user = user,
            project = project,
            task = task,
            frame = frame
        )


@secure_api('/api/projects/<int:project>/tasks/<int:task>/frames/<int:frame>/annotations/change')
def api_projects_tasks_frames_change_annotations(args : dict, user : UserInfo, project : int, task : int, frame : int):
    pass # TODO


@secure_api('/api/projects/<int:project>/tasks/<int:task>/frames/<int:frame>/download')
def api_projects_tasks_frames_download(args : dict, user : UserInfo, project : int, task : int, frame : int):
    pass # TODO


def human_readable_size(num : int | float, scale : int | float = 1024.0, suffix = 'B', si_prefixes : list[str] = list('kMGTPEZY')) -> str:
    for unit in [''] + si_prefixes:
        if abs(num) < scale:
            return f"{num:3.2f} {unit}{suffix}"
        num /= scale
    return '(way too fucking large, bro)'

# POST:
#   { dir : str }
# RETURN:
#   {
#       dir : str,
#       files : list[{
#            name : str,
#            path : str,
#            type : 'd' or 'f',
#            size : str,
#            created : datetime,
#            modified : datetime
#       }]
#   }
@secure_api('/api/filesystem')
def api_filesystem(args : dict, user : UserInfo):
    if (dir := args.get('dir', None)) is None:
        return json_error('No directory has been provided.')
    elif not osp.isdir(dir):
        return json_error(f'Unknown directory "{dir}"')
    else:
        def _normpath(path : str) -> str:
            return path.replace('\\', '/')

        files = os.listdir(dir)
        files.sort(key = lambda f: osp.splitext(f)[::-1])
        files.sort(key = lambda f: not osp.isdir(osp.join(dir, f)))
        files.insert(0, '..')
        isroot = re.match('^(\\.?/|[a-zA-Z]:/?|)\\.\\./?$', _normpath(dir)) is not None
        dir = osp.normpath(dir)

        if isroot: # list drives on windows
            files = [chr(x) + ':/' for x in range(65, 91) if os.path.exists(chr(x) + ':')]

        filtered_files = []

        for file in files:
            if isroot:
                path = file
            elif file == '..' and (_normpath(dir) == '/' or _normpath(dir).endswith(':/')):
                path = '/..'
            else:
                path = osp.normpath(osp.join(dir, file))

            isdir = osp.isdir(path)

            if isdir or path.lower().endswith(tuple(VALID_IMAGE_EXTENSIONS + VALID_VIDEO_EXTENSIONS)):
                stat = os.stat(path)
                filtered_files.append({
                    'name': file + os.sep if isdir else file,
                    'path': _normpath(path),
                    'type': 'd' if isdir else 'f',
                    'size': human_readable_size(stat.st_size),
                    'created': print_utc(utc_from_unix(stat.st_ctime)),
                    'modified': print_utc(utc_from_unix(stat.st_mtime)),
                })

        return json_ok({
            'dir': _normpath(dir),
            'files': filtered_files
        })



