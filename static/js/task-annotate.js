'use strict';


const current_frame = {
    number: 0,
    width: 0,
    height: 0,
};

const PAN_OVERFLOW_PERC = 60;
const SCROLL_FACTOR = .05;
const pan_container = $('annotation-canvas');
const pan_canvas = $('svg-holder');
const pan_initial = { x: 0, y: 0 };
const pan_offset = { x: 0, y: 0 }; // transform offset from center
let zoom_factor = 1.0;
let pan_active = false;


function reset_pos_zoom()
{
    const cnv = pan_container[0].getBoundingClientRect();

    pan_active = false;
    zoom_factor = Math.min(1.0 * cnv.width / current_frame.width, 1.0 * cnv.height / current_frame.height);
    pan_initial.x = 0;
    pan_initial.y = 0;
    pan_offset.x = 0;
    pan_offset.y = 0;

    console.log('reset');

    update_pos_zoom();
}

function update_pos_zoom()
{
    const { width, height } = pan_container[0].getBoundingClientRect();
    let left = 100.0 * pan_offset.x / width;
    let top = 100.0 * pan_offset.y / height;

    left = Math.max(-PAN_OVERFLOW_PERC, Math.min(left, PAN_OVERFLOW_PERC));
    top = Math.max(-PAN_OVERFLOW_PERC, Math.min(top, PAN_OVERFLOW_PERC));

    pan_offset.x = left * width * 0.01;
    pan_offset.y = top * height * 0.01;
    pan_canvas.css('transform', `scale(${zoom_factor * 100.0}%) translate(${left}%, ${top}%)`);

    console.log('update', left, top, zoom_factor);
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

    console.log('start', pan_initial);
}

function pan_move(event)
{
    if (pan_active)
    {
        const { x, y } = get_pan_xy(event);
        const cnv = pan_container[0].getBoundingClientRect();

        pan_offset.x = cnv.width / current_frame.width * (x - pan_initial.x);
        pan_offset.y = cnv.height / current_frame.height * (y - pan_initial.y);

        console.log('move', pan_offset);

        update_pos_zoom();
    }
};

$(document).on('mousemove', pan_move);
$(document).on('mouseup', e => pan_active = false);
pan_container.on('dblclick', reset_pos_zoom);
pan_container.on('mousedown', pan_start);
pan_container.on('wheel', event =>
{
    event = event.originalEvent;
    event.preventDefault();
    
    const mousex = event.clientX - pan_offset.x;
    const mousey = event.clientY - pan_offset.y;
    const wheel = event.deltaY < 0 ? -1 : 1;
    const zoom = Math.exp(wheel * SCROLL_FACTOR);

    zoom_factor *= zoom;
    zoom_factor = Math.max(.25, zoom_factor);
    zoom_factor = Math.min(10, zoom_factor);

    // // Translate so the visible origin is at the context's origin.
    // context.translate(originx, originy);
  
    // // Compute the new visible origin. Originally the mouse is at a
    // // distance mouse/scale from the corner, we want the point under
    // // the mouse to remain in the same place after the zoom, but this
    // // is at mouse/new_scale away from the corner. Therefore we need to
    // // shift the origin (coordinates of the corner) to account for this.
    // originx -= mousex/(scale*zoom) - mousex/scale;
    // originy -= mousey/(scale*zoom) - mousey/scale;
    
    // // Scale it (centered around the origin due to the trasnslate above).
    // context.scale(zoom, zoom);
    // // Offset the visible origin to it's proper position.
    // context.translate(-originx, -originy);

    // // Update scale and others.
    // scale *= zoom;
    // visibleWidth = width / scale;
    // visibleHeight = height / scale;


    // zoom_factor += Math.exp(zoom_offs);
    update_pos_zoom();
});








$('#btn-first-frame').click(() => goto_frame(0));
$('#btn-prev-frame').click(() => goto_frame(current_frame.number - 1));
$('#btn-next-frame').click(() => goto_frame(current_frame.number + 1));
$('#btn-last-frame').click(() => goto_frame(task.frames.length - 1));
$('#frame-slider, #frame-number').on('change input paste', e => goto_frame($(e.target).val() - 1));
$('#btn-play-backward');
$('#btn-play-forward');

function goto_frame(frame_number)
{
    frame_number = Math.max(0, Math.min(frame_number, task.frames.length));

    const frame = task.frames[frame_number];

    current_frame.number = frame_number;
    current_frame.width = frame.width;
    current_frame.height = frame.height;

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

    reset_pos_zoom();

    window.history.replaceState(null, null, `#${frame_number + 1}`);
}












const hash = parseInt(window.location.hash.slice(1));

if (hash > 0 && hash <= task.frames.length)
    goto_frame(hash - 1);
