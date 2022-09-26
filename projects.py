from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Iterable, TypeVar
import os.path as osp
import os
import json

from __main__ import print_utc, parse_utc, PROJECTS_DIR

PROJECTS_DIR : str
PROJECT_FILE = 'project.json'
TASK_FILE = 'task.json'


T = TypeVar('T')
def get_next_free_id(collection : Iterable[T], selector : Callable[[T], int], starter : int = 0) -> int:
    while any(e for e in collection if selector(e) == starter):
        starter += 1
    return starter

def fetch_by_id(collection : Iterable[T], selector : Callable[[T], int], id : int) -> T | None:
        return next((e for e in collection if selector(e) == id), None)



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


@dataclass
class Frame:
    local_image_filename : str
    original_image_filename : str
    explicit_annotations : list[ExplicitAnnotation]
    deleted : bool

    def to_jsonobj(self) -> dict[str, Any]:
        return {
            'local_image_filename': self.local_image_filename,
            'original_image_filename': self.original_image_filename,
            'explicit_annotations': [a.to_jsonobj() for a in self.explicit_annotations],
            'deleted': self.deleted,
        }

    @staticmethod
    def from_jsonobj(jsonobj : dict[str, Any]) -> 'Frame':
        return Frame(
            local_image_filename = jsonobj['local_image_filename'],
            original_image_filename = jsonobj['original_image_filename'],
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
        self.task_file = osp.join(self.directory, TASK_FILE)

        if not osp.isdir(self.directory):
            os.mkdir(self.directory)

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

    def add_task(self, name : str, uname : str) -> Task:
        id = get_next_free_id(self.get_tasks(), lambda t: t.id, 1)
        task = Task(self, id, name, uname)
        self.tasks.append(id)
        self.update_json()

        return task

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
    def create_new_project(name : str, uname : str) -> 'Project':
        id = get_next_free_id(Project.get_existing_projects(), lambda p: p.id, 1)
        return Project(id, name, uname)

