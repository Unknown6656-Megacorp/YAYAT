'use strict';

task.created = print_relative_utc(task.created);
task.modified = print_relative_utc(task.modified);

$('#date-created').text(task.created);
$('#date-modified').text(task.modified);


let html = '';

for (const frame of task.frames)
    html += `
        <frame-card data-frame-id="${frame.id}"
                    data-source="${frame.original_image_source}"
                    ${frame.deleted ? 'deleted' : ''}
                    ${frame.explicit_annotations.length > 0 ? 'annotated' : ''}>
            <frame-text data-frame-id="${frame.id}">#${frame.id}</frame-text>
            <frame-image data-frame-id="${frame.id}" style="--image-preview: url('/api/img/${task.project}/${task.id}/${frame.id}/preview')">
            </frame-image>
        </frame-card>
    `;

$('frame-list').html(html);
$('frame-card').click(e => {
    const frame_id = $(e.target).attr('data-frame-id');

    window.location.href = `./annotate#${frame_id}`
});
