from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Iterable, TypeVar
import tempfile
import shutil
import os.path as osp
import os
import json

import cv2
import numpy as np
import ffmpeg

from __main__ import print_utc, parse_utc, PROJECTS_DIR, _DEBUG_
from users import *


# TODO : change APIs to use UserInfo instead of str


PROJECTS_DIR : str
PROJECT_FILE = 'project.json'
DOWNLOAD_FILE = 'download.log'
UPLOAD_FILE = 'upload.log'
TASK_FILE = 'task.json'

PREVIEW_SIZE : int = 200


VALID_IMAGE_EXTENSIONS = [
    '.jpg', '.jpeg', '.jpe', '.jp2', '.png', '.bmp', '.tif', '.tiff', '.sr', '.ras', '.pbm', '.pgm', '.ppm', '.dib'
]
VALID_VIDEO_EXTENSIONS = [
    '.mov', '.mp4', '.mts', '.mkv', '.webm', '.flv', '.3g2', '.3gp', '.amv', '.rle', '.rpza', '.m2t',
    '.asf', '.avi', '.f4v', '.gif', '.gifv', '.m4v', '.qt', '.m4p', '.mpg', '.mp2', '.mpeg', '.mpe',
    '.mpv', '.ts', '.m2ts', '.ogv', '.ogg', '.vob', '.wmv', '.avif', '.avs', '.avchd', '.hdv', '.swf'
]


T = TypeVar('T')
def get_next_free_id(collection : Iterable[T], selector : Callable[[T], int], starter : int = 0) -> int:
    while any(e for e in collection if selector(e) == starter):
        starter += 1
    return starter

def fetch_by_id(collection : Iterable[T], selector : Callable[[T], int], id : int) -> T | None:
        return next((e for e in collection if selector(e) == id), None)

def normalize_frame_image(image : np.ndarray) -> np.ndarray | None:
    if len(image) == 0:
        return None
    elif len(image.shape) == 2:
        return normalize_frame_image(image[:, :, None])
    elif len(image.shape) != 3:
        return None
    else:
        if image.dtype == np.int8:
            image = image / 127.0
        elif image.dtype == np.uint8:
            image = image / 255.0
        elif image.dtype == np.int16:
            image = image / 32767.0
        elif image.dtype == np.uint16:
            image = image / 65535.0
        elif image.dtype != np.float64:
            image = image.astype(np.float64)

        if image.shape[2] == 1:
            return normalize_frame_image(np.repeat(image, 3, 2))
        elif image.shape[2] > 4:
            return normalize_frame_image(image[:, :, :4])
        elif image.shape[2] < 4:
            image = np.concatenate((
                image,
                np.zeros((image.shape[0], image.shape[1], 3 - image.shape[2])),
                np.ones((image.shape[0], image.shape[1], 1))),
                axis = 2
            )

            return normalize_frame_image(image)
        else:
            return (np.clip(image, 0, 1) * 255).astype(np.uint8)

def create_frame_preview(image : np.ndarray) -> np.ndarray:
    preview = np.zeros((PREVIEW_SIZE, PREVIEW_SIZE, image.shape[2]), dtype = image.dtype)
    height, width = image.shape[:2]

    if width > height:
        n_width = PREVIEW_SIZE
        n_height = int(height / width * n_width)
    else:
        n_height = PREVIEW_SIZE
        n_width = int(width / height * n_height)

    offs_x = int((PREVIEW_SIZE - n_width) / 2)
    offs_y = int((PREVIEW_SIZE - n_height) / 2)
    resized = cv2.resize(image, (n_width, n_height), interpolation = cv2.INTER_AREA)

    preview[offs_y:offs_y + n_height, offs_x:offs_x + n_width, :] = resized

    return preview

