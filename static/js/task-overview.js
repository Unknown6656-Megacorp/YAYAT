'use strict';

task.created = print_relative_utc(task.created);
task.modified = print_relative_utc(task.modified);

$('#date-created').text(task.created);
$('#date-modified').text(task.modified);




$('#task-overview').click(() => window.location.href = `/yayat/projects/${project.id}/tasks/`);

