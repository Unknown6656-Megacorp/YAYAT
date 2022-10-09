'use strict';


const current_frame = {
    number: 0,
    width: 0,
    height: 0,
};

const pan_container = $('annotation-canvas');
const pan_canvas = $('svg-holder');


pan_container.on('dblclick', reset_pos_zoom);
let pz = panzoom(pan_canvas[0], {
    zoomSpeed: .5,
    smoothScroll: true,
    maxZoom: 15,
    minZoom: .7,
    bounds: true,
    boundsPadding: .4,
    zoomDoubleClickSpeed: 1,
    transformOrigin: {x: 0.5, y: 0.5},
    onDoubleClick: event => {
        return false;
    },
});

// if (pz)
// pz.dispose();


function reset_pos_zoom()
{
    const cnv = pan_container[0].getBoundingClientRect();
    const zoom = Math.min(1.0 * cnv.width / current_frame.width, 1.0 * cnv.height / current_frame.height);

    pz.zoomAbs(0, 0, zoom);
    pz.moveTo(0, 0);
}


// pixelated
// smooth


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
