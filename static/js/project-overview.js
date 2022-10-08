'use strict';

project.created = print_relative_utc(project.created);
project.modified = print_relative_utc(project.modified);

$('#date-created').text(project.created);
$('#date-modified').text(project.modified);


const button_save_labels = $('#save-labels');

button_save_labels.css('visibility', 'hidden');
button_save_labels.click(() =>
{
    let labels = [];
    let index = 0;

    for (let label of $('label-list project-label'))
    {
        label = $(label);
        labels.push({
            'id': parseInt(label.attr('data-label-id')),
            'color': label.find('> .label-colorpicker').val(),
            'name': label.find('> .label-name').val(),
            'order': index++,
        });
    }

    query_api_sync(`projects/${project.id}/labels/change`, {
        labels: labels
    }, function()
    {
        // disable warning on leaving page
        button_save_labels.css('visibility', 'hidden');
    }, function(error)
    {
        show_modal_notice(
            'An error occurred',
            `The following error occurred during the saving of the labels:<br/>${error}`,
            [['Ok', () => { }]]
        );
    })
});

function activate_save_changes()
{
    // enable warning on leaving page
    button_save_labels.css('visibility', 'visible');
}

function generate_label_html(label)
{
    const label_item = $(`
    <project-label data-label-id="${label.id}">
        <span class="label-order">#${label.order + 1}</span>
        <input class="label-name" type="text" value="${label.name}"/>
        <button class="label-colorrand">Random color</button>
        <input class="label-colorpicker" type="color" value="${label.color}"/>
        <input class="label-colorhex" type="text" value="${label.color}"/>
        <span class="label-id">ID: ${label.id}</span>
        <button class="label-deleter">Delete label</button>
        <label-grabber>o</label-grabber>
    </project-label>
    `).appendTo($('label-list'));

    const colorhex = label_item.children('.label-colorhex');
    const colorrand = label_item.children('.label-colorrand');
    const colorpicker = label_item.children('.label-colorpicker');


    label_item.children('.label-deleter').click(function()
    {
        label_item.remove();

        activate_save_changes();
    });
    label_item.children('.label-name').change(activate_save_changes);
    colorrand.click(() => colorhex.val(get_random_color()).change());
    colorpicker.on('input change', e => colorhex.val($(e.target).val()).change());
    colorhex.inputmask({
        mask: '\\#hhhhhh',
        greedy: false,
        definitions: {
            'h': {
                validator: '[A-Fa-f0-9]',
                cardinality: 1
            }
        }
    });
    colorhex.on('keyup change paste', function()
    {
        let color = $(this).val();
        const parent = $(this).parent();

        color = color.length > 0 ? /#([0-9a-fA-F]*)_*/.exec(color)[1] : '';

        if (color.length == 3)
            color = `#${color[0]}${color[0]}${color[1]}${color[1]}${color[2]}${color[2]}`;
        else
            color = '#' + color.padEnd(6, '0');

        parent.css('--color-label', color);
        colorpicker.val(color);
    });
    colorhex.change();
    colorhex.on('keyup change paste', activate_save_changes);
}


for (const label of project.labels)
    generate_label_html(label);

$('#new-label').click(function()
{
    query_api_sync(
        `projects/${project.id}/labels/create`,
        {
            'name': `Label ${$('project-label').length + 1}`,
            'color': get_random_color(),
        },
        generate_label_html,
        function(error)
        {
            show_modal_notice(
                'An error occurred',
                `The following error occurred during the creation of a new label:<br/>${error}`,
                [['Ok', () => { }]]
            );
        }
    )
});
$('#task-overview').click(() => window.location.href = `/yayat/projects/${project.id}/tasks/`);

