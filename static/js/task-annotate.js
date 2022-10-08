'use strict';

let current_frame = 0;


$('#btn-first-frame').click(() => goto_frame(0));
$('#btn-prev-frame').click(() => goto_frame(current_frame - 1));
$('#btn-next-frame').click(() => goto_frame(current_frame + 1));
$('#btn-last-frame').click(() => goto_frame(task.frames.length - 1));
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
    $('#svg-root').attr('viewBox', `0 0 ${frame.width} ${frame.height}`);
    $('#svg-image').attr('href', `/api/img/${task.project}/${task.id}/${frame.id}`);
    $('#frame-resolution').text(`${frame.width} x ${frame.height} `);
    $('#frame-source').attr('data-source', frame.original_image_source);
    $('#frame-internal-name').text(frame.local_image_filename);
    $('#frame-original-name').text(frame.original_image_filename);
    $('#frame-slider, #frame-number').val(frame_number + 1);
    $('#btn-first-frame, #btn-prev-frame, #btn-play-backward').attr('disabled', frame_number < 1);
    $('#btn-last-frame, #btn-next-frame, #btn-play-forward').attr('disabled', frame_number > task.frames.length - 2);

    window.history.replaceState(null, null, `#${frame_number + 1}`);
    current_frame = frame_number;
}


const hash = parseInt(window.location.hash.slice(1));

if (hash > 0 && hash <= task.frames.length)
    goto_frame(hash - 1);



$('#btn-play-backward');
$('#btn-play-forward');