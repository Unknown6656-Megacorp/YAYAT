'use strict';


const PAN_OVERFLOW_PERC = 60;
const pan_container = $('annotation-canvas');
const pan_canvas = $('svg-holder');
const pan_initial = { x: 0, y: 0 };
const pan_offset = { x: 0, y: 0 }; // transform offset from center
let pan_active = false;


function update_pos_zoom()
{
    const { width, height } = pan_container[0].getBoundingClientRect();
    let left = 100.0 * pan_offset.x / width;
    let top = 100.0 * pan_offset.y / height;

    left = Math.max(-PAN_OVERFLOW_PERC, Math.min(left, PAN_OVERFLOW_PERC));
    top = Math.max(-PAN_OVERFLOW_PERC, Math.min(top, PAN_OVERFLOW_PERC));

    pan_offset.x = left * width * 0.01;
    pan_offset.y = top * height * 0.01;
    pan_canvas.css('transform', `translate(${left}%, ${top}%)`);
}

function get_pan_xy({ clientX, clientY })
{
    const { left, top } = pan_container[0].getBoundingClientRect();

    return {
        x: clientX - left,
        y: clientY - top
    };
}

function pan_start(event)
{
    event.preventDefault();
    pan_active = true;

    const { x, y } = get_pan_xy(event);

    pan_initial.x = x - pan_offset.x;
    pan_initial.y = y - pan_offset.y;
}

function pan_move(event)
{
    if (pan_active)
    {
        const { x, y } = get_pan_xy(event);
        pan_offset.x = x - pan_initial.x;
        pan_offset.y = y - pan_initial.y;

        update_pos_zoom();
    }
};

$(document).on('mousemove', pan_move);
$(document).on('mouseup', e => pan_active = false);
pan_container.on('mousedown', pan_start);
pan_container.on('wheel', event =>
{
    if (event.originalEvent.deltaY < 0)
    {
        // wheeled up
    }
    else if (event.originalEvent.deltaY > 0) {
        // wheeled down
    }
});







let current_frame = 0;

$('#btn-first-frame').click(() => goto_frame(0));
$('#btn-prev-frame').click(() => goto_frame(current_frame - 1));
$('#btn-next-frame').click(() => goto_frame(current_frame + 1));
$('#btn-last-frame').click(() => goto_frame(task.frames.length - 1));
$('#frame-slider, #frame-number').on('change input paste', e => goto_frame($(e.target).val() - 1));
$('#btn-play-backward');
$('#btn-play-forward');

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
    $('svg-holder, #svg-root').css('width', `${frame.width}px`).css('height', `${frame.height}px`);
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
