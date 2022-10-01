'use strict';


let html = '';

for (const task of tasks)
{
    const href = `/yayat/projects/${task.project}/tasks/${task.id}/`;
    html += `
        <task-card>
            <task-preview href="${href}"></task-preview>
            <task-info>
                <a href="${href}">
                    <h2 data-task-id="${task.id}">${task.name}</h2>
                </a>
                <span class="small">
                    Created by <b>${task.creator}</b> ${print_utc(task.created)} in 
                    <a href="/yayat/projects/${task.project}/">
                        <b>project #${task.project}</b>
                    </a>.
                    Last modified ${print_utc(task.modified)}.
                </span>
                <task-progress>
                    <progress-bar>
                        <progress-bar-segment class="completed" style="width: 40%"></progress-bar-segment>
                        <progress-bar-segment class="not-started" style="width: 60%"></progress-bar-segment>
                    </progress-bar>
                    <b class="small">
                        {} / ${task.frames} frame${task.frame != 1 ? 's' : ''} annotated
                    </b>
                </task-progress>
            </task-info>
            <task-actions>
                <button class="primary open" href="${href}">Open</button>
                <button class="export" href="${href}export/">Export</button>
                <button class="edit" href="${href}edit/">Edit</button>
            </task-actions>
        </task-card>
    `;
}

$('task-list').html(html);
$('#task-count').text(tasks.length);
$('#new-task').click(() => window.location.href = `/yayat/projects/${project.id}/new-task/`);
$('task-preview[href], task-actions button[href]').click(elem => window.location.href = $(elem.target).attr('href'));