def read_images(bytes : bytearray | None, update_message_callback : Callable[[str], None] | None) -> list[np.ndarray]:
    if bytes is None or len(bytes) < 5:
        return []

    temp = tempfile.TemporaryDirectory()
    images = []

    if update_message_callback is not None:
        update_message_callback('Storing to temporary folder.')

    try:
        in_file = osp.join(temp.name, 'input')

        with open(in_file, 'wb') as f:
            f.write(bytes)

        if update_message_callback is not None:
            update_message_callback('Processing with FFMPEG. This may take REALLY long.')

        ffmpeg.input(in_file)\
              .output(osp.join(temp.name, 'output-%010d.png'))\
              .overwrite_output()\
              .run(quiet = _DEBUG_)

        if update_message_callback is not None:
            update_message_callback('Indexing resulting frames.')

        out_files = [f for f in os.listdir(temp.name) if f.startswith('output-')]
        out_files.sort()

        for index, file in enumerate(out_files):
            file = osp.join(temp.name, file)
            if osp.isfile(file):
                try:
                    if update_message_callback is not None:
                        update_message_callback(f'Reading OpenCV2 frame {index + 1} / {len(out_files)} (~ {(index + 1) * 100.0 / len(out_files):.2f} %).')

                    if len(image := cv2.imread(file, cv2.IMREAD_UNCHANGED)) > 0:
                        images.append(image)
                except:
                    continue
    except Exception as e:
        breakpoint()
        print(e)

    if osp.isdir(temp.name):
        shutil.rmtree(temp.name)

    return images



@dataclass
class Label:
    id : int
    name : str
    order : int
    color : str

    def to_jsonobj(self) -> dict[str, Any]: return self.__dict__

    @staticmethod
    def from_jsonobj(jsonobj : dict[str, Any]) -> 'Label':
        return Label(
            id = int(jsonobj['id']),
            name = jsonobj['name'],
            color = jsonobj['color'],
            order = int(jsonobj['order'])
        )


@dataclass
class AnnotationPose:
    center_x : float
    center_y : float
    width : float
    height : float

    def to_jsonobj(self) -> list[float]:
        return [self.center_x, self.center_y, self.width, self.height]

    @staticmethod
    def from_jsonobj(jsonobj : list[float]) -> 'AnnotationPose':
        return AnnotationPose(center_x = jsonobj[0], center_y = jsonobj[1], width = jsonobj[2], height = jsonobj[3])


@dataclass
class ExplicitAnnotation:
    id : int
    label_id : int
    frame : int
    pose : AnnotationPose
    creator : str
    created : datetime
    modified : datetime

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'label_id': self.label_id,
            'frame': self.frame,
            'pose': self.pose.to_jsonobj(),
            'creator': self.creator,
            'created': print_utc(self.created),
            'modified': print_utc(self.modified),
        }

    @staticmethod
    def from_jsonobj(jsonobj : dict[str, Any]) -> 'ExplicitAnnotation':
        return ExplicitAnnotation(
            id = int(jsonobj['id']),
            label_id = int(jsonobj['label_id']),
            frame = int(jsonobj['frame']),
            pose = AnnotationPose.from_jsonobj(jsonobj['pose']),
            creator = jsonobj['creator'],
            created = parse_utc(jsonobj['created']),
            modified = parse_utc(jsonobj['modified'])
        )


@dataclass
class TrackingAnnotationKeyframe:
    frame : int
    pose : AnnotationPose
    creator : str
    created : datetime
    modified : datetime

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'frame': self.frame,
            'pose': self.pose.to_jsonobj(),
            'creator': self.creator,
            'created': print_utc(self.created),
            'modified': print_utc(self.modified),
        }

    @staticmethod
    def from_jsonobj(jsonobj : dict[str, Any]) -> 'TrackingAnnotationKeyframe':
        return TrackingAnnotationKeyframe(
            frame = int(jsonobj['frame']),
            pose = AnnotationPose.from_jsonobj(jsonobj['pose']),
            creator = jsonobj['creator'],
            created = parse_utc(jsonobj['created']),
            modified = parse_utc(jsonobj['modified'])
        )


