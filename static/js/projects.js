'use strict';

(async function main()
{
    const projects = await query_api('projects', {}, function(error_msg)
    {
        $('project-list').html(`
            <project-card class="error">
                ${error_msg}
            </project-card>
        `);
    });

    if (projects != undefined)
    {
        let html = '';

        for (const project of projects)
        {
            const tasks = await query_api(`projects/${project.id}/tasks/`, {}, console.log);
            const href = `/yayat/projects/${project.id}/`;
            let progress = {};
            let frames = 0;

            progress[TASK_PROGRESS.NOT_YET_STARTED] = 0;
            progress[TASK_PROGRESS.IN_PROGRESS] = 0;
            progress[TASK_PROGRESS.COMPLETED] = 0;

            for (const task of tasks)
            {
                progress[task.progress] += 1;
                frames += task.frames.length;
            }

            html += `
                <project-card>
                    <project-preview class="open" href="${href}"></project-preview>
                    <project-info>
                        <a href="${href}">
                            <h2 data-project-id="${project.id}">${project.name}</h2>
                        </a>
                        <span class="small">
                            Created by <b>${project.creator}</b> ${print_relative_utc(project.created)}.
                            Last modified ${print_relative_utc(project.modified)}.
                            <br/>
                            ${tasks.length} task${tasks.length != 1 ? 's' : ''},
                            ${project.labels.length} label${project.labels.length != 1 ? 's' : ''},
                            ${frames} image${frames != 1 ? 's' : ''}
                        </span>
                        <project-progress>
                            <progress-bar>
                                <progress-bar-segment class="completed" style="width: ${100.0 * progress[TASK_PROGRESS.COMPLETED] / tasks.length}%"></progress-bar-segment>
                                <progress-bar-segment class="in-progress" style="width: ${100.0 * progress[TASK_PROGRESS.IN_PROGRESS] / tasks.length}%"></progress-bar-segment>
                                <progress-bar-segment class="not-started" style="width: ${100.0 * progress[TASK_PROGRESS.NOT_YET_STARTED] / tasks.length}%"></progress-bar-segment>
                            </progress-bar>
                            <b class="small">
                                <span style="color: seagreen">
                                    ${progress[TASK_PROGRESS.COMPLETED]} completed
                                </span>
                                &nbsp;/&nbsp;
                                <span style="color: cornflowerblue">
                                    ${progress[TASK_PROGRESS.IN_PROGRESS]} in progress
                                </span>
                                &nbsp;/&nbsp;
                                <span style="color: gray">
                                    ${progress[TASK_PROGRESS.NOT_YET_STARTED]} open
                                </span>
                                &nbsp;/&nbsp;
                                ${tasks.length} total
                            </b>
                        </project-progress>
                    </project-info>
                    <project-actions>
                        <button class="primary open" href="${href}">Open</button>
                        <button class="open" >[ TODO ]</button>
                        <button class="open" >[ TODO ]</button>
                    </project-actions>
                </project-card>
            `;
        }

        $('project-list').html(html);
        $('project-preview').click(elem => window.location.href = $(elem.target).attr('href'));

        if (projects.length > 1)
            $('#project-count').text(`There are currently ${projects.length} active projects.`);
    }
})();
