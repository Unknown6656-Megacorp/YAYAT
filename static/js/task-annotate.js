'use strict';

let current_frame = 0;


$('#first-frame').click(() => goto_frame(0));
$('#prev-frame').click(() => goto_frame(current_frame - 1));
$('#next-frame').click(() => goto_frame(current_frame + 1));
$('#last-frame').click(() => goto_frame(task.frames.length - 1));
$('#frame-slider, #frame-number').on('change input paste', e => goto_frame($(e.target).val() - 1));


function goto_frame(frame_number)
{
    frame_number = Math.max(0, Math.min(frame_number, task.frames.length));

    const frame = task.frames[frame_number];
    let svg = '';

    for (const expl_annotation in frame.explicit_annotations)
    {
        svg += `
            <g>
                <!-- add rectangle, circles, and grabber -->
            </g>
        `;
    }

    $('#svg-annotations').html(svg);
    $('#svg-image').attr('href', `/api/img/${task.project}/${task.id}/${frame.id}`)

    current_frame = frame_number;

    $('#frame-resolution').text(`${NaN} x ${NaN}`);
    $('#frame-source').attr('data-source', frame.original_image_source);
    $('#frame-internal-name').text(frame.local_image_filename);
    $('#frame-original-name').text(frame.original_image_filename);
    $('#frame-slider, #frame-number').val(frame_number + 1);
}




$('#play-backward');
$('#play-forward');