@dataclass
class TrackingAnnotation:
    id : int
    label_id : int
    start_frame : int
    end_frame : int
    keyframes : list[TrackingAnnotationKeyframe]

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'label_id': self.label_id,
            'start_frame': self.start_frame,
            'end_frame': self.end_frame,
            'keyframes': [k.to_jsonobj() for k in self.keyframes],
        }

    @staticmethod
    def from_jsonobj(jsonobj : dict[str, Any]) -> 'TrackingAnnotation':
        return TrackingAnnotation(
            id = int(jsonobj['id']),
            label_id = int(jsonobj['label_id']),
            start_frame = int(jsonobj['start_frame']),
            end_frame = int(jsonobj['end_frame']),
            keyframes = [TrackingAnnotationKeyframe.from_jsonobj(k) for k in jsonobj['keyframes']],
        )


class FrameOrigin(Enum):
    SERVER = 's'
    UPLOAD = 'u'
    WEBURL = 'w'


@dataclass
class Frame:
    id : int
    local_image_filename : str
    original_image_filename : str
    original_image_source : FrameOrigin
    explicit_annotations : list[ExplicitAnnotation]
    width : int
    height : int
    deleted : bool

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'width' : self.width,
            'height' : self.height,
            'local_image_filename': self.local_image_filename,
            'original_image_filename': self.original_image_filename,
            'original_image_source' : self.original_image_source.value,
            'explicit_annotations': [a.to_jsonobj() for a in self.explicit_annotations],
            'deleted': self.deleted,
        }

    @staticmethod
    def from_jsonobj(jsonobj : dict[str, Any]) -> 'Frame':
        return Frame(
            id = int(jsonobj['id']),
            width = int(jsonobj['width']),
            height = int(jsonobj['height']),
            local_image_filename = jsonobj['local_image_filename'],
            original_image_filename = jsonobj['original_image_filename'],
            original_image_source = FrameOrigin(jsonobj['original_image_source']),
            explicit_annotations = [ExplicitAnnotation.from_jsonobj(a) for a in jsonobj['explicit_annotations']],
            deleted = bool(jsonobj['deleted'])
        )


class TaskProgress(Enum):
    NOT_YET_STARTED = 0
    IN_PROGRESS = 1
    COMPLETED = 2


