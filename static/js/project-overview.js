'use strict';

project.created = print_utc(project.created);
project.modified = print_utc(project.modified);

$('#date-created').text(project.created);
$('#date-modified').text(project.modified);



let label_html = '';

for (const label of project.labels)
{
    label_html += `
        <project-label data-label-id="${label.id}">
            <span class="label-order">#${label.order + 1}</span>
            <input class="label-name" type="text" value="${label.name}"/>
            <input class="label-colorpicker" type="color" value="${label.color}"/>
            <input class="label-colorhex" type="text" value="${label.color}"/>
            <span class="label-id">ID: ${label.id}</span>
            <label-grabber>o</label-grabber>
        </project-label>
    `;
}

$('label-list').html(label_html);
$('.label-colorpicker').on('change', function()
{
    const color = $(this).val();
    const parent = $(this).parent();

    parent.css('--color-label', color);
    parent.find('> .label-colorhex').val(color);
});
$('.label-colorhex').inputmask({
    mask: '\\#hhhhhh',
    greedy: false,
    definitions: {
        'h': {
            validator: '[A-Fa-f0-9]',
            cardinality: 1
        }
    }
}).keyup(function()
{
    let color = $(this).val();
    const parent = $(this).parent();

    color = color.length > 0 ? /#([0-9a-fA-F]*)_*/.exec(color)[1] : '';

    if (color.length == 3)
        color = `#${color[0]}${color[0]}${color[1]}${color[1]}${color[2]}${color[2]}`;
    else
        color = '#' + color.padEnd(6, '0');

    parent.css('--color-label', color);
    parent.find('> .label-colorpicker').val(color);
}).keyup();

/*
(async function main()
{
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
                <project-preview href="${href}"></project-preview>
                <project-info>
                    <a href="${href}">
                        <h2 data-project-id="${project.id}">${project.name}</h2>
                    </a>
                    <span class="small">
                        Created by <b>${project.creator}</b> ${print_utc(project.created)},
                        last modified ${print_utc(project.modified)}
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
                    <button>[ TODO ]</button>
                    <button>[ TODO ]</button>
                </project-actions>
            </project-card>
        `;
    }

    $('project-list').html(html);

    if (projects.length > 1)
        $('#project-count').text(`There are currently ${projects.length} active projects.`);

    $('project-preview[href], project-actions button.open[href]').click(elem => window.location.href = $(elem.target).attr('href'));
})();
//*/