class Task:
    def __init__(self, project : 'Project', id : int, name : str = None, creator : str = None):
        self.id = id
        self.name = name
        self.project = project
        self.frames : list[Frame] = []
        self.tracking_annotations : list[TrackingAnnotation] = []
        self.progress = TaskProgress.NOT_YET_STARTED
        self.creator = creator
        self.created = datetime.utcnow()
        self.modified = self.created
        self.directory = osp.join(project.directory, str(id))
        self.image_directory = osp.join(self.directory, 'images')
        self.preview_directory = osp.join(self.directory, 'previews')
        self.download_file = osp.join(self.directory, DOWNLOAD_FILE)
        self.upload_file = osp.join(self.directory, UPLOAD_FILE)
        self.task_file = osp.join(self.directory, TASK_FILE)
        self.next_annotation_id = 0

        for dir in [self.directory, self.image_directory, self.preview_directory]:
            if not osp.isdir(dir):
                os.mkdir(dir)

        self.create_json()
        self.read_json()

    def delete(self) -> None:
        os.remove(self.task_file)
        os.rmdir(self.directory)

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'project': self.project.id,
            'creator': self.creator,
            'created': print_utc(self.created),
            'modified': print_utc(self.modified),
            'progress': self.progress.value,
            'frames': [f.to_jsonobj() for f in self.frames],
            'tracking_annotations': [a.to_jsonobj() for a in self.tracking_annotations],
        }

    def to_jsonstr(self) -> str:
        return json.dumps(self.to_jsonobj())

    def to_slimjsonstr(self) -> str:
        return json.dumps({
            'id': self.id,
            'name': self.name,
            'project': self.project.id,
            'creator': self.creator,
            'created': print_utc(self.created),
            'modified': print_utc(self.modified),
            'progress': self.progress.value,
            'frames': len(self.frames),
            'tracking_annotations': len(self.tracking_annotations),
        })

    def read_json(self) -> None:
        with open(self.task_file, 'r') as f:
            jsonobj = json.load(f)
            self.id = int(jsonobj['id'])
            self.name = jsonobj['name']
            self.project = self.project or Project.get_existing_project(int(jsonobj['project']))
            self.creator = jsonobj['creator']
            self.created = parse_utc(jsonobj['created'])
            self.modified = parse_utc(jsonobj['modified'])
            self.progress = TaskProgress(jsonobj['progress'])
            self.frames = [Frame.from_jsonobj(obj) for obj in jsonobj['frames']]
            self.tracking_annotations = [TrackingAnnotation.from_jsonobj(obj) for obj in jsonobj['tracking_annotations']]

            for annotation in self.tracking_annotations:
                self.next_annotation_id = max(self.next_annotation_id, annotation.id)

            for frame in self.frames:
                for annotation in frame.explicit_annotations:
                    self.next_annotation_id = max(self.next_annotation_id, annotation.id)

    def update_json(self) -> None:
        with open(self.task_file, 'w') as f:
            json.dump(self.to_jsonobj(), f)

    def create_json(self) -> None:
        if not osp.isfile(self.task_file):
            self.update_json()

    def update_modified(self, utc : datetime) -> None:
        if utc > self.modified:
            self.modified = utc
            self.update_json()
            self.project.update_modified(utc)

    def mark_as_completed(self) -> None:
        self.progress = TaskProgress.COMPLETED
        self.update_modified(datetime.utcnow())

    def add_frames(self, images : list[tuple[np.ndarray, str, FrameOrigin]]) -> list[Frame]:
        id = 0 if len(self.frames) == 0 else max(f.id for f in self.frames)
        frames = []

        for image, name, origin in images:
            id += 1
            local_name = f'{id:010}.png'
            local_path = osp.join(self.image_directory, local_name)
            image = normalize_frame_image(image)

            if image is not None:
                height, width = image.shape[:2]
                preview = create_frame_preview(image)
                preview_path = osp.join(self.preview_directory, local_name)

                if osp.exists(local_path):
                    os.remove(local_path)
                if osp.exists(preview_path):
                    os.remove(preview_path)

                cv2.imwrite(local_path, image)
                cv2.imwrite(preview_path, preview)
            else:
                width = 0
                height = 0

            frame = Frame(id, local_name, name, origin, [], width, height, image is None)
            frames.append(frame)

        self.frames += frames
        self.update_modified(datetime.utcnow())

        return frames

    def add_frame(self, image : np.ndarray, name : str, origin : FrameOrigin) -> Frame:
        return self.add_frames([(image, name, origin)])[0]

    def delete_frame(self, frame : Frame, purge : bool = False) -> None:
        index = None
        for i, f in enumerate(self.frames):
            if f.id == frame.id:
                f.deleted = True
                frame.deleted = True
                index = i
                break

        if purge and index is not None:
            path = osp.join(self.image_directory, frame.local_image_filename)
            self.frames = self.frames[:index] + self.frames[index + 1:]

            if osp.exists(path):
                os.remove(path)

    def get_frame(self, frame : int) -> Frame | None:
        for f in self.frames:
            if f.id == frame:
                return f

        return None

    def get_image_path(self, frame : Frame) -> str:
        return osp.join(self.image_directory, frame.local_image_filename)

    def get_preview_path(self, frame : Frame) -> str:
        return osp.join(self.preview_directory, frame.local_image_filename)

    def get_image(self, frame : Frame) -> np.ndarray | None:
        try:
            path = self.get_image_path(frame)
            image = cv2.imread(path, cv2.IMREAD_UNCHANGED)

            if len(image) > 0:
                return image
        except:
            pass

        return None

    def get_preview(self, frame : Frame) -> np.ndarray | None:
        try:
            path = self.get_preview_path(frame)
            image = cv2.imread(path, cv2.IMREAD_UNCHANGED)

            if len(image) > 0:
                return image
        except:
            pass

        return None

    def get_next_annotation_id(self) -> int:
        self.next_annotation_id += 1
        return self.next_annotation_id

    def add_explicit_annotation(self, frame : Frame | int, label : Label, pose : AnnotationPose, creator : str) -> None:
        if isinstance(frame, int):
            frame = self.get_frame(frame)

        now = datetime.utcnow()
        id = self.get_next_annotation_id()
        annotation = ExplicitAnnotation(id, label.id, frame.id, pose, creator, now, now)
        frame.explicit_annotations.append(annotation)

        if self.progress == TaskProgress.NOT_YET_STARTED:
            self.progress = TaskProgress.IN_PROGRESS

        self.update_modified(now)


class Project:
    def __init__(self, id : int, name : str = None, uname : str = None):
        self.id = id
        self.name = name
        self.tasks : list[int] = []
        self.labels : list[Label] = []
        self.creator = uname
        self.created = datetime.utcnow()
        self.modified = self.created
        self.directory = osp.join(PROJECTS_DIR, str(id))
        self.project_file = osp.join(self.directory, PROJECT_FILE)

        if not osp.isdir(self.directory):
            os.mkdir(self.directory)

        self.create_json()
        self.read_json()

    def delete_project(self) -> None:
        for t in self.tasks:
            self.delete_task(t)

        os.remove(self.project_file)
        os.rmdir(self.directory)

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'creator': self.creator,
            'created': print_utc(self.created),
            'modified': print_utc(self.modified),
            'labels': [l.to_jsonobj() for l in self.labels],
            'tasks': self.tasks,
        }

    def to_jsonstr(self) -> str:
        return json.dumps(self.to_jsonobj())

    def read_json(self) -> None:
        with open(self.project_file, 'r') as f:
            jsonobj = json.load(f)
            self.id = int(jsonobj['id'])
            self.name = jsonobj['name']
            self.tasks = jsonobj['tasks']
            self.labels = [Label.from_jsonobj(obj) for obj in jsonobj['labels']]
            self.creator = jsonobj['creator']
            self.created = parse_utc(jsonobj['created'])
            self.modified = parse_utc(jsonobj['modified'])

    def update_json(self) -> None:
        with open(self.project_file, 'w') as f:
            json.dump(self.to_jsonobj(), f)

    def create_json(self) -> None:
        if not osp.isfile(self.project_file):
            self.update_json()

    def update_modified(self, utc : datetime) -> None:
        if utc > self.modified:
            self.modified = utc
            self.update_json()

    def add_label(self, name : str, color : str) -> Label:
        id = get_next_free_id(self.labels, lambda l:l.id, 1)
        self.labels.append(label := Label(id = id, name = name, order = len(self.labels), color = color))
        self.update_json()

        return label

    def add_task(self, name : str, user : UserInfo) -> Task:
        id = get_next_free_id(self.get_tasks(), lambda t: t.id, 1)
        task = Task(self, id, name, user.uname)
        self.tasks.append(id)
        self.update_json()

        return task

    def get_label(self, id : int) -> Label:
        return [l for l in self.labels if l.id == id][0]

    def get_tasks(self) -> list[Task]:
        return [self.get_task(t) for t in self.tasks]

    def get_task(self, id : int) -> Task | None:
        if id not in self.tasks:
            return None
        else:
            return Task(self, id)

    def delete_task(self, id : int) -> None:
        if (task := self.get_task(id)) is not None:
            task.delete()
            self.tasks.remove(id)
            self.update_json()


    @staticmethod
    def get_existing_projects() -> list['Project']:
        projects = []
        for dir in os.listdir(PROJECTS_DIR):
            info_file = osp.join(PROJECTS_DIR, dir, PROJECT_FILE)
            if osp.isfile(info_file):
                projects.append(Project(id = int(dir)))
        return projects

    @staticmethod
    def get_existing_project(id : int) -> 'Project | None':
        return fetch_by_id(Project.get_existing_projects(), lambda p: p.id, id)

    @staticmethod
    def create_new_project(name : str, user : UserInfo) -> 'Project':
        id = get_next_free_id(Project.get_existing_projects(), lambda p: p.id, 1)
        return Project(id, name, user.uname)